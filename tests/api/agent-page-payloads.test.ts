import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { TaskLogRepository } from '@/lib/db/task-log-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { resetTaskRuntimeForTests } from '@/lib/agents/task-service'

const mockExecuteTask = jest.fn()
const mockExecuteChain = jest.fn()

jest.mock('@/lib/api/agent-service', () => {
  const actual = jest.requireActual('@/lib/api/agent-service')
  return {
    ...actual,
    getOrchestrator: jest.fn(() => ({
      executeTask: mockExecuteTask,
      executeChain: mockExecuteChain,
    })),
  }
})

import { POST as postAgent } from '@/app/api/agent/route'

let db: Database.Database
let dataToken: string
let emptyToken: string

function post(body: unknown, token: string): NextRequest {
  return new NextRequest('http://localhost/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${token}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  jest.clearAllMocks()
  resetTaskRuntimeForTests()
  mockExecuteTask.mockResolvedValue({ success: true, data: { ok: true } })
  mockExecuteChain.mockResolvedValue([{ success: true, data: {} }])

  const users = new UserRepository(db)
  const dataUser = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  dataToken = createSession(dataUser, db)
  seedDemoData(db)
  // bob 在 seed 之后创建，因此其商品/订单库为空
  const emptyUser = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  emptyToken = createSession(emptyUser, db)
})

afterEach(() => {
  db.close()
})

const PAGE_PAYLOADS: Array<{ agentType: string; input: Record<string, unknown> }> = [
  { agentType: 'selection', input: { category: 'home', region: 'us', keyword: 'storage box' } },
  { agentType: 'store-builder', input: { action: 'create', templateId: 'tpl-001' } },
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

describe('POST /api/agent with real page payloads (task-13)', () => {
  test.each(PAGE_PAYLOADS)('$agentType payload adapts and creates a completed task', async ({ agentType, input }) => {
    const response = await postAgent(post({ agentType, input }, dataToken))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.taskId).toMatch(/^\d+$/)
    expect(body.data.status).toBe('completed')
    expect(body.data.agentType).toBe(agentType)

    const row = new TaskLogRepository(db).findById(Number(body.data.taskId))!
    expect(row.agent_type).toBe(agentType)
    expect(row.status).toBe('completed')
  })

  test('selection payload passes adapted products to the orchestrator', async () => {
    await postAgent(post(PAGE_PAYLOADS[0], dataToken))

    const passedInput = mockExecuteTask.mock.calls[0][1] as { products: Array<{ name: string }> }
    expect(Array.isArray(passedInput.products)).toBe(true)
    expect(passedInput.products.length).toBeGreaterThan(0)
    expect(passedInput.products[0].name).toBeTruthy()
  })

  test('store-builder/content/fulfillment receive their native fields', async () => {
    for (const payload of PAGE_PAYLOADS.slice(1, 3)) {
      await postAgent(post(payload, dataToken))
    }
    await postAgent(post(PAGE_PAYLOADS[4], dataToken))

    const storeInput = mockExecuteTask.mock.calls[0][1] as { selectedProducts: unknown[] }
    const contentInput = mockExecuteTask.mock.calls[1][1] as { products: unknown[] }
    const fulfillmentInput = mockExecuteTask.mock.calls[2][1] as { order: { orderNumber: string } }

    expect(storeInput.selectedProducts).toHaveLength(3)
    expect(contentInput.products).toHaveLength(1)
    expect(fulfillmentInput.order.orderNumber).toBeTruthy()
  })

  test('empty product/order library returns 400 with actionable codes and no task row', async () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['selection', { category: 'home' }, 'EMPTY_PRODUCT_LIBRARY'],
      ['store-builder', { action: 'create' }, 'EMPTY_PRODUCT_LIBRARY'],
      ['content', { language: 'en', productId: '1' }, 'EMPTY_PRODUCT_LIBRARY'],
      ['fulfillment', { action: 'sync' }, 'EMPTY_ORDER_LIBRARY'],
    ]

    for (const [agentType, input, code] of cases) {
      const response = await postAgent(post({ agentType, input }, emptyToken))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.code).toBe(code)
      expect(body.hint).toBeTruthy()
    }

    expect(new TaskLogRepository(db).count()).toBe(0)
  })

  test('chain:true still runs executeChain and completes', async () => {
    const response = await postAgent(
      post(
        {
          agentType: 'selection',
          chain: true,
          input: {
            products: [
              { name: 'Desk Lamp', category: 'home', price: 39.9, cost: 12.5, sales: 500 },
              { name: 'Wireless Mouse', category: 'electronics', price: 29.9, cost: 9.9, sales: 800 },
            ],
          },
        },
        dataToken
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('completed')
    expect(mockExecuteChain).toHaveBeenCalledTimes(1)
    // 单 Agent 语义：非 chain 请求不会调用 executeChain
    expect(mockExecuteTask).not.toHaveBeenCalled()
  })
})
