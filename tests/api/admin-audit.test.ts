/**
 * P8 后台验收测试：
 * - P8-02 写操作审计（before/after）：改角色/订阅/泄露建档写审计，GET /api/admin/audit 倒序列表
 * - P8-01 管理后台独立登录（仅 admin 可登录，登录成功写 admin.login 审计）
 * - P8-03 监控运营一屏聚合（/api/admin/monitor）
 * - 路由修复：POST /api/admin/users/role 端点存在且可用
 */
import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat, installPgliteWorkerGuard } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { createCheckout } from '@/lib/payment/payment-service'
import { POST as adminLoginPOST } from '@/app/api/admin/login/route'
import { POST as adminUsersPOST } from '@/app/api/admin/users/route'
import { POST as adminUserRolePOST } from '@/app/api/admin/users/role/route'
import { POST as usersRolePOST } from '@/app/api/users/role/route'
import { POST as breachPOST } from '@/app/api/admin/breach/route'
import { GET as adminAuditGET } from '@/app/api/admin/audit/route'
import { GET as adminMonitorGET } from '@/app/api/admin/monitor/route'
import { POST as subscriptionPOST } from '@/app/api/subscription/route'
import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { POST as confirmPOST } from '@/app/api/payments/[id]/confirm/route'

installPgliteWorkerGuard()

let db: DbClient

function post(url: string, body: object, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'P8Test/1.0',
      'x-forwarded-for': '10.0.0.8',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function get(url: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers: { cookie: cookie ?? '' } })
}

/** 建 viewer 用户并登录取会话 cookie。 */
async function makeUser(username: string): Promise<{ cookie: string; userId: number }> {
  const userRepo = new UserRepository(db)
  await userRepo.create({ username, password: hashPassword('Str0ngPass!') })
  const id = Number((await userRepo.findByUsername(username))!.id)
  const res = await (await import('@/app/api/auth/route')).POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'P8Test/1.0', 'x-forwarded-for': '10.0.0.8' },
      body: JSON.stringify({ action: 'login', username, password: 'Str0ngPass!' }),
    })
  )
  const match = (res.headers.get('set-cookie') || '').match(/sumaitong_session=([^;]+)/)
  return { cookie: match ? `sumaitong_session=${match[1]}` : '', userId: id }
}

/** 建 admin 用户（造号后直接提权）并登录取会话 cookie。 */
async function makeAdmin(username: string): Promise<{ cookie: string; userId: number }> {
  const created = await makeUser(username)
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', created.userId)
  return created
}

async function fetchAudit(cookie: string): Promise<{ status: number; logs: any[] }> {
  const res = await adminAuditGET(get('/api/admin/audit', cookie))
  const body = await res.json()
  return { status: res.status, logs: body.success ? (body.data?.logs ?? []) : [] }
}

beforeEach(() => {
  db = applyDbCompat(initDatabase(':memory:'))
  resetLoginRateLimitForTests()
})

afterEach(async () => {
  await db.close()
})

