import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getCompliance } from '@/app/api/compliance/route'

let db: Database.Database
let aliceToken: string
let bobToken: string
let aliceId: number
let bobId: number

function request(url = 'http://localhost/api/compliance', token?: string): NextRequest {
  return new NextRequest(url, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  aliceId = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  bobId = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  aliceToken = createSession(aliceId, db)
  bobToken = createSession(bobId, db)
  seedDemoData(db)
})

afterEach(() => {
  db.close()
})

describe('GET /api/compliance', () => {
  test('requires a session', async () => {
    const response = await getCompliance(request())
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('returns grouped compliance data for the current user', async () => {
    const response = await getCompliance(request(undefined, aliceToken))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.policyUpdates).toHaveLength(5)
    expect(body.data.taxReminders).toHaveLength(4)
    expect(body.data.complianceChecks).toHaveLength(5)
    expect(body.data.riskItems).toHaveLength(5)
    expect(body.data.suggestions).toHaveLength(5)

    for (const group of Object.values(body.data) as Array<Array<Record<string, unknown>>>) {
      for (const item of group) {
        expect(item.id).toBeDefined()
        expect(typeof item.title).toBe('string')
        expect(item.createdAt).toBeDefined()
      }
    }

    const firstPolicy = body.data.policyUpdates[0] as { title: string; summary: string }
    expect(firstPolicy.title.length).toBeGreaterThan(0)
    expect(firstPolicy.summary.length).toBeGreaterThan(0)
  })

  test('isolates rows per user', async () => {
    const alice = await (await getCompliance(request(undefined, aliceToken))).json()
    const bob = await (await getCompliance(request(undefined, bobToken))).json()

    const aliceIds = new Set<number>(
      (Object.values(alice.data) as Array<Array<{ id: number }>>).flat().map((item) => item.id)
    )
    const bobIds = (Object.values(bob.data) as Array<Array<{ id: number }>>)
      .flat()
      .map((item) => item.id)

    expect(bobIds.length).toBeGreaterThan(0)
    expect(bobIds.every((id) => !aliceIds.has(id))).toBe(true)

    const aliceRows = db
      .prepare('SELECT COUNT(*) c FROM compliance_items WHERE user_id = ?')
      .get(aliceId) as { c: number }
    const bobRows = db
      .prepare('SELECT COUNT(*) c FROM compliance_items WHERE user_id = ?')
      .get(bobId) as { c: number }
    expect(aliceRows.c).toBe(24)
    expect(bobRows.c).toBe(24)
  })

  test('seeding compliance/ad rows is idempotent and independent from orders', async () => {
    const shopId = Number(
      new ShopRepository(db).create({
        user_id: aliceId,
        shop_name: 'extra',
        domain: 'extra.myshopify.com',
        access_token: 'tok',
        scope: '',
        status: 'active',
      }).lastInsertRowid
    )
    const beforeOrders = db.prepare('SELECT COUNT(*) c FROM orders').get() as { c: number }

    const second = seedDemoData(db)

    expect(second.compliance).toBe(0)
    expect(second.adCampaigns).toBe(0)
    expect(second.adSuggestions).toBe(0)
    expect(second.products).toBe(0)
    expect(db.prepare('SELECT COUNT(*) c FROM compliance_items').get()).toEqual({ c: 48 })
    expect(db.prepare('SELECT COUNT(*) c FROM ad_campaigns').get()).toEqual({ c: 6 })
    expect(db.prepare('SELECT COUNT(*) c FROM ad_suggestions').get()).toEqual({ c: 6 })
    expect(db.prepare('SELECT COUNT(*) c FROM orders').get()).toEqual(beforeOrders)
    expect(shopId).toBeGreaterThan(0)
  })
})
