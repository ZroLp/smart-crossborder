/**
 * P0-C-01 + P0-B-06 独立验收测试（qa-verifier）
 *
 * 覆盖：taskId/displayId 契约、状态机、task_logs 落库、五步 progress、
 * pause/terminate/retry 控制路由、任务日志列表/详情、seed 幂等、
 * user_id 数据隔离、Shopify 同步去重、以及一次真实 Agent 执行闭环。
 *
 * 说明：
 * - 本文件不 mock orchestrator，除一个真实执行用例外，其余用 createTask /
 *   transitionTask 直接构造状态，避免依赖 Agent 计算细节。
 * - 依赖 better-sqlite3 原生 binding；binding 缺失时本套件会直接失败（环境问题），
 *   不接受静默 skip。
 */
import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { TaskLogRepository } from '@/lib/db/task-log-repository'
import { AgentProgressTracker } from '@/lib/framework/agent-progress'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { resetOrchestrator } from '@/lib/api/agent-service'
import {
  InvalidTaskStateError,
  TaskNotFoundError,
  createTask,
  findTask,
  formatDisplayId,
  getTask,
  getTaskProgress,
  pauseTask,
  resetTaskRuntimeForTests,
  retryTask,
  terminateTask,
  transitionTask,
} from '@/lib/agents/task-service'
import { seedDemoData } from '@/lib/db/seed'
import { syncShopifyData } from '@/lib/shopify/sync'
import { ProductRepository } from '@/lib/db/product-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { POST as postAgent } from '@/app/api/agent/route'
import { GET as getProgress } from '@/app/api/agent/progress/route'
import { POST as postPause } from '@/app/api/agent/pause/route'
import { POST as postTerminate } from '@/app/api/agent/terminate/route'
import { POST as postRetry } from '@/app/api/agent/retry/route'
import { GET as getTaskLogs } from '@/app/api/task-logs/route'
import { GET as getTaskLogDetail } from '@/app/api/task-logs/[id]/route'
import { GET as getDashboardStats } from '@/app/api/dashboard/stats/route'
import { GET as getData } from '@/app/api/data/route'

let db: Database.Database
let aliceToken: string
let bobToken: string
let aliceId: number
let bobId: number

function repo(): TaskLogRepository {
  return new TaskLogRepository(db)
}

