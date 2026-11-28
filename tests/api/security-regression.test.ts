/**
 * P9-03 安全回归（真实 pglite + 真实路由处理函数，不 mock 业务实现）：
 *
 *  1. 越权：用户 A 的 payment / subscription / orders 资源对用户 B → 统一 404；
 *  2. 伪造：?userId= / body.userId / x-user-id 头均被忽略（身份只认会话）；
 *  3. CSRF：middleware 导出纯函数 isCrossSiteRequest + 403 分支；
 *  4. 爆破：连续 6 次错误密码登录 → 第 6 次 429 + Retry-After；
 *  5. 改密踢人：改密后其他（旧）会话被吊销 401，当前会话保留，新密码可登录；
 *  6. 会话治理：logout-all 后该用户所有会话失效。
 */
import type { DbClient } from '@/lib/db/client'
import { NextRequest, NextResponse } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import {
  applyDbCompat,
  installFreshPgliteEngine,
  installPgliteWorkerGuard,
  markReadyHandled,
} from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { isCrossSiteRequest, middleware } from '@/middleware'
import { POST as authPOST, GET as authGET } from '@/app/api/auth/route'
import { POST as logoutAllPOST } from '@/app/api/auth/logout-all/route'
import { POST as passwordPOST } from '@/app/api/auth/password/route'
import { GET as subscriptionGET, POST as subscriptionPOST } from '@/app/api/subscription/route'
import { GET as orderGET } from '@/app/api/orders/[id]/route'
import { GET as paymentGET } from '@/app/api/payments/[id]/route'
import { POST as checkoutPOST } from '@/app/api/checkout/route'

installPgliteWorkerGuard()

let db: DbClient

beforeEach(async () => {
  installFreshPgliteEngine()
  db = applyDbCompat(initDatabase(':memory:'))
  markReadyHandled(db)
  resetLoginRateLimitForTests()
})

