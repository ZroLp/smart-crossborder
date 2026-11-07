/**
 * P0-C-02 独立验收测试（qa-verifier）
 *
 * 覆盖：会话 Cookie 属性、token 仅存哈希、过期清理、logout 契约、
 * show 伪造 userId/header 无效、admin 401/403、跨用户 404、
 * 改密吊销其他会话并保留当前会话。
 *
 * 本文件基于真实 SQLite（:memory:）与真实路由处理函数，不 mock 业务实现。
 */
import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSession,
  hashSessionToken,
} from '@/lib/auth/session'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { createTask } from '@/lib/agents/task-service'
import { resetOrchestrator } from '@/lib/api/agent-service'
import { GET as authGet, POST as authPost } from '@/app/api/auth/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { POST as changePassword } from '@/app/api/auth/password/route'
import { GET as adminUsersGet, POST as adminUsersPost } from '@/app/api/admin/users/route'
import { GET as adminShopsGet } from '@/app/api/admin/shops/route'
import { GET as adminStatsGet } from '@/app/api/admin/stats/route'
import { GET as usersAllGet } from '@/app/api/users/all/route'
import { POST as usersRolePost } from '@/app/api/users/role/route'
import { GET as shopGet } from '@/app/api/shop/route'
import { GET as taskLogsGet } from '@/app/api/task-logs/route'
import { GET as taskLogDetailGet } from '@/app/api/task-logs/[id]/route'
import { GET as dataGet } from '@/app/api/data/route'
import { GET as dashboardStatsGet } from '@/app/api/dashboard/stats/route'

let db: Database.Database
let adminId: number
let viewerId: number
let otherId: number
let viewerToken: string
let adminToken: string
let otherToken: string


