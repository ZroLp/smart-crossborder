import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ProductRepository } from '@/lib/db/product-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET } from '@/app/api/dashboard/stats/route'

let db: Database.Database
let token: string
let shopId: number

function request(withCookie = true): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/stats', {
    headers: withCookie ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const userId = Number(
    new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid
  )
  token = createSession(userId, db)

  shopId = Number(
    new ShopRepository(db).create({
      user_id: userId,
      shop_name: 'demo',
      domain: 'demo.myshopify.com',
      access_token: 'tok',
      scope: '',
      status: 'active',
    }).lastInsertRowid
  )
})

afterEach(() => {
  try {
    db.close()
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
    productRepo.create({ shop_id: shopId, name: 'P1', category: 'home', price: 10, cost: 5, sales: 0, stock: 1, status: 'active' })
    orderRepo.create({ shop_id: shopId, order_number: 'O1', customer_name: 'A', total_amount: 100, status: 'completed', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })
    orderRepo.create({ shop_id: shopId, order_number: 'O2', customer_name: 'B', total_amount: 200, status: 'pending', shipping_region: 'US', shipping_weight: 1, logistics_channel: 'x' })

    const response = await GET(request())
    const data = await response.json()

    expect(data.hasData).toBe(true)
    expect(data.orders).toBe(2)
    expect(data.revenue).toBe('300.00')
    expect(typeof data.roas).toBe('string')
    expect(typeof data.csRate).toBe('string')
  })

  test('returns 500 on a database error', async () => {
    db.close()
    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(typeof data.error).toBe('string')
  })
})