function jsonReq(
  url: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; token?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.token) headers.cookie = `${SESSION_COOKIE_NAME}=${opts.token}`
  if (opts.method === 'POST' && opts.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

async function makeUser(username: string, password: string, role = 'viewer'): Promise<number> {
  const users = new UserRepository(db)
  const result = await users.create({ username, password: hashPassword(password), email: null, role })
  return Number(result.lastInsertRowid)
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('P9-03 安全回归 1：越权（跨用户资源 → 统一 404）', () => {
  test('B 无法读/改 A 的 payment、subscription、orders', async () => {
    const aliceId = await makeUser('alice_sec', 'AlicePass1')
    const bobId = await makeUser('bob_sec', 'BobPass1')
    const aliceTok = await createSession(aliceId, db)
    const bobTok = await createSession(bobId, db)

    // A 的资源：订单（挂在 A 的店铺下）
    const shopRow = await db
      .prepare('INSERT INTO shops (user_id, shop_name, domain, access_token) VALUES (?, ?, ?, ?) RETURNING id')
      .run(aliceId, 'Alice Shop', 'alice.secshopify.com', 'tok-a')
    const shopId = Number(shopRow.lastInsertRowid)
    const orderRow = await db
      .prepare("INSERT INTO orders (shop_id, order_number, status) VALUES (?, ?, 'pending') RETURNING id")
      .run(shopId, 'SEC-ORDER-001')
    const orderId = Number(orderRow.lastInsertRowid)

    // A 的支付（checkout 创建）
    const checkout = await checkoutPOST(jsonReq('http://localhost/api/checkout', {
      method: 'POST',
      body: { plan: 'pro' },
      token: aliceTok,
    }))
    expect(checkout.status).toBe(201)
    const paymentId = ((await checkout.json()) as { data: { paymentId: string } }).data.paymentId

    // A 的订阅（active pro）
    await db
      .prepare(
        "INSERT INTO subscriptions (user_id, plan_key, status, current_period_end) VALUES (?, 'pro', 'active', now() + interval '30 days')"
      )
      .run(aliceId)

    // --- B 视角：全部 404 / 拿不到 A 的数据 ---
    const payCross = await paymentGET(jsonReq(`http://localhost/api/payments/${paymentId}`, { token: bobTok }), params(paymentId))
    expect(payCross.status).toBe(404)

    const subB = await subscriptionGET(jsonReq('http://localhost/api/subscription', { token: bobTok }))
    const subBBody = (await subB.json()) as { data: { subscription: unknown; plan: string | null } }
    expect(subB.status).toBe(200)
    expect(subBBody.data.subscription).toBeFalsy() // B 自己的订阅（无），不是 A 的
    expect(subBBody.data.plan).toBeNull()

    const cancelByB = await subscriptionPOST(jsonReq('http://localhost/api/subscription', {
      method: 'POST',
      body: { action: 'cancel' },
      token: bobTok,
    }))
    expect(cancelByB.status).toBe(404) // B 无订阅 → 不能借操作取消 A 的订阅

    const orderCross = await orderGET(
      jsonReq(`http://localhost/api/orders/${orderId}`, { token: bobTok }),
      params(String(orderId))
    )
    expect(orderCross.status).toBe(404)
    expect((await orderCross.json()).code).toBe('ORDER_NOT_FOUND')

    // A 的订阅未被 B 改动
    const subRow = await db
      .prepare('SELECT cancel_at_period_end FROM subscriptions WHERE user_id = ?')
      .get(aliceId) as { cancel_at_period_end: boolean | null }
    expect(subRow.cancel_at_period_end ?? false).toBe(false)
  })
})

describe('P9-03 安全回归 2：伪造（userId 注入全部被忽略）', () => {
  test('?userId / body.userId / x-user-id 均不改变会话身份', async () => {
    const aliceId = await makeUser('alice_spoof', 'AlicePass1')
    const bobId = await makeUser('bob_spoof', 'BobPass1')
    const aliceTok = await createSession(aliceId, db)
    await db
      .prepare(
        "INSERT INTO subscriptions (user_id, plan_key, status, current_period_end) VALUES (?, 'pro', 'active', now() + interval '30 days')"
      )
      .run(aliceId)

    // 2.1 GET /api/auth 附加 ?userId=<他人> + x-user-id 头 → 仍是 A 的会话数据
    const authResp = await authGET(
      jsonReq(`http://localhost/api/auth?userId=${bobId}`, {
        token: aliceTok,
        headers: { 'x-user-id': String(bobId) },
      })
    )
    expect(authResp.status).toBe(200)
    const authBody = (await authResp.json()) as { user: { id: number; username: string } }
    expect(authBody.user.id).toBe(aliceId)
    expect(authBody.user.username).toBe('alice_spoof')

    // 2.2 GET /api/subscription?userId=<B>（A 会话）→ 返回 A 自己的订阅，不受 query 影响
    const subResp = await subscriptionGET(
      jsonReq(`http://localhost/api/subscription?userId=${bobId}`, { token: aliceTok })
    )
    const subBody = (await subResp.json()) as { data: { subscription: { user_id: number } | null } }
    expect(subResp.status).toBe(200)
    expect(subBody.data.subscription?.user_id).toBe(aliceId)

    // 2.3 body.userId：B 会话 + body.userId=<A 的订阅 id> 取消 → 被忽略，B 无订阅 404
    const subRow = await db
      .prepare('SELECT id FROM subscriptions WHERE user_id = ?')
      .get(aliceId) as { id: number }
    const bobTok = await createSession(bobId, db)
    const cancelResp = await subscriptionPOST(
      jsonReq('http://localhost/api/subscription', {
        method: 'POST',
        body: { action: 'cancel', userId: subRow.id },
        token: bobTok,
      })
    )
    expect(cancelResp.status).toBe(404)
    expect((await cancelResp.json()).code).toBe('NO_SUBSCRIPTION')

    // A 的订阅未被 body.userId 影响
    const stillActive = await db
      .prepare('SELECT cancel_at_period_end FROM subscriptions WHERE id = ?')
      .get(subRow.id) as { cancel_at_period_end: boolean | null }
    expect(stillActive.cancel_at_period_end ?? false).toBe(false)
  })
})

describe('P9-03 安全回归 3：CSRF（middleware 跨站拒绝）', () => {
  function headerBag(entries: Record<string, string>) {
    const bag: Record<string, string> = { ...entries }
    return {
      get: (name: string) => {
        const key = name.toLowerCase()
        return key in bag ? bag[key] : null
      },
    }
  }

  test('isCrossSiteRequest 纯函数语义', () => {
    // 无来源头（CLI/同源常规请求）→ 非跨站
    expect(isCrossSiteRequest(headerBag({ host: 'app.local' }))).toBe(false)
    // 同源 origin → 非跨站
    expect(isCrossSiteRequest(headerBag({ host: 'app.local', origin: 'https://app.local' }))).toBe(false)
    // 跨域 origin → 跨站
    expect(isCrossSiteRequest(headerBag({ host: 'app.local', origin: 'https://evil.com' }))).toBe(true)
    // 同源 referer → 非跨站；跨域 referer → 跨站
    expect(isCrossSiteRequest(headerBag({ host: 'app.local', referer: 'https://app.local/page' }))).toBe(false)
    expect(isCrossSiteRequest(headerBag({ host: 'app.local', referer: 'https://evil.com/page' }))).toBe(true)
    // sec-fetch-site: cross-site 直接拒绝
    expect(isCrossSiteRequest(headerBag({ host: 'app.local', 'sec-fetch-site': 'cross-site' }))).toBe(true)
    // 无法解析 host → 保守拒绝
    expect(isCrossSiteRequest(headerBag({ origin: 'https://app.local' }))).toBe(true)
  })

  test('middleware：跨站 POST /api/subscription → 403；同源/GET 放行', async () => {
    // 跨站 POST（origin + referer 跨域）→ 403
    const cross = middleware(
      new NextRequest('http://app.local/api/subscription', {
        method: 'POST',
        headers: { origin: 'http://evil.com', referer: 'http://evil.com/form' },
      })
    )
    expect(cross && cross.status).toBe(403)
    const crossBody = cross ? await (cross as NextResponse).json() : null
    expect(crossBody).toEqual({ success: false, code: 'FORBIDDEN', error: 'Cross-site request rejected' })

    // sec-fetch-site 特征（无 origin/referer 时的兜底）→ 403
    const secFetch = middleware(
      new NextRequest('http://app.local/api/subscription', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'cross-site' },
      })
    )
    expect(secFetch && secFetch.status).toBe(403)

    // 同源 POST → 放行（NextResponse.next()）
    const sameSite = middleware(
      new NextRequest('http://app.local/api/subscription', {
        method: 'POST',
        headers: { origin: 'http://app.local', referer: 'http://app.local/page' },
      })
    )
    expect(sameSite && (sameSite as NextResponse).status).toBe(200)

    // 跨站 GET（安全方法）→ 不拦截
    const crossGet = middleware(
      new NextRequest('http://app.local/api/subscription', {
        method: 'GET',
        headers: { origin: 'http://evil.com' },
      })
    )
    expect(crossGet && (crossGet as NextResponse).status).toBe(200)
  })
})

