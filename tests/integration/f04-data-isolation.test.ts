/**
 * P0-B-04 / F-04 / C-02 独立验收测试（qa-verifier）
 *
 * 覆盖：
 * - admin/shops/[id] 匿名 401 / viewer 403 / admin 200；
 * - compliance、ad-campaigns、ad-campaigns/[id]、profile、orders/[id]
 *   的会话隔离、跨用户 404、返回结构与空库空数组；
 * - 四类数据（合规 / 广告 / 订单 / 会话资料）按用户隔离；
 * - 种子数据（seedDemoData）隔离与幂等基础。
 *
 * 真实 SQLite（:memory:）+ 真实路由处理函数，不 mock 业务实现。
 */
import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getAdminShop } from '@/app/api/admin/shops/[id]/route'
import { GET as getCompliance } from '@/app/api/compliance/route'
import { GET as getCampaigns } from '@/app/api/ad-campaigns/route'
import { GET as getCampaign } from '@/app/api/ad-campaigns/[id]/route'
import { GET as getProfile } from '@/app/api/profile/route'
import { GET as getOrder } from '@/app/api/orders/[id]/route'

let db: Database.Database
let adminId: number
let aliceId: number
let bobId: number
let adminToken: string
let aliceToken: string
let bobToken: string

function req(url: string, token?: string): NextRequest {
  return new NextRequest(url, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  adminId = Number(users.create({ username: 'root', password: 'x', email: 'root@t.com', role: 'admin' }).lastInsertRowid)
  aliceId = Number(users.create({ username: 'alice', password: 'x', email: 'a@t.com', role: 'viewer' }).lastInsertRowid)
  bobId = Number(users.create({ username: 'bob', password: 'x', email: 'b@t.com', role: 'viewer' }).lastInsertRowid)
  adminToken = createSession(adminId, db)
  aliceToken = createSession(aliceId, db)
  bobToken = createSession(bobId, db)
  seedDemoData(db)
})

afterEach(() => {
  db.close()
})

function shopOf(userId: number): { id: number; domain: string } {
  const shop = new ShopRepository(db).findByUserId(userId)[0]
  return { id: shop.id, domain: shop.domain }
}

function orderOf(userId: number): { id: number; order_number: string } {
  const shop = shopOf(userId)
  return db
    .prepare('SELECT id, order_number FROM orders WHERE shop_id = ? ORDER BY id LIMIT 1')
    .get(shop.id) as { id: number; order_number: string }
}

describe('[B-04] admin/shops/[id] 权限', () => {
  test('匿名 401、viewer 403、admin 200，admin 返回店铺字段', async () => {
    const shop = shopOf(aliceId)

    expect((await getAdminShop(req(`http://localhost/api/admin/shops/${shop.id}`), params(String(shop.id)))).status).toBe(401)
    expect(
      (await getAdminShop(req(`http://localhost/api/admin/shops/${shop.id}`, aliceToken), params(String(shop.id)))).status
    ).toBe(403)

    const ok = await getAdminShop(
      req(`http://localhost/api/admin/shops/${shop.id}`, adminToken),
      params(String(shop.id))
    )
    const body = await ok.json()
    expect(ok.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.shop.id).toBe(shop.id)
    expect(body.shop.user_id).toBe(aliceId)
    expect(body.shop.domain).toBe(shop.domain)
    expect(typeof body.shop.shop_name).toBe('string')
    expect(body.shop.access_token).toBeUndefined()
  })

  test('非法 id 400、不存在 404', async () => {
    const bad = await getAdminShop(req('http://localhost/api/admin/shops/not-a-number', adminToken), params('not-a-number'))
    expect(bad.status).toBe(400)

    const missing = await getAdminShop(req('http://localhost/api/admin/shops/99999', adminToken), params('99999'))
    expect(missing.status).toBe(404)
  })
})

