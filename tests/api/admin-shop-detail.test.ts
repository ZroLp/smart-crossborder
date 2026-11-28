import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getShop } from '@/app/api/admin/shops/[id]/route'

let db: DbClient
let adminToken: string
let viewerToken: string
let shopId: number

function request(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/shops/1', {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  const users = new UserRepository(db)
  const adminId = Number((await users.create({ username: 'root', password: 'x', email: null, role: 'admin' })).lastInsertRowid)
  const viewerId = Number((await users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' })).lastInsertRowid)
  adminToken = await createSession(adminId, db)
  viewerToken = await createSession(viewerId, db)
  shopId = Number(
    (
      await new ShopRepository(db).create({
        user_id: viewerId,
        shop_name: 'bob-shop',
        domain: 'bob.myshopify.com',
        access_token: 'tok',
        scope: '',
        status: 'active',
      })
    ).lastInsertRowid
  )
})

afterEach(async () => {
  await db.close()
})

describe('GET /api/admin/shops/[id] (B-04 gap)', () => {
  test('returns 401 anonymously', async () => {
    const response = await getShop(request(), params(String(shopId)))
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('returns 403 for non-admin sessions', async () => {
    const response = await getShop(request(viewerToken), params(String(shopId)))
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('FORBIDDEN')
  })

  test('returns the shop for admins', async () => {
    const response = await getShop(request(adminToken), params(String(shopId)))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.shop.id).toBe(shopId)
    expect(data.shop.shop_name).toBe('bob-shop')
    expect(data.shop.access_token).toBeUndefined()
  })

  test('validates id and handles missing shops', async () => {
    expect((await getShop(request(adminToken), params('abc'))).status).toBe(400)
    expect((await getShop(request(adminToken), params('99999'))).status).toBe(404)
  })
})