function auth(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${token}` }
}

function post(url: string, body: unknown, token?: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) },
    body: JSON.stringify(body),
  })
}

function get(url: string, token: string): NextRequest {
  return new NextRequest(url, { headers: auth(token) })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  resetOrchestrator()
  resetTaskRuntimeForTests()
  const users = new UserRepository(db)
  aliceId = Number(users.create({ username: 'alice', password: 'x', email: 'a@t.com', role: 'viewer' }).lastInsertRowid)
  bobId = Number(users.create({ username: 'bob', password: 'x', email: 'b@t.com', role: 'viewer' }).lastInsertRowid)
  aliceToken = createSession(aliceId, db)
  bobToken = createSession(bobId, db)
})

afterEach(() => {
  resetOrchestrator()
  db.close()
})

describe('[C-01] taskId / displayId 契约与落库', () => {
  test('createTask 返回数字 taskId 与 TSK-YYYYMMDD## displayId，且同一任务双标识可互查', async () => {
    const first = createTask('selection', { products: [] }, aliceId)
    const second = createTask('selection', { products: [] }, aliceId)

    expect(first.taskId).toMatch(/^\d+$/)
    expect(first.displayId).toMatch(/^TSK-\d{8}\d+$/)
    expect(first.displayId).not.toBe(second.displayId)

    expect(findTask(first.taskId)!.id).toBe(Number(first.taskId))
    expect(findTask(first.displayId)!.id).toBe(Number(first.taskId))
    expect(getTask(first.displayId)!.taskId).toBe(first.taskId)

    const row = repo().findById(Number(first.taskId))!
    expect(row.user_id).toBe(aliceId)
    expect(row.status).toBe('pending')
    expect(formatDisplayId(row)).toBe(first.displayId)
  })

  test('真实执行 customer-service：返回 taskId/displayId/status，落库 completed 并包含 output', async () => {
    const response = await postAgent(
      post('http://localhost/api/agent', {
        agentType: 'customer-service',
        input: { message: '我的包裹什么时候到？', language: 'zh' },
      }, aliceToken)
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.taskId).toMatch(/^\d+$/)
    expect(body.data.displayId).toMatch(/^TSK-\d{8}\d+$/)
    expect(body.data.status).toBe('completed')
    expect(body.data.result.success).toBe(true)

    const row = repo().findById(Number(body.data.taskId))!
    expect(row.status).toBe('completed')
    expect(row.user_id).toBe(aliceId)
    expect(row.error).toBeNull()
    expect(JSON.parse(row.output!).intent).toBe('shipping')
  })

  test('chain:true 请求不产生 500，任务状态与落库一致', async () => {
    const response = await postAgent(
      post('http://localhost/api/agent', {
        agentType: 'selection',
        chain: true,
        input: {
          products: [
            { name: 'Desk Lamp', category: 'home', price: 39.9, cost: 12.5, sales: 500 },
            { name: 'Wireless Mouse', category: 'electronics', price: 29.9, cost: 9.9, sales: 800 },
          ],
        },
      }, aliceToken)
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.taskId).toMatch(/^\d+$/)
    expect(['completed', 'failed']).toContain(body.data.status)
    expect(repo().findById(Number(body.data.taskId))!.status).toBe(body.data.status)
  })

  test('五个业务页的真实提交载荷都能创建任务并原样落库（契约层）', async () => {
    const payloads: Array<{ agentType: string; input: Record<string, unknown> }> = [
      { agentType: 'selection', input: { category: 'home', region: 'us', keyword: 'storage box' } },
      { agentType: 'store-builder', input: { action: 'create' } },
      { agentType: 'content', input: { language: 'en', productId: '1' } },
      {
        agentType: 'ad-optimizer',
        input: {
          adData: {
            campaigns: [
              { id: 'c1', platform: 'facebook', spend: 100, revenue: 300, impressions: 1000, clicks: 50, conversions: 10 },
            ],
          },
        },
      },
      { agentType: 'fulfillment', input: { action: 'sync' } },
      { agentType: 'customer-service', input: { message: '你好', language: 'zh' } },
    ]

    // 页面真实载荷依赖真实商品/订单库；空库按新契约返回 400 EMPTY_*。
    seedDemoData(db)

    for (const payload of payloads) {
      const response = await postAgent(
        post('http://localhost/api/agent', payload, aliceToken)
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.taskId).toMatch(/^\d+$/)
      expect(body.data.displayId).toMatch(/^TSK-\d{8}\d+$/)
      const row = repo().findById(Number(body.data.taskId))!
      expect(row.agent_type).toBe(payload.agentType)
      expect(row.status).toBe(body.data.status)
    }
  })

  test('失败执行落库 failed 并写入 error；五步进度中首步 failed、其余 pending', async () => {
    const response = await postAgent(
      post('http://localhost/api/agent', { agentType: 'selection', input: {} }, aliceToken)
    )
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.data.status).toBe('failed')

    const row = repo().findById(Number(body.data.taskId))!
    expect(row.status).toBe('failed')
    expect(row.error).toBeTruthy()

    const progress = getTaskProgress(body.data.taskId)!
    expect(progress.taskStatus).toBe('failed')
    expect(progress.steps).toHaveLength(5)
    expect(progress.steps[0].status).toBe('failed')
    expect(progress.steps.slice(1).every((step) => step.status === 'pending')).toBe(true)
  })
})

describe('[C-01] 五步 progress 与任务日志列表/详情一致性', () => {
  test('执行后 progress 返回五步且全部 completed，displayId 与 POST 响应一致', async () => {
    const created = await (await postAgent(
      post('http://localhost/api/agent', {
        agentType: 'customer-service',
        input: { message: '退货怎么处理？', language: 'zh' },
      }, aliceToken)
    )).json()

    const response = await getProgress(
      get(`http://localhost/api/agent/progress?taskId=${created.data.taskId}`, aliceToken)
    )
    const progress = await response.json()

    expect(response.status).toBe(200)
    expect(progress.data.taskId).toBe(created.data.taskId)
    expect(progress.data.displayId).toBe(created.data.displayId)
    expect(progress.data.taskStatus).toBe('completed')
    expect(progress.data.steps).toHaveLength(5)
    expect(progress.data.steps.map((s: { step: string }) => s.step)).toEqual([
      'data-collection', 'model-reasoning', 'strategy-generation', 'execution', 'result-callback',
    ])
    expect(progress.data.steps.every((s: { step: string; status: string }) => s.status === (['model-reasoning', 'execution'].includes(s.step) ? 'pending' : 'completed'))).toBe(true)
  })

  test('task-logs 列表按用户隔离，详情在数字 id 与 displayId 下指向同一行', async () => {
    const created = await (await postAgent(
      post('http://localhost/api/agent', {
        agentType: 'customer-service',
        input: { message: '你好', language: 'zh' },
      }, aliceToken)
    )).json()

    const list = await (await getTaskLogs(get('http://localhost/api/task-logs', aliceToken))).json()
    expect(list.success).toBe(true)
    expect(list.pagination.total).toBe(1)
    expect(list.data[0].taskId).toBe(created.data.taskId)
    expect(list.data[0].displayId).toBe(created.data.displayId)
    expect(list.data[0].status).toBe('completed')

    const bobList = await (await getTaskLogs(get('http://localhost/api/task-logs', bobToken))).json()
    expect(bobList.pagination.total).toBe(0)

    const byNumeric = await (await getTaskLogDetail(
      get(`http://localhost/api/task-logs/${created.data.taskId}`, aliceToken),
      { params: { id: created.data.taskId } }
    )).json()
    const byDisplay = await (await getTaskLogDetail(
      get(`http://localhost/api/task-logs/${created.data.displayId}`, aliceToken),
      { params: { id: created.data.displayId } }
    )).json()

    expect(byNumeric.task.task_id).toBe(created.data.taskId)
    expect(byNumeric.task.id).toBe(created.data.displayId)
    expect(byNumeric.task.steps).toHaveLength(5)
    expect(byDisplay.task.task_id).toBe(created.data.taskId)
    expect(byDisplay.task.db_id).toBe(Number(created.data.taskId))
  })

  test('legacy user_id=NULL 的历史任务不出现在任何用户列表中', () => {
    db.prepare(
      "INSERT INTO task_logs (agent_type, task_name, status) VALUES ('selection', 'legacy', 'pending')"
    ).run()
    createTask('selection', { products: [] }, aliceId)

    const rows = repo().findByUserId(aliceId, 100, 0)
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe(aliceId)
  })
})