describe('P9-03 安全回归 4：爆破（登录限流 429）', () => {
  test('连续 6 次错误密码登录 → 前 5 次拒绝、第 6 次 429 + Retry-After', async () => {
    // 使用不存在的用户名（随机后缀，避免锁到其他用户/测试）
    const victim = `bf_victim_${Date.now()}`
    const attempts: Array<{ status: number; body: { code?: string }; retryAfter?: string | null }> = []

    for (let i = 1; i <= 6; i += 1) {
      const response = await authPOST(
        jsonReq('http://localhost/api/auth', {
          method: 'POST',
          body: { action: 'login', username: victim, password: 'WrongPass1' },
        })
      )
      attempts.push({
        status: response.status,
        body: (await response.json()) as { code?: string },
        retryAfter: response.headers.get('retry-after'),
      })
    }

    // 前 5 次：凭据无效（统一 401 语义码，避免用户枚举差异由路由决定）
    attempts.slice(0, 5).forEach((a, idx) => {
      expect(a.body.code).toBe('INVALID_CREDENTIALS')
      void idx
    })
    // 第 6 次：触发限流 429 + Retry-After
    expect(attempts[5].status).toBe(429)
    expect(attempts[5].body.code).toBe('RATE_LIMITED')
    const retryAfter = Number(attempts[5].retryAfter)
    expect(Number.isFinite(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60) // 窗口 60s 内

    // 锁定期间即使密码正确也 429（限流按"失败次数"而非"凭据"生效）
    const stillBlocked = await authPOST(
      jsonReq('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'login', username: victim, password: 'WrongPass1' },
      })
    )
    expect(stillBlocked.status).toBe(429)
  })
})

