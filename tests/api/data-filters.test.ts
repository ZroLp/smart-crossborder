import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { seedDemoData } from '@/lib/db/seed'
import { createTask } from '@/lib/agents/task-service'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getData } from '@/app/api/data/route'
import { GET as getDashboardStats } from '@/app/api/dashboard/stats/route'
import { GET as getAdminStats } from '@/app/api/admin/stats/route'

let db: Database.Database
let user1Token: string
let user2Token: string
let adminToken: string
let user1ShopId: number

function request(url: string, token?: string): NextRequest {
  return new NextRequest(url, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  const user1 = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  const user2 = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  const admin = Number(users.create({ username: 'root', password: 'x', email: null, role: 'admin' }).lastInsertRowid)
  user1Token = createSession(user1, db)
  user2Token = createSession(user2, db)
  adminToken = createSession(admin, db)
  seedDemoData(db)
  user1ShopId = (db.prepare('SELECT id FROM shops WHERE user_id = ?').get(user1) as { id: number }).id
})

afterEach(() => {
  db.close()
})

describe('/api/data session scoping (C-02)', () => {
  test('returns 401 for anonymous requests', async () => {
    const response = await getData(request('http://localhost/api/data?type=products'))
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('scopes products and orders to the session user', async () => {
    const own = await (await getData(request('http://localhost/api/data?type=products', user1Token))).json()
    expect(own.data).toHaveLength(3)

    const other = await (await getData(request('http://localhost/api/data?type=products', user2Token))).json()
    expect(other.data).toHaveLength(3)
    expect(other.data.every((p: { shop_id: number }) => p.shop_id !== user1ShopId)).toBe(true)

    // 尝试通过 query userId 提升权限：被忽略，仍返回 session 用户的数据。
    const escalated = await (
      await getData(request('http://localhost/api/data?type=orders&userId=1', user2Token))
    ).json()
    expect(escalated.data).toHaveLength(3)
    expect(escalated.data.every((o: { shop_id: number }) => o.shop_id !== user1ShopId)).toBe(true)
  })

  test('cross-user shopId returns 404 and task logs are session scoped', async () => {
    const crossShop = await getData(
      request(`http://localhost/api/data?type=products&shopId=${user1ShopId}`, user2Token)
    )
    expect(crossShop.status).toBe(404)

    createTask('selection', {}, 1)
    createTask('content', {}, 2)

    const logs = await (
      await getData(request('http://localhost/api/data?type=task-logs', user1Token))
    ).json()
    expect(logs.data).toHaveLength(1)
    expect(logs.data[0].user_id).toBe(1)
  })

  test('scopes dashboard aggregates to the session user', async () => {
    const scoped = await (
      await getData(request('http://localhost/api/data?type=dashboard', user1Token))
    ).json()
    expect(scoped.data.totalProducts).toBe(3)
    expect(scoped.data.totalOrders).toBe(3)
  })
})

describe('/api/dashboard/stats session scoping (C-02)', () => {
  test('returns the session user statistics', async () => {
    const scoped = await (
      await getDashboardStats(request('http://localhost/api/dashboard/stats', user1Token))
    ).json()
    expect(scoped.hasData).toBe(true)
    expect(scoped.orders).toBe(3)
    expect(scoped.revenue).toBe('238.70')
  })

  test('returns empty stats for a user without data', async () => {
    const carol = Number(
      new UserRepository(db)
        .create({ username: 'carol', password: 'x', email: null, role: 'viewer' })
        .lastInsertRowid
    )
    const carolToken = createSession(carol, db)
    const response = await getDashboardStats(
      request('http://localhost/api/dashboard/stats', carolToken)
    )
    const data = await response.json()
    expect(data.hasData).toBe(false)
    expect(data.orders).toBe(0)
  })
})

describe('/api/admin/stats guards (C-02)', () => {
  test('filters admin stats by userId', async () => {
    const scoped = await (
      await getAdminStats(request('http://localhost/api/admin/stats?userId=1', adminToken))
    ).json()
    expect(scoped.stats.totalUsers).toBe(1)
    expect(scoped.stats.totalShops).toBe(1)
    expect(scoped.stats.totalOrders).toBe(3)
    expect(scoped.stats.totalGMV).toBeCloseTo(238.7)
  })

  test('returns global stats without userId and 404 for unknown users', async () => {
    const all = await (
      await getAdminStats(request('http://localhost/api/admin/stats', adminToken))
    ).json()
    expect(all.stats.totalUsers).toBe(3)
    expect(all.stats.totalShops).toBe(3)
    expect(all.stats.totalOrders).toBe(9)

    const missing = await getAdminStats(
      request('http://localhost/api/admin/stats?userId=999', adminToken)
    )
    expect(missing.status).toBe(404)
  })

  test('returns 401 anonymously and 403 for non-admin sessions', async () => {
    const anonymous = await getAdminStats(request('http://localhost/api/admin/stats'))
    expect(anonymous.status).toBe(401)

    const forbidden = await getAdminStats(
      request('http://localhost/api/admin/stats', user1Token)
    )
    expect(forbidden.status).toBe(403)
  })
})
