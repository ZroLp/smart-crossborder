import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getData } from '@/app/api/data/route'
import { GET as getOrder } from '@/app/api/orders/[id]/route'

let db: Database.Database
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

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  const aliceId = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  aliceToken = createSession(aliceId, db)
  seedDemoData(db)
  // bob 在 seed 之后创建，没有订单
  const bobId = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  bobToken = createSession(bobId, db)

  const order = db
    .prepare('SELECT id, order_number FROM orders ORDER BY id LIMIT 1')
    .get() as { id: number; order_number: string }
  aliceOrderId = order.id
  aliceOrderNumber = order.order_number
})

afterEach(() => {
  db.close()
})

describe('GET /api/data?type=orders', () => {
  test('requires a session', async () => {
    const response = await getData(request('http://localhost/api/data?type=orders'))
    expect(response.status).toBe(401)
  })

  test('returns full order fields with empty items/tracking for the current user', async () => {
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
    expect(order.items).toEqual([])
    expect(order.tracking).toEqual([])
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

  test('resolves by numeric id and order_number, with empty detail arrays', async () => {
    const byId = await getOrder(
      request(`http://localhost/api/orders/${aliceOrderId}`, aliceToken),
      params(String(aliceOrderId))
    )
    const byIdBody = await byId.json()

    expect(byId.status).toBe(200)
    expect(byIdBody.data.order.id).toBe(aliceOrderId)
    expect(byIdBody.data.order.shopName).toBeTruthy()
    expect(byIdBody.data.order.items).toBeUndefined()
    expect(byIdBody.data.items).toEqual([])
    expect(byIdBody.data.tracking).toEqual([])

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