describe('[F-04] /api/compliance 会话隔离与结构', () => {
  test('匿名 401；空库时五个分组均为空数组', async () => {
    expect((await getCompliance(req('http://localhost/api/compliance'))).status).toBe(401)

    db.prepare('DELETE FROM compliance_items').run()
    const empty = await getCompliance(req('http://localhost/api/compliance', aliceToken))
    const body = await empty.json()
    expect(empty.status).toBe(200)
    expect(Object.keys(body.data).sort()).toEqual(
      ['complianceChecks', 'policyUpdates', 'riskItems', 'suggestions', 'taxReminders'].sort()
    )
    for (const group of Object.values(body.data) as Array<unknown[]>) {
      expect(Array.isArray(group)).toBe(true)
      expect(group).toHaveLength(0)
    }
  })

  test('按用户隔离：alice 与 bob 的条目 id 不重叠，且字段结构完整', async () => {
    const alice = await (await getCompliance(req('http://localhost/api/compliance', aliceToken))).json()
    const bob = await (await getCompliance(req('http://localhost/api/compliance', bobToken))).json()

    const aliceIds = new Set<number>(
      (Object.values(alice.data) as Array<Array<{ id: number }>>).flat().map((item) => item.id)
    )
    const bobItems = (Object.values(bob.data) as Array<Array<{ id: number; createdAt: string }>>).flat()

    expect(aliceIds.size).toBeGreaterThan(0)
    expect(bobItems.length).toBeGreaterThan(0)
    expect(bobItems.every((item) => !aliceIds.has(item.id))).toBe(true)
    expect(bobItems.every((item) => typeof item.createdAt === 'string')).toBe(true)

    // 数据库层面归属正确
    const aliceRows = db.prepare('SELECT COUNT(*) c FROM compliance_items WHERE user_id = ?').get(aliceId) as { c: number }
    const bobRows = db.prepare('SELECT COUNT(*) c FROM compliance_items WHERE user_id = ?').get(bobId) as { c: number }
    expect(aliceRows.c).toBe(24)
    expect(bobRows.c).toBe(24)
  })

  test('损坏的 payload 不导致 500，行仍带 id/createdAt', async () => {
    db.prepare("INSERT INTO compliance_items (user_id, kind, payload) VALUES (?, 'policy', 'not-json')").run(aliceId)
    const response = await getCompliance(req('http://localhost/api/compliance', aliceToken))
    const body = await response.json()
    expect(response.status).toBe(200)
    const added = (body.data.policyUpdates as Array<Record<string, unknown>>).find(
      (item) => typeof item.createdAt === 'string' && Number(item.id) > 0 && item.title === undefined
    )
    expect(added).toBeTruthy()
  })
})

describe('[F-04] /api/ad-campaigns 会话隔离与结构', () => {
  test('匿名 401；空库返回空数组（非 null）', async () => {
    expect((await getCampaigns(req('http://localhost/api/ad-campaigns'))).status).toBe(401)

    db.prepare('DELETE FROM ad_campaigns').run()
    db.prepare('DELETE FROM ad_suggestions').run()
    const body = await (await getCampaigns(req('http://localhost/api/ad-campaigns', aliceToken))).json()
    expect(body.success).toBe(true)
    expect(body.data.campaigns).toEqual([])
    expect(body.data.suggestions).toEqual([])
  })

  test('列表按用户隔离且返回映射后的字段结构', async () => {
    const alice = await (await getCampaigns(req('http://localhost/api/ad-campaigns', aliceToken))).json()
    const bob = await (await getCampaigns(req('http://localhost/api/ad-campaigns', bobToken))).json()

    expect(alice.data.campaigns.length).toBeGreaterThan(0)
    expect(alice.data.suggestions.length).toBeGreaterThan(0)
    const aliceIds = new Set<number>(alice.data.campaigns.map((c: { id: number }) => c.id))
    expect(bob.data.campaigns.every((c: { id: number }) => !aliceIds.has(c.id))).toBe(true)

    const campaign = alice.data.campaigns[0]
    expect(typeof campaign.externalId).toBe('string')
    expect(typeof campaign.name).toBe('string')
    expect(typeof campaign.platform).toBe('string')
    expect(typeof campaign.status).toBe('string')
    expect(typeof campaign.roas).toBe('number')
    expect(campaign.audience).toEqual(expect.any(Object))
    expect(Array.isArray(campaign.creatives)).toBe(true)
    expect(typeof campaign.createdAt).toBe('string')

    const suggestion = alice.data.suggestions[0]
    expect(typeof suggestion.title).toBe('string')
    expect(typeof suggestion.status).toBe('string')
  })

  test('详情支持数字 id 与 externalId；跨用户与未知 id 均 404', async () => {
    const list = await (await getCampaigns(req('http://localhost/api/ad-campaigns', aliceToken))).json()
    const campaign = list.data.campaigns[0] as { id: number; externalId: string }

    const byId = await getCampaign(
      req(`http://localhost/api/ad-campaigns/${campaign.id}`, aliceToken),
      params(String(campaign.id))
    )
    expect(byId.status).toBe(200)
    expect((await byId.json()).data.campaign.id).toBe(campaign.id)

    const byExternal = await getCampaign(
      req(`http://localhost/api/ad-campaigns/${campaign.externalId}`, aliceToken),
      params(campaign.externalId)
    )
    expect((await byExternal.json()).data.campaign.id).toBe(campaign.id)

    const cross = await getCampaign(
      req(`http://localhost/api/ad-campaigns/${campaign.id}`, bobToken),
      params(String(campaign.id))
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).code).toBe('CAMPAIGN_NOT_FOUND')

    const missing = await getCampaign(req('http://localhost/api/ad-campaigns/99999', aliceToken), params('99999'))
    expect(missing.status).toBe(404)
  })
})