describe('[C-01] 状态机与控制路由', () => {
  test('pause：running→paused 200；pending→paused 409；未知任务 404；无 taskId 400', async () => {
    const running = createTask('selection', {}, aliceId)
    transitionTask(running.taskId, 'running')
    const ok = await postPause(post('http://localhost/api/agent/pause', { taskId: running.taskId }, aliceToken))
    expect(ok.status).toBe(200)
    expect((await ok.json()).data.status).toBe('paused')

    const pending = createTask('selection', {}, aliceId)
    const conflict = await postPause(post('http://localhost/api/agent/pause', { taskId: pending.taskId }, aliceToken))
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).code).toBe('INVALID_STATE')

    expect((await postPause(post('http://localhost/api/agent/pause', { taskId: '99999' }, aliceToken))).status).toBe(404)
    expect((await postPause(post('http://localhost/api/agent/pause', {}, aliceToken))).status).toBe(400)
  })

  test('terminate：running→terminated；paused→terminated；pending / completed 均 409；未知 404', async () => {
    const running = createTask('selection', {}, aliceId)
    transitionTask(running.taskId, 'running')
    const ok = await postTerminate(post('http://localhost/api/agent/terminate', { taskId: running.taskId }, aliceToken))
    expect(ok.status).toBe(200)
    expect((await ok.json()).data.status).toBe('terminated')

    const paused = createTask('selection', {}, aliceId)
    transitionTask(paused.taskId, 'running')
    transitionTask(paused.taskId, 'paused')
    const fromPaused = await postTerminate(post('http://localhost/api/agent/terminate', { taskId: paused.taskId }, aliceToken))
    expect(fromPaused.status).toBe(200)
    expect((await fromPaused.json()).data.status).toBe('terminated')

    const pending = createTask('selection', {}, aliceId)
    expect((await postTerminate(post('http://localhost/api/agent/terminate', { taskId: pending.taskId }, aliceToken))).status).toBe(200)

    const completed = createTask('selection', {}, aliceId)
    transitionTask(completed.taskId, 'running')
    transitionTask(completed.taskId, 'completed')
    expect((await postTerminate(post('http://localhost/api/agent/terminate', { taskId: completed.taskId }, aliceToken))).status).toBe(409)

    expect((await postTerminate(post('http://localhost/api/agent/terminate', { taskId: '99999' }, aliceToken))).status).toBe(404)
  })

  test('retry：completed/failed/paused/terminated 可重试并生成新 taskId，原任务保持终态；pending/running 409', async () => {
    const failed = createTask('customer-service', { message: '你好', language: 'zh' }, aliceId)
    transitionTask(failed.taskId, 'running')
    transitionTask(failed.taskId, 'failed')

    const response = await postRetry(post('http://localhost/api/agent/retry', { taskId: failed.taskId }, aliceToken))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.taskId).not.toBe(failed.taskId)
    expect(data.data.taskId).toMatch(/^\d+$/)
    expect(data.data.status).toBe('completed')
    expect(repo().findById(Number(failed.taskId))!.status).toBe('failed')

    const retriedRow = repo().findById(Number(data.data.taskId))!
    expect(retriedRow.user_id).toBe(aliceId)
    expect(JSON.parse(retriedRow.input!).message).toBe('你好')

    const running = createTask('selection', {}, aliceId)
    transitionTask(running.taskId, 'running')
    expect((await postRetry(post('http://localhost/api/agent/retry', { taskId: running.taskId }, aliceToken))).status).toBe(409)

    const pending = createTask('selection', {}, aliceId)
    expect((await postRetry(post('http://localhost/api/agent/retry', { taskId: pending.taskId }, aliceToken))).status).toBe(409)
  })

  test('terminated 任务也允许 retry（终态可重跑）', async () => {
    const terminated = createTask('customer-service', { message: '物流查询', language: 'zh' }, aliceId)
    transitionTask(terminated.taskId, 'running')
    transitionTask(terminated.taskId, 'terminated')

    const retried = await retryTask(terminated.taskId)
    expect(retried.taskId).not.toBe(terminated.taskId)
    expect(retried.status).toBe('completed')
    expect(repo().findById(Number(terminated.taskId))!.status).toBe('terminated')
  })

  test('控制与查询路由：匿名 401、跨用户 404、非法 JSON 400', async () => {
    const task = createTask('selection', {}, aliceId)
    transitionTask(task.taskId, 'running')

    expect((await postPause(post('http://localhost/api/agent/pause', { taskId: task.taskId }))).status).toBe(401)
    expect((await postTerminate(post('http://localhost/api/agent/terminate', { taskId: task.taskId }))).status).toBe(401)
    expect((await postRetry(post('http://localhost/api/agent/retry', { taskId: task.taskId }))).status).toBe(401)
    expect((await getProgress(get('http://localhost/api/agent/progress?taskId=' + task.taskId, bobToken))).status).toBe(404)
    expect((await postPause(post('http://localhost/api/agent/pause', { taskId: task.taskId }, bobToken))).status).toBe(404)

    const badJson = new NextRequest('http://localhost/api/agent/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(aliceToken) },
      body: 'not-json',
    })
    expect((await postPause(badJson)).status).toBe(400)
  })

  test('服务层：非法状态抛 InvalidTaskStateError，未知任务抛 TaskNotFoundError', () => {
    const pending = createTask('selection', {}, aliceId)
    expect(() => pauseTask(pending.taskId)).toThrow(InvalidTaskStateError)
    expect(terminateTask(pending.taskId).status).toBe('terminated')
    expect(() => pauseTask('99999')).toThrow(TaskNotFoundError)
    expect(() => terminateTask('99999')).toThrow(TaskNotFoundError)
  })
})

