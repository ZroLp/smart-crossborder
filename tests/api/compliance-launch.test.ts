/**
 * P10-06 合规上线检查（RoPA/DPIA 归档台账 + 阻断项判定 + 审计联动）。
 */
import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat, installPgliteWorkerGuard } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { GET as launchCheckGET } from '@/app/api/admin/compliance-launch/route'
import { POST as archivePOST } from '@/app/api/admin/compliance-launch/archive/route'

installPgliteWorkerGuard()

let db: DbClient

function get(url: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers: { cookie: cookie ?? '' } })
}

function post(url: string, body: object, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': 'P10Test/1.0', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

/** 造 viewer 用户并登录取会话 cookie。 */
async function makeUser(username: string): Promise<{ cookie: string; userId: number }> {
  const userRepo = new UserRepository(db)
  await userRepo.create({ username, password: hashPassword('Str0ngPass!') })
  const id = Number((await userRepo.findByUsername(username))!.id)
  const res = await (await import('@/app/api/auth/route')).POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'P10Test/1.0', 'x-forwarded-for': '10.0.0.8' },
      body: JSON.stringify({ action: 'login', username, password: 'Str0ngPass!' }),
    })
  )
  const match = (res.headers.get('set-cookie') || '').match(/sumaitong_session=([^;]+)/)
  return { cookie: match ? `sumaitong_session=${match[1]}` : '', userId: id }
}

async function makeAdmin(username: string): Promise<{ cookie: string; userId: number }> {
  const created = await makeUser(username)
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', created.userId)
  return created
}

beforeEach(() => {
  db = applyDbCompat(initDatabase(':memory:'))
  resetLoginRateLimitForTests()
})

afterEach(async () => {
  await db.close()
})

describe('POST /api/admin/compliance-launch/archive', () => {
  test('匿名 → 401', async () => {
    const res = await archivePOST(post('/api/admin/compliance-launch/archive', { kind: 'ropa', title: 'x', payload: {} }))
    expect(res.status).toBe(401)
  })

  test('viewer → 403', async () => {
    const alice = await makeUser('alice')
    const res = await archivePOST(post('/api/admin/compliance-launch/archive', { kind: 'ropa', title: 'x', payload: {} }, alice.cookie))
    expect(res.status).toBe(403)
  })

  test('kind 非法 → 400 INVALID_KIND', async () => {
    const root = await makeAdmin('root')
    const res = await archivePOST(post('/api/admin/compliance-launch/archive', { kind: 'unknown', title: 'x' }, root.cookie))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'INVALID_KIND' })
  })

  test('缺 title → 400 MISSING_TITLE', async () => {
    const root = await makeAdmin('root')
    const res = await archivePOST(post('/api/admin/compliance-launch/archive', { kind: 'ropa', title: '  ' }, root.cookie))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'MISSING_TITLE' })
  })

  test('归档 ropa + dpia → 201 且带 id', async () => {
    const root = await makeAdmin('root')
    for (const [kind, title] of [['ropa', '处理活动记录 2026'], ['dpia', 'AI 推荐 DPIA 2026']] as const) {
      const res = await archivePOST(post('/api/admin/compliance-launch/archive', { kind, title, payload: { version: '2026-Q4' } }, root.cookie))
      expect(res.status).toBe(201)
      expect((await res.json()).data.id).toBeTruthy()
    }
  })
})

describe('GET /api/admin/compliance-launch', () => {
  test('匿名 → 401', async () => {
    expect((await launchCheckGET(get('/api/admin/compliance-launch'))).status).toBe(401)
  })

  test('无归档 → ropa/dpia 阻断，pass=false', async () => {
    const root = await makeAdmin('root')
    const res = await launchCheckGET(get('/api/admin/compliance-launch', root.cookie))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { pass: boolean; checks: Array<{ id: string; ok: boolean; blocking: boolean }> } }
    expect(body.data.pass).toBe(false)
    const byId = Object.fromEntries(body.data.checks.map((c) => [c.id, c]))
    expect(byId.ropa_archived.ok).toBe(false)
    expect(byId.dpia_archived.ok).toBe(false)
    expect(byId.ropa_archived.blocking).toBe(true)
  })

  test('归档齐全 + 无违约 → pass=true 且五项检查全绿', async () => {
    const root = await makeAdmin('root')
    for (const [kind, title] of [['ropa', 'RoPA 2026'], ['dpia', 'DPIA 2026']] as const) {
      await archivePOST(post('/api/admin/compliance-launch/archive', { kind, title, payload: {} }, root.cookie))
    }
    const res = await launchCheckGET(get('/api/admin/compliance-launch', root.cookie))
    const body = await res.json() as { data: { pass: boolean; checks: Array<{ ok: boolean }>; archives: Array<{ kind: string }> } }
    expect(body.data.checks.every((c) => c.ok)).toBe(true)
    expect(body.data.pass).toBe(true)
    expect(new Set(body.data.archives.map((a) => a.kind)).size).toBe(2)
  })

  test('DSAR 超 30 天 SLA → dsar_sla 阻断', async () => {
    const root = await makeAdmin('root')
    for (const [kind, title] of [['ropa', 'RoPA'], ['dpia', 'DPIA']] as const) {
      await archivePOST(post('/api/admin/compliance-launch/archive', { kind, title }, root.cookie))
    }
    await db
      .prepare(`INSERT INTO dsar_requests (user_id, dsar_type, status, sla_due_at) VALUES (?, 'access', 'pending', now() - interval '2 days')`)
      .run(root.userId)
    const body = (await launchCheckGET(get('/api/admin/compliance-launch', root.cookie)).then((r) => r.json())) as {
      data: { pass: boolean; checks: Array<{ id: string; ok: boolean; blocking: boolean }> }
    }
    const dsar = body.data.checks.find((c) => c.id === 'dsar_sla')!
    expect(dsar.ok).toBe(false)
    expect(dsar.blocking).toBe(true)
    expect(body.data.pass).toBe(false)
  })

  test('泄露 72h 逾期（open 且 deadline 已过）→ breach_72h 阻断', async () => {
    const root = await makeAdmin('root')
    for (const [kind, title] of [['ropa', 'RoPA'], ['dpia', 'DPIA']] as const) {
      await archivePOST(post('/api/admin/compliance-launch/archive', { kind, title }, root.cookie))
    }
    await db
      .prepare(`INSERT INTO breach_reports (user_id, description, notification_deadline_at, status) VALUES (?, 'db leak', now() - interval '1 hour', 'open')`)
      .run(root.userId)
    const body = (await launchCheckGET(get('/api/admin/compliance-launch', root.cookie)).then((r) => r.json())) as {
      data: { checks: Array<{ id: string; ok: boolean }> }
    }
    const breach = body.data.checks.find((c) => c.id === 'breach_72h')!
    expect(breach.ok).toBe(false)
  })

  test('归档写入产生审计记录（P8-02 联动）', async () => {
    const root = await makeAdmin('root')
    await archivePOST(post('/api/admin/compliance-launch/archive', { kind: 'ropa', title: 'RoPA 2027', payload: {} }, root.cookie))
    const row = await db.prepare(`SELECT count(*) AS count FROM admin_audit_logs WHERE action = ?`).get('compliance.archive.ropa')
    expect(Number((row as { count: number }).count)).toBe(1)
  })
})