describe('P8-02 写操作审计（before/after）', () => {
  test('admin 经 POST /api/admin/users/role 改角色 → 审计含 role 变更前/后值', async () => {
    const alice = await makeUser('alice')
    const root = await makeAdmin('root')

    const res = await adminUserRolePOST(post('/api/admin/users/role', { userId: alice.userId, role: 'operator' }, root.cookie))
    expect(res.status).toBe(200)

    const { status, logs } = await fetchAudit(root.cookie)
    expect(status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('user.role_changed')
    expect(logs[0].resource).toBe('user')
    expect(logs[0].resource_id).toBe(String(alice.userId))
    expect(logs[0].actor_id).toBe(root.userId)
    expect(JSON.parse(logs[0].before_json).user.role).toBe('viewer')
    expect(JSON.parse(logs[0].after_json).user.role).toBe('operator')
  })

  test('旧端点 POST /api/admin/users 改角色同样写审计', async () => {
    const bob = await makeUser('bob')
    const root = await makeAdmin('root')

    const res = await adminUsersPOST(post('/api/admin/users', { userId: bob.userId, role: 'operator' }, root.cookie))
    expect(res.status).toBe(200)

    const { logs } = await fetchAudit(root.cookie)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('user.role_changed')
  })

  test('POST /api/users/role 改角色写审计（actor 为调用者）', async () => {
    const carol = await makeUser('carol')
    const root = await makeAdmin('root')

    const res = await usersRolePOST(post('/api/users/role', { userId: carol.userId, role: 'viewer' }, root.cookie))
    expect(res.status).toBe(200)

    const { logs } = await fetchAudit(root.cookie)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('user.role_changed')
    expect(logs[0].actor_id).toBe(root.userId)
  })

  test('订阅 cancel/restore 审计 before/after 为该用户订阅行', async () => {
    const bob = await makeUser('bob')
    const checkoutRes = await checkoutPOST(post('/api/checkout', { plan: 'basic' }, bob.cookie))
    const checkout = await checkoutRes.json()
    await confirmPOST(post(`/api/payments/${checkout.data.paymentId}/confirm`, {}, bob.cookie), { params: { id: checkout.data.paymentId } })

    const cancelled = await subscriptionPOST(post('/api/subscription', { action: 'cancel' }, bob.cookie))
    expect(cancelled.status).toBe(200)

    const root = await makeAdmin('root')
    const { logs } = await fetchAudit(root.cookie)
    const entry = logs.find((l) => l.action === 'subscription.cancel')
    expect(entry).toBeDefined()
    expect(JSON.parse(entry.before_json).cancel_at_period_end).toBe(false)
    expect(JSON.parse(entry.after_json).cancel_at_period_end).toBe(true)

    const restored = await subscriptionPOST(post('/api/subscription', { action: 'restore' }, bob.cookie))
    expect(restored.status).toBe(200)
    const logs2 = (await fetchAudit(root.cookie)).logs
    const restoreEntry = logs2.find((l) => l.action === 'subscription.restore')
    expect(JSON.parse(restoreEntry.after_json).cancel_at_period_end).toBe(false)
  })

  test('泄露建档写审计：before 恒为 null，after 为新记录字段', async () => {
    const root = await makeAdmin('root')
    const res = await breachPOST(post('/api/admin/breach', { description: 'DB dump leaked' }, root.cookie))
    expect(res.status).toBe(201)

    const { logs } = await fetchAudit(root.cookie)
    const entry = logs.find((l) => l.action === 'breach.create')
    expect(entry).toBeDefined()
    expect(entry.before_json).toBeNull()
    const after = JSON.parse(entry.after_json)
    expect(after.status).toBe('open')
    expect(after.description).toBe('DB dump leaked')
  })
})

describe('P8-02 审计端点鉴权', () => {
  test('GET /api/admin/audit 匿名 401 / viewer 403', async () => {
    expect((await adminAuditGET(get('/api/admin/audit'))).status).toBe(401)
    const viewer = await makeUser('viewer1')
    expect((await adminAuditGET(get('/api/admin/audit', viewer.cookie))).status).toBe(403)
  })

  test('viewer 调 POST /api/admin/users/role → 403', async () => {
    const viewer = await makeUser('viewer2')
    const res = await adminUserRolePOST(post('/api/admin/users/role', { userId: viewer.userId, role: 'admin' }, viewer.cookie))
    expect(res.status).toBe(403)
  })
})

describe('P8-01 管理后台独立登录', () => {
  test('admin 用户登录成功（200 + set-cookie + success）', async () => {
    await makeAdmin('boss')
    const res = await adminLoginPOST(post('/api/admin/login', { username: 'boss', password: 'Str0ngPass!' }))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(res.headers.get('set-cookie') || '').toContain('sumaitong_session=')
  })

  test('viewer 用户登录后台 → 401 INVALID_CREDENTIALS', async () => {
    await makeUser('low')
    const res = await adminLoginPOST(post('/api/admin/login', { username: 'low', password: 'Str0ngPass!' }))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('INVALID_CREDENTIALS')
  })

  test('错误密码 / 未知用户 → 401 INVALID_CREDENTIALS（同码不区分）', async () => {
    await makeAdmin('boss2')
    const wrong = await adminLoginPOST(post('/api/admin/login', { username: 'boss2', password: 'WrongPass!' }))
    expect(wrong.status).toBe(401)
    expect((await wrong.json()).code).toBe('INVALID_CREDENTIALS')

    const ghost = await adminLoginPOST(post('/api/admin/login', { username: 'ghost', password: 'Str0ngPass!' }))
    expect(ghost.status).toBe(401)
    expect((await ghost.json()).code).toBe('INVALID_CREDENTIALS')
  })

  test('登录成功后写 admin.login 审计', async () => {
    const boss = await makeAdmin('boss3')
    const res = await adminLoginPOST(post('/api/admin/login', { username: 'boss3', password: 'Str0ngPass!' }))
    expect(res.status).toBe(200)

    const { logs } = await fetchAudit(boss.cookie)
    const entry = logs.find((l) => l.action === 'admin.login')
    expect(entry).toBeDefined()
    expect(JSON.parse(entry.after_json).username).toBe('boss3')
    expect(entry.before_json).toBeNull()
  })
})

describe('P8-03 监控运营一屏', () => {
  test('GET /api/admin/monitor 匿名 401 / viewer 403', async () => {
    expect((await adminMonitorGET(get('/api/admin/monitor'))).status).toBe(401)
    const viewer = await makeUser('mviewer')
    expect((await adminMonitorGET(get('/api/admin/monitor', viewer.cookie))).status).toBe(403)
  })

  test('聚合 tasks/users/payments/subscriptions/dunning/audit（造 1 任务 + 1 支付验证计数）', async () => {
    const boss = await makeAdmin('boss4')
    const guest = await makeUser('guest4')
    await db.prepare("INSERT INTO task_logs (agent_type, task_name, status) VALUES ('builder', 'p8-test', 'pending')").run()
    await createCheckout(db, guest.userId, 'basic')

    const res = await adminMonitorGET(get('/api/admin/monitor', boss.cookie))
    expect(res.status).toBe(200)
    const data = (await res.json()).data
    expect(data.tasks.last24h).toBe(1)
    expect(data.tasks.total).toBe(1)
    expect(data.tasks.byStatus.pending).toBe(1)
    expect(data.users).toBe(2)
    expect(data.payments).toBe(1)
    expect(data.subscriptions).toBe(0)
    expect(data.dunning).toBe(0)
    expect(Array.isArray(data.audit)).toBe(true)
    expect(data.audit.length).toBeLessThanOrEqual(10)
  })
})

describe('路由修复：POST /api/admin/users/role 端点', () => {
  test('端点存在且可用（200 + 库内角色已更新），历史 404 消除', async () => {
    expect(typeof adminUserRolePOST).toBe('function')
    const dave = await makeUser('dave')
    const root = await makeAdmin('rootfix')

    const res = await adminUserRolePOST(post('/api/admin/users/role', { userId: dave.userId, role: 'operator' }, root.cookie))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)

    const row = (await db.prepare('SELECT role FROM users WHERE id = ?').get(dave.userId)) as { role: string }
    expect(row.role).toBe('operator')
  })
})