describe('[B-06] seed 幂等与业务数据落库', () => {
  test('首次 seed 为每个用户建 1 店 3 商品 3 订单；第二次 seed 不重复写入', () => {
    const first = seedDemoData(db)
    expect(first.seeded).toBe(true)
    expect(first.shops).toBe(2)
    expect(first.products).toBe(6)
    expect(first.orders).toBe(6)

    const second = seedDemoData(db)
    expect(second.seeded).toBe(false)
    expect(new ProductRepository(db).count()).toBe(6)
    expect(new OrderRepository(db).count()).toBe(6)
  })

  test('seed 复用已有店铺，不产生重复店铺', () => {
    db.prepare(
      "INSERT INTO shops (user_id, shop_name, domain, access_token, scope, status) VALUES (?, 'existing', 'e.myshopify.com', 'tok', '', 'active')"
    ).run(aliceId)

    const result = seedDemoData(db)
    expect(result.shops).toBe(1)
    expect(new ProductRepository(db).findByShopId(1)).toHaveLength(3)
  })

  test('seed 后数据接口与仪表盘按会话用户返回真实数据', async () => {
    seedDemoData(db)

    const stats = await (await getDashboardStats(get('http://localhost/api/dashboard/stats', aliceToken))).json()
    expect(stats.hasData).toBe(true)
    expect(stats.orders).toBe(3)
    expect(stats.revenue).toBe('238.70')

    const products = await (await getData(get('http://localhost/api/data?type=products', aliceToken))).json()
    expect(products.data).toHaveLength(3)
    const bobProducts = await (await getData(get('http://localhost/api/data?type=products', bobToken))).json()
    expect(bobProducts.data).toHaveLength(3)
    const aliceShopIds = new Set(products.data.map((p: { shop_id: number }) => p.shop_id))
    expect(bobProducts.data.every((p: { shop_id: number }) => !aliceShopIds.has(p.shop_id))).toBe(true)
  })

  test('无用户时 seed 为空操作', () => {
    db.prepare('DELETE FROM sessions').run()
    db.prepare('DELETE FROM users').run()
    const result = seedDemoData(db)
    expect(result.seeded).toBe(false)
    expect(result.products).toBe(0)
  })
})