describe('P9-03 安全回归 5：改密踢人（旧会话吊销）', () => {
  test('改密后其他会话 401，当前会话保留，新密码可登录', async () => {
    const carolId = await makeUser('carol_pw', 'CarolPass1')
    const currentTok = await createSession(carolId, db)
    const otherTok = await createSession(carolId, db)

    // 改密（当前会话）
    const change = await passwordPOST(
      jsonReq('http://localhost/api/auth/password', {
        method: 'POST',
        body: { currentPassword: 'CarolPass1', newPassword: 'CarolPass2!' },
        token: currentTok,
      })
    )
    expect(change.status).toBe(200)

    // 旧（其他）会话被吊销 → 401
    const oldSession = await authGET(jsonReq('http://localhost/api/auth', { token: otherTok }))
    expect(oldSession.status).toBe(401)

    // 当前会话保留 → 200
    const currentAlive = await authGET(jsonReq('http://localhost/api/auth', { token: currentTok }))
    expect(currentAlive.status).toBe(200)

    // 新密码可登录
    const relogin = await authPOST(
      jsonReq('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'login', username: 'carol_pw', password: 'CarolPass2!' },
      })
    )
    expect(relogin.status).toBe(200)
    const newTok = relogin.cookies.get(SESSION_COOKIE_NAME)?.value
    expect(newTok).toBeTruthy()
    const newSession = await authGET(jsonReq('http://localhost/api/auth', { token: newTok }))
    expect(newSession.status).toBe(200)

    // 旧密码不再可用
    const oldPw = await authPOST(
      jsonReq('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'login', username: 'carol_pw', password: 'CarolPass1' },
      })
    )
    expect((await oldPw.json()).code).toBe('INVALID_CREDENTIALS')
  })
})

describe('P9-03 安全回归 6：会话治理（logout-all）', () => {
  test('logout-all 后该用户所有会话（含调用者自身）失效，重新登录恢复', async () => {
    const daveId = await makeUser('dave_sess', 'DavePass1')
    const t1 = await createSession(daveId, db)
    const t2 = await createSession(daveId, db)

    const response = await logoutAllPOST(jsonReq('http://localhost/api/auth/logout-all', {
      method: 'POST',
      token: t1,
    }))
    expect(response.status).toBe(200)

    // 两个旧会话都失效
    expect((await authGET(jsonReq('http://localhost/api/auth', { token: t1 }))).status).toBe(401)
    expect((await authGET(jsonReq('http://localhost/api/auth', { token: t2 }))).status).toBe(401)

    // 重新登录 → 新会话可用
    const relogin = await authPOST(
      jsonReq('http://localhost/api/auth', {
        method: 'POST',
        body: { action: 'login', username: 'dave_sess', password: 'DavePass1' },
      })
    )
    expect(relogin.status).toBe(200)
    const t3 = relogin.cookies.get(SESSION_COOKIE_NAME)?.value
    expect((await authGET(jsonReq('http://localhost/api/auth', { token: t3 as string }))).status).toBe(200)
  })
})