function req(
  url: string,
  options: { token?: string; method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  if (options.token) headers.cookie = `${SESSION_COOKIE_NAME}=${options.token}`
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(url, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

function cookieOf(response: { cookies: { get(name: string): { value: string } | undefined } }) {
  return response.cookies.get(SESSION_COOKIE_NAME)
}

async function login(username: string, password: string, ip = '10.0.0.1') {
  return authPost(
    req('http://localhost/api/auth', {
      method: 'POST',
      body: { action: 'login', username, password },
      headers: { 'x-forwarded-for': ip },
    })
  )
}

beforeEach(() => {
  db = initDatabase(':memory:')
  resetOrchestrator()
  resetLoginRateLimitForTests()
  delete process.env.AUTH_LEGACY_COMPAT
  const users = new UserRepository(db)
  adminId = Number(users.create({ username: 'root', password: 'x', email: 'root@t.com', role: 'admin' }).lastInsertRowid)
  viewerId = Number(users.create({ username: 'alice', password: 'x', email: 'a@t.com', role: 'viewer' }).lastInsertRowid)
  otherId = Number(users.create({ username: 'bob', password: 'x', email: 'b@t.com', role: 'viewer' }).lastInsertRowid)
  adminToken = createSession(adminId, db)
  viewerToken = createSession(viewerId, db)
  otherToken = createSession(otherId, db)
})

afterEach(() => {
  resetOrchestrator()
  delete process.env.AUTH_LEGACY_COMPAT
  db.close()
})

describe('[C-02] 会话存储与 Cookie 属性', () => {
  test('登录响应下发 HttpOnly/Lax/Path=/ Cookie，DB 只存 SHA-256 哈希且不在响应体中泄露 token', async () => {
    const registered = await authPost(
      req('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'register', username: 'dave', password: 'Passw0rd123' },
        headers: { 'x-forwarded-for': '10.0.0.20' },
      })
    )
    expect((await registered.json()).success).toBe(true)

    const response = await login('dave', 'Passw0rd123', '10.0.0.21')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBeGreaterThan(0)
    expect(data.role).toBe('viewer')
    expect(JSON.stringify(data)).not.toContain('token')

    const cookie = cookieOf(response)
    expect(cookie?.value).toMatch(/^[0-9a-f]{64}$/)
    expect((cookie as { httpOnly?: boolean }).httpOnly).toBe(true)
    expect((cookie as { sameSite?: string }).sameSite).toBe('lax')
    expect((cookie as { path?: string }).path).toBe('/')
    expect((cookie as { maxAge?: number }).maxAge).toBe(Math.floor(SESSION_TTL_MS / 1000))

    const row = db
      .prepare('SELECT token_hash FROM sessions WHERE token_hash = ?')
      .get(hashSessionToken(cookie!.value)) as { token_hash: string } | undefined
    expect(row).toBeTruthy()
    expect(row!.token_hash).not.toBe(cookie!.value)
    // beforeEach 3 个 + 注册 1 个 + 登录 1 个
    expect(db.prepare('SELECT COUNT(*) c FROM sessions').get()).toEqual({ c: 5 })
  })

  test('GET /api/auth：无会话 401；带有效会话返回服务端用户与角色', async () => {
    expect((await authGet(req('http://localhost/api/auth'))).status).toBe(401)

    const ok = await authGet(req('http://localhost/api/auth', { token: viewerToken }))
    const data = await ok.json()
    expect(ok.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.user.id).toBe(viewerId)
    expect(data.user.role).toBe('viewer')
    expect(data.role).toBe('viewer')
    expect(data.user.password).toBeUndefined()
  })

  test('Cookie 篡改 / 未知 token / 无 token 一律 401', async () => {
    const tampered = viewerToken.slice(0, -1) + (viewerToken.endsWith('a') ? 'b' : 'a')
    expect((await authGet(req('http://localhost/api/auth', { token: tampered }))).status).toBe(401)
    expect((await authGet(req('http://localhost/api/auth', { token: 'deadbeef'.repeat(8) }))).status).toBe(401)
    expect((await authGet(req('http://localhost/api/auth'))).status).toBe(401)
  })

  test('过期会话 401 且记录被清理', async () => {
    const expired = 'expired-token-value'
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      hashSessionToken(expired),
      viewerId,
      Date.now() - 1000
    )

    expect((await authGet(req('http://localhost/api/auth', { token: expired }))).status).toBe(401)
    expect(
      db.prepare('SELECT COUNT(*) c FROM sessions WHERE token_hash = ?').get(hashSessionToken(expired))
    ).toEqual({ c: 0 })
  })
})

describe('[C-02] logout 契约', () => {
  test('实际实现为 POST /api/auth {action:"logout"}：200 + 清除 Cookie，之后受保护接口 401', async () => {
    const response = await authPost(
      req('http://localhost/api/auth', { method: 'POST', body: { action: 'logout' }, token: viewerToken })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    const cookie = cookieOf(response)
    expect(cookie?.value).toBe('')
    expect((cookie as { maxAge?: number }).maxAge).toBe(0)

    expect((await authGet(req('http://localhost/api/auth', { token: viewerToken }))).status).toBe(401)
    expect((await taskLogsGet(req('http://localhost/api/task-logs', { token: viewerToken }))).status).toBe(401)
    expect((await adminUsersGet(req('http://localhost/api/admin/users', { token: viewerToken }))).status).toBe(401)
  })

  test('logout 只销毁当前会话，其他设备会话仍有效', async () => {
    const secondToken = createSession(viewerId, db)
    await authPost(
      req('http://localhost/api/auth', { method: 'POST', body: { action: 'logout' }, token: viewerToken })
    )

    expect((await authGet(req('http://localhost/api/auth', { token: viewerToken }))).status).toBe(401)
    expect((await authGet(req('http://localhost/api/auth', { token: secondToken }))).status).toBe(200)
  })

  test('POST /api/auth/logout 独立路由也可用（幂等，清 Cookie 并销毁当前会话）', async () => {
    const response = await logoutPost(
      req('http://localhost/api/auth/logout', { method: 'POST', token: viewerToken })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(cookieOf(response)?.value).toBe('')
    expect((await authGet(req('http://localhost/api/auth', { token: viewerToken }))).status).toBe(401)

    // 幂等：无会话时也返回 200
    const anonymous = await logoutPost(req('http://localhost/api/auth/logout', { method: 'POST' }))
    expect(anonymous.status).toBe(200)
    expect((await anonymous.json()).success).toBe(true)
  })

  test('未知 action 返回 400（logout 历史兼容入口仍被识别）', async () => {
    const unknown = await authPost(
      req('http://localhost/api/auth', { method: 'POST', body: { action: 'logout-all' }, token: viewerToken })
    )
    expect(unknown.status).toBe(400)
    expect((await unknown.json()).code).toBe('INVALID_INPUT')

    const legacy = await authPost(
      req('http://localhost/api/auth', { method: 'POST', body: { action: 'logout' }, token: viewerToken })
    )
    expect(legacy.status).toBe(200)
  })
})

describe('[C-02] 匿名 / 角色 / admin 边界', () => {
  test('admin 接口：匿名 401、viewer 403、admin 200', async () => {
    for (const call of [
      () => adminUsersGet(req('http://localhost/api/admin/users')),
      () => adminShopsGet(req('http://localhost/api/admin/shops')),
      () => adminStatsGet(req('http://localhost/api/admin/stats')),
    ]) {
      expect((await call()).status).toBe(401)
    }

    expect((await adminUsersGet(req('http://localhost/api/admin/users', { token: viewerToken }))).status).toBe(403)
    expect((await adminShopsGet(req('http://localhost/api/admin/shops', { token: viewerToken }))).status).toBe(403)
    expect((await adminStatsGet(req('http://localhost/api/admin/stats', { token: viewerToken }))).status).toBe(403)

    expect((await adminUsersGet(req('http://localhost/api/admin/users', { token: adminToken }))).status).toBe(200)
    expect((await adminShopsGet(req('http://localhost/api/admin/shops', { token: adminToken }))).status).toBe(200)
    expect((await adminStatsGet(req('http://localhost/api/admin/stats', { token: adminToken }))).status).toBe(200)
    expect((await usersAllGet(req('http://localhost/api/users/all', { token: viewerToken }))).status).toBe(403)
    expect((await usersAllGet(req('http://localhost/api/users/all', { token: adminToken }))).status).toBe(200)
  })

  test('伪造 userId：query / body / x-user-id 在无会话时全部无效（默认关闭 legacy）', async () => {
    expect(
      (await adminUsersGet(req(`http://localhost/api/admin/users?userId=${adminId}`))).status
    ).toBe(401)
    expect(
      (await adminUsersGet(
        req('http://localhost/api/admin/users', { headers: { 'x-user-id': String(adminId) } })
      )).status
    ).toBe(401)
    expect(
      (
        await adminUsersPost(
          req('http://localhost/api/admin/users', {
            method: 'POST',
            body: { userId: viewerId, role: 'admin' },
            headers: { 'x-user-id': String(adminId) },
          })
        )
      ).status
    ).toBe(401)
  })

  test('viewer 会话携带 admin userId/请求头不能提权', async () => {
    // query 参数被忽略，仍按 viewer 判定
    expect(
      (await adminUsersGet(req(`http://localhost/api/admin/users?userId=${adminId}`, { token: viewerToken }))).status
    ).toBe(403)
    expect(
      (await adminUsersGet(
        req('http://localhost/api/admin/users', {
          token: viewerToken,
          headers: { 'x-user-id': String(adminId) },
        })
      )).status
    ).toBe(403)

    // 自提权：viewer 调改角色接口
    const escalate = await usersRolePost(
      req('http://localhost/api/users/role', { method: 'POST', body: { userId: viewerId, role: 'admin' }, token: viewerToken })
    )
    expect(escalate.status).toBe(403)
    expect((await adminUsersGet(req('http://localhost/api/admin/users', { token: viewerToken }))).status).toBe(403)
  })

  test('body.userId 与他人不一致时 403（agent / 改密 / shop）', async () => {
    const agent = await (
      await import('@/app/api/agent/route')
    ).POST(
      req('http://localhost/api/agent', {
        method: 'POST',
        token: viewerToken,
        body: { agentType: 'customer-service', input: { message: 'hi' }, userId: otherId },
      })
    )
    expect(agent.status).toBe(403)

    const pwd = await changePassword(
      req('http://localhost/api/auth/password', {
        method: 'POST',
        token: viewerToken,
        body: { userId: otherId, currentPassword: 'x', newPassword: 'newpass123' },
      })
    )
    expect(pwd.status).toBe(403)

    const shop = await (
      await import('@/app/api/shop/route')
    ).POST(
      req('http://localhost/api/shop', {
        method: 'POST',
        token: viewerToken,
        body: { userId: otherId, shopName: 'x', domain: 'x.myshopify.com', accessToken: 't' },
      })
    )
    expect(shop.status).toBe(403)
  })

  test('admin 修改角色后，现有会话立即读到新角色', async () => {
    const change = await adminUsersPost(
      req('http://localhost/api/admin/users', {
        method: 'POST',
        token: adminToken,
        body: { userId: viewerId, role: 'operator' },
      })
    )
    expect(change.status).toBe(200)

    const me = await (await authGet(req('http://localhost/api/auth', { token: viewerToken }))).json()
    expect(me.role).toBe('operator')
    // operator 仍不能进 admin 接口
    expect((await adminUsersGet(req('http://localhost/api/admin/users', { token: viewerToken }))).status).toBe(403)
  })
})

describe('[C-02] 跨用户数据隔离', () => {
  test('任务/店铺/业务数据按会话用户隔离，跨用户详情 404', async () => {
    const shopRepo = new ShopRepository(db)
    const otherShop = shopRepo.create({
      user_id: otherId,
      shop_name: 'bob shop',
      domain: 'bob.myshopify.com',
      access_token: 'tok',
      scope: '',
      status: 'active',
    })
    expect(otherShop.lastInsertRowid).toBeTruthy()
    const ownTask = createTask('customer-service', {}, viewerId)
    const otherTask = createTask('customer-service', {}, otherId)

    const logs = await (await taskLogsGet(req('http://localhost/api/task-logs', { token: viewerToken }))).json()
    expect(logs.data).toHaveLength(1)
    expect(logs.data[0].taskId).toBe(ownTask.taskId)

    const crossTask = await taskLogDetailGet(
      req(`http://localhost/api/task-logs/${otherTask.taskId}`, { token: viewerToken }),
      { params: { id: otherTask.taskId } }
    )
    expect(crossTask.status).toBe(404)

    const ownShops = await (await shopGet(req('http://localhost/api/shop', { token: otherToken }))).json()
    expect(ownShops.data).toHaveLength(1)
    expect(ownShops.data[0].domain).toBe('bob.myshopify.com')

    const viewerShops = await (await shopGet(req('http://localhost/api/shop', { token: viewerToken }))).json()
    expect(viewerShops.data).toHaveLength(0)

    expect((await dataGet(req('http://localhost/api/data?type=products', { token: viewerToken }))).status).toBe(200)
    expect((await dataGet(req('http://localhost/api/data?type=products'))).status).toBe(401)
    expect((await dashboardStatsGet(req('http://localhost/api/dashboard/stats', { token: viewerToken }))).status).toBe(200)
  })
})

describe('[C-02] 改密吊销其他会话', () => {
  test('改密后其他设备会话失效、当前会话保留、旧密码失效新密码可登录', async () => {
    // 使用真实密码哈希，覆盖注册/登录闭环
    const created = await authPost(
      req('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'register', username: 'carol', password: 'oldPass123' },
        headers: { 'x-forwarded-for': '10.0.0.9' },
      })
    )
    const registerData = await created.json()
    expect(created.status).toBe(200)
    expect(registerData.success).toBe(true)
    const carolId = registerData.userId as number
    const current = cookieOf(created)!.value
    const otherSession = createSession(carolId, db)

    const changed = await changePassword(
      req('http://localhost/api/auth/password', {
        method: 'POST',
        token: current,
        body: { currentPassword: 'oldPass123', newPassword: 'brandNew456' },
      })
    )
    expect(changed.status).toBe(200)
    expect((await changed.json()).success).toBe(true)

    // 当前会话保留，其他会话失效
    expect((await authGet(req('http://localhost/api/auth', { token: current }))).status).toBe(200)
    expect((await authGet(req('http://localhost/api/auth', { token: otherSession }))).status).toBe(401)
    const sessions = db
      .prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ?')
      .get(carolId)
    expect(sessions).toEqual({ c: 1 })

    // 旧密码不能登录，新密码可以
    const oldLogin = await login('carol', 'oldPass123', '10.0.0.10')
    expect(oldLogin.status).toBe(200)
    expect((await oldLogin.json()).success).toBe(false)
    const newLogin = await login('carol', 'brandNew456', '10.0.0.11')
    expect((await newLogin.json()).success).toBe(true)
  })

  test('改密接口：匿名 401；错误当前密码 400 INVALID_CREDENTIALS', async () => {
    expect(
      (
        await changePassword(
          req('http://localhost/api/auth/password', {
            method: 'POST',
            body: { currentPassword: 'x', newPassword: 'newpass123' },
          })
        )
      ).status
    ).toBe(401)

    const wrong = await changePassword(
      req('http://localhost/api/auth/password', {
        method: 'POST',
        token: viewerToken,
        body: { currentPassword: 'wrong-password', newPassword: 'newpass123' },
      })
    )
    expect(wrong.status).toBe(400)
    expect((await wrong.json()).code).toBe('INVALID_CREDENTIALS')
  })
})

describe('[C-02] AUTH_LEGACY_COMPAT 过渡开关', () => {
  test('默认关闭：query userId 不能认证；开启后可用但会话优先', async () => {
    expect(
      (await taskLogsGet(req(`http://localhost/api/task-logs?userId=${viewerId}`))).status
    ).toBe(401)

    process.env.AUTH_LEGACY_COMPAT = '1'
    const legacy = await taskLogsGet(req(`http://localhost/api/task-logs?userId=${viewerId}`))
    expect(legacy.status).toBe(200)

    // 同时带他人 userId 的会话语义：请求头/admin 路径不会越权（admin 路径要求角色）
    const both = await taskLogsGet(
      req(`http://localhost/api/task-logs?userId=${otherId}`, { token: viewerToken })
    )
    expect(both.status).toBe(200)
    const data = await both.json()
    // 会话用户 viewer 的任务集（空），而非 other 的任务
    expect(data.data).toHaveLength(0)
  })
})