describe('[B-06] Shopify 同步', () => {
  const originalFetch = global.fetch

  function installFetch(): jest.Mock {
    const mock = jest.fn((url: string) => {
      if (url.includes('/shop.json')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ shop: { id: 1 } }) } as Response)
      }
      if (url.includes('/products.json')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({
            products: [
              { id: 1, title: 'Mug', product_type: 'home', status: 'active', variants: [{ price: '9.90', inventory_quantity: 5 }] },
              { id: 2, title: 'Tee', product_type: 'fashion', status: 'active', variants: [{ price: '19.90', inventory_quantity: 8 }] },
            ],
          }),
        } as Response)
      }
      if (url.includes('/orders.json')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({
            orders: [
              { id: 1, name: '#1001', total_price: '29.80', financial_status: 'paid', shipping_address: { name: 'Jane', country_code: 'US' } },
            ],
          }),
        } as Response)
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response)
    })
    global.fetch = mock as unknown as typeof fetch
    return mock
  }

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('导入商品/订单，二次同步按名称与订单号去重', async () => {
    const shopId = Number(db.prepare(
      "INSERT INTO shops (user_id, shop_name, domain, access_token, scope, status) VALUES (?, 'demo', 'demo.myshopify.com', 'tok', '', 'active')"
    ).run(aliceId).lastInsertRowid)
    installFetch()

    const first = await syncShopifyData('demo.myshopify.com', 'tok', shopId, db)
    expect(first.errors).toEqual([])
    expect(first.shopSynced).toBe(true)
    expect(first.products).toBe(2)
    expect(first.orders).toBe(1)

    const second = await syncShopifyData('demo.myshopify.com', 'tok', shopId, db)
    expect(second.products).toBe(0)
    expect(second.orders).toBe(0)
    expect(new ProductRepository(db).findByShopId(shopId)).toHaveLength(2)
    expect(new OrderRepository(db).findByShopId(shopId)).toHaveLength(1)
  })

  test('远端失败只收集 errors，不抛异常、不写入数据', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch
    const result = await syncShopifyData('demo.myshopify.com', 'tok', 1, db)
    expect(result.errors).toHaveLength(3)
    expect(result.products).toBe(0)
    expect(result.orders).toBe(0)
  })
})
