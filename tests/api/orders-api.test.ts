import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getData } from '@/app/api/data/route'
import { GET as getOrder } from '@/app/api/orders/[id]/route'

let db: DbClient
let aliceToken: string
let bobToken: string
let aliceOrderId: number
let aliceOrderNumber: string

function request(url: string, token?: string): NextRequest {
  return new NextRequest(url, { headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {} })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  const users = new UserRepository(db)
  const aliceId = Number((await users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' })).lastInsertRowid)
  aliceToken = await createSession(aliceId, db)
  await seedDemoData(db)
  // bob 在 seed 之后创建，没有订单
  const bobId = Number((await users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' })).lastInsertRowid)
  bobToken = await createSession(bobId, db)

  const order = (await db
    .prepare('SELECT id, order_number FROM orders ORDER BY id LIMIT 1')
    .get()) as { id: number; order_number: string }
  aliceOrderId = order.id
  aliceOrderNumber = order.order_number
})

afterEach(async () => {
  await db.close()
})

describe('GET /api/data?type=orders', () => {
  test('requires a session', async () => {
    const response = await getData(request('http://localhost/api/data?type=orders'))
    expect(response.status).toBe(401)
  })

  test('returns full order fields with real items/tracking for the current user', async () => {
    const response = await getData(request('http://localhost/api/data?type=orders', aliceToken))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(3)

    const order = body.data[0] as Record<string, unknown>
    for (const field of [
      'id',
      'shop_id',
      'order_number',
      'customer_name',
      'total_amount',
      'status',
      'shipping_region',
      'shipping_weight',
      'logistics_channel',
      'created_at',
    ]) {
      expect(order).toHaveProperty(field)
    }
    // P3-01：种子数据补齐订单明细与物流轨迹（不再恒空）。
    expect(Array.isArray(order.items)).toBe(true)
    expect(Array.isArray(order.tracking)).toBe(true)
    for (const row of body.data as Array<Record<string, { name: string; quantity: number }[]>>) {
      expect(row.items).toHaveLength(2)
      for (const item of row.items) {
        expect(item.name).toBeTruthy()
        expect(item.quantity).toBeGreaterThan(0)
      }
      expect(row.tracking.length).toBeGreaterThan(0)
      expect(row.tracking[0]).toHaveProperty('status')
      expect(row.tracking[0]).toHaveProperty('date')
    }
  })
})

describe('GET /api/orders/[id]', () => {
  test('requires a session', async () => {
    const response = await getOrder(
      request(`http://localhost/api/orders/${aliceOrderId}`),
      params(String(aliceOrderId))
    )
    expect(response.status).toBe(401)
  })

  test('resolves by numeric id and order_number, with real detail arrays (P3-01)', async () => {
    const byId = await getOrder(
      request(`http://localhost/api/orders/${aliceOrderId}`, aliceToken),
      params(String(aliceOrderId))
    )
    const byIdBody = await byId.json()

    expect(byId.status).toBe(200)
    expect(byIdBody.data.order.id).toBe(aliceOrderId)
    expect(byIdBody.data.order.shopName).toBeTruthy()
    expect(byIdBody.data.order.items).toBeUndefined()
    expect(byIdBody.data.items).toHaveLength(2)
    expect(byIdBody.data.items[0]).toHaveProperty('name')
    expect(byIdBody.data.tracking.length).toBeGreaterThan(0)
    expect(byIdBody.data.tracking[0]).toHaveProperty('status')
    expect(byIdBody.data.tracking[0]).toHaveProperty('date')

    const byNumber = await getOrder(
      request(`http://localhost/api/orders/${encodeURIComponent(aliceOrderNumber)}`, aliceToken),
      params(aliceOrderNumber)
    )
    const byNumberBody = await byNumber.json()
    expect(byNumber.status).toBe(200)
    expect(byNumberBody.data.order.id).toBe(aliceOrderId)
  })

  test('returns 404 for cross-user access and unknown orders', async () => {
    const cross = await getOrder(
      request(`http://localhost/api/orders/${aliceOrderId}`, bobToken),
      params(String(aliceOrderId))
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).code).toBe('ORDER_NOT_FOUND')

    const missing = await getOrder(
      request('http://localhost/api/orders/99999', aliceToken),
      params('99999')
    )
    expect(missing.status).toBe(404)
  })
})
