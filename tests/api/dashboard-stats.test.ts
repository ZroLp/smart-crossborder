import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ProductRepository } from '@/lib/db/product-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET } from '@/app/api/dashboard/stats/route'

let db: DbClient
let token: string
let shopId: number
let userId: number

function request(withCookie = true): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/stats', {
    headers: withCookie ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  userId = Number(
    (
      await new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' })
    ).lastInsertRowid
  )
  token = await createSession(userId, db)

  shopId = Number(
    (
      await new ShopRepository(db).create({
        user_id: userId,
        shop_name: 'demo',
        domain: 'demo.myshopify.com',
        access_token: 'tok',
        scope: '',
        status: 'active',
      })
    ).lastInsertRowid
  )
})

afterEach(async () => {
  try {
    await db.close()
  } catch {
    // already closed in the error test
  }
})

describe('Dashboard Stats API (session scoped)', () => {
  test('returns 401 for anonymous requests', async () => {
    const response = await GET(request(false))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  test('returns zero stats when the user has no data', async () => {
    const response = await GET(request())
    const data = await response.json()

    expect(data).toEqual({
      revenue: '0',
      orders: 0,
      roas: '0',
      csRate: '0',
      hasData: false,
    })
  })

  test('returns computed stats for the session user only', async () => {
    const productRepo = new ProductRepository(db)
    const orderRepo = new OrderRepository(db)
    await productRepo.create({ shop_id: shopId, name: 'P1', category: 'home', price: 10, cost: 5, sales: 0, stock: 1, status: 'active' })
    await orderRepo.create({ shop_id: shopId, order_number: 'O1', customer_name: 'A', total_amount: 100, status: 'completed', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })
    await orderRepo.create({ shop_id: shopId, order_number: 'O2', customer_name: 'B', total_amount: 200, status: 'pending', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })

    const response = await GET(request())
    const data = await response.json()

    expect(data.hasData).toBe(true)
    expect(data.orders).toBe(2)
    expect(data.revenue).toBe('300.00')
    // P5-01：无广告计划时 ROAS 为 0（不能靠店铺营收反推出 3.3 这类假值）
    expect(data.roas).toBe('0')
    expect(typeof data.csRate).toBe('string')
  })

  test('computes weighted ROAS from ad campaigns (revenue = spent * roas per campaign)', async () => {
    const orderRepo = new OrderRepository(db)
    await orderRepo.create({ shop_id: shopId, order_number: 'O1', customer_name: 'A', total_amount: 100, status: 'completed', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })

    // A: 1000*2.0=2000；B: 3000*4.0=12000 → (14000)/(4000)=3.5
    await db.prepare(
      `INSERT INTO ad_campaigns (user_id, external_id, name, platform, status, budget, spent, roas, clicks, conversions, ctr)
       VALUES (?, 'camp-a', 'Camp A', 'facebook', 'active', 1500, 1000, 2.0, 500, 40, 0.02)`
    ).run(userId)
    await db.prepare(
      `INSERT INTO ad_campaigns (user_id, external_id, name, platform, status, budget, spent, roas, clicks, conversions, ctr)
       VALUES (?, 'camp-b', 'Camp B', 'google', 'active', 4000, 3000, 4.0, 800, 90, 0.03)`
    ).run(userId)

    const response = await GET(request())
    const data = await response.json()

    expect(data.hasData).toBe(true)
    expect(data.roas).toBe('3.5')
  })

  test('scoping: another users ad campaigns do not affect this users ROAS', async () => {
    const orderRepo = new OrderRepository(db)
    await orderRepo.create({ shop_id: shopId, order_number: 'O1', customer_name: 'A', total_amount: 100, status: 'completed', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })

    const otherUserId = Number(
      (
        await new UserRepository(db).create({ username: 'mallory', password: 'x', email: null, role: 'viewer' })
      ).lastInsertRowid
    )
    await db.prepare(
      `INSERT INTO ad_campaigns (user_id, external_id, name, platform, status, budget, spent, roas, clicks, conversions, ctr)
       VALUES (?, 'camp-x', 'Camp X', 'tiktok', 'active', 9000, 9000, 9.0, 100, 10, 0.01)`
    ).run(otherUserId)

    const response = await GET(request())
    const data = await response.json()

    expect(data.roas).toBe('0')
  })

  test('returns 500 on a database error', async () => {
    await db.close()
    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(typeof data.error).toBe('string')
  })
})