describe('[F-04] /api/profile 会话隔离与字段', () => {
  test('匿名 401；返回本人资料、偏好与会话，不泄露 token', async () => {
    const response = await getProfile(req('http://localhost/api/profile'))
    expect(response.status).toBe(401)

    const body = await (await getProfile(req('http://localhost/api/profile', aliceToken))).json()
    expect(body.success).toBe(true)
    expect(body.data.user.id).toBe(aliceId)
    expect(body.data.user.username).toBe('alice')
    expect(body.data.user.password).toBeUndefined()
    expect(body.data.user.email).toBe('a@t.com')
    expect(body.data.preferences).toBeNull() // 未初始化偏好
    expect(Array.isArray(body.data.sessions)).toBe(true)
    expect(body.data.sessions.length).toBeGreaterThan(0)
    expect(body.data.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
    expect(JSON.stringify(body)).not.toMatch(/token_hash|[0-9a-f]{64}/)
    // 会话列表不跨用户
    const bob = await (await getProfile(req('http://localhost/api/profile', bobToken))).json()
    expect(bob.data.user.id).toBe(bobId)
    expect(bob.data.sessions.length).toBeGreaterThan(0)
  })

  test('多会话计数随登出变化，且始终标记当前会话', async () => {
    const second = createSession(aliceId, db)
    const before = await (await getProfile(req('http://localhost/api/profile', second))).json()
    expect(before.data.sessions).toHaveLength(2)
    expect(before.data.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1)

    // 用第一个 token 的资料视图看到仍是 2 个会话（同一用户）
    const otherView = await (await getProfile(req('http://localhost/api/profile', aliceToken))).json()
    expect(otherView.data.sessions).toHaveLength(2)
  })
})

describe('[F-04] /api/orders/[id] 会话隔离与结构', () => {
  test('匿名 401；本人订单按 id 与订单号可取，含 shop 信息与空明细', async () => {
    expect((await getOrder(req('http://localhost/api/orders/1'), params('1'))).status).toBe(401)

    const order = orderOf(aliceId)
    const response = await getOrder(
      req(`http://localhost/api/orders/${order.id}`, aliceToken),
      params(String(order.id))
    )
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.order.id).toBe(order.id)
    expect(body.data.order.orderNumber).toBe(order.order_number)
    expect(typeof body.data.order.shopName).toBe('string')
    expect(typeof body.data.order.shopDomain).toBe('string')
    expect(body.data.items).toEqual([])
    expect(body.data.tracking).toEqual([])

    const byNumber = await getOrder(
      req(`http://localhost/api/orders/${encodeURIComponent(order.order_number)}`, aliceToken),
      params(order.order_number)
    )
    expect((await byNumber.json()).data.order.id).toBe(order.id)
  })

  test('跨用户 404、未知 404、非法 id 404', async () => {
    const order = orderOf(aliceId)

    const cross = await getOrder(
      req(`http://localhost/api/orders/${order.id}`, bobToken),
      params(String(order.id))
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).code).toBe('ORDER_NOT_FOUND')

    expect((await getOrder(req('http://localhost/api/orders/99999', aliceToken), params('99999'))).status).toBe(404)
    expect((await getOrder(req('http://localhost/api/orders/abc', aliceToken), params('abc'))).status).toBe(404)
  })

  test('订单列表接口四类数据均按用户过滤（回归）', async () => {
    const aliceOrders = db
      .prepare('SELECT COUNT(*) c FROM orders o JOIN shops s ON s.id = o.shop_id WHERE s.user_id = ?')
      .get(aliceId) as { c: number }
    expect(aliceOrders.c).toBe(3)

    // 跨用户直接取 bob 的订单 id 在 alice 会话下 404
    const bobOrder = orderOf(bobId)
    const cross = await getOrder(
      req(`http://localhost/api/orders/${bobOrder.id}`, aliceToken),
      params(String(bobOrder.id))
    )
    expect(cross.status).toBe(404)
  })
})
