import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { seedDemoData } from '@/lib/db/seed'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getCampaigns } from '@/app/api/ad-campaigns/route'
import { GET as getCampaign } from '@/app/api/ad-campaigns/[id]/route'

let db: Database.Database
let aliceToken: string
let bobToken: string

function request(url = 'http://localhost/api/ad-campaigns', token?: string): NextRequest {
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
  const aliceId = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  const bobId = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  aliceToken = createSession(aliceId, db)
  bobToken = createSession(bobId, db)
  seedDemoData(db)
})

afterEach(() => {
  db.close()
})

describe('GET /api/ad-campaigns', () => {
  test('requires a session', async () => {
    const response = await getCampaigns(request())
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('returns campaigns and suggestions for the current user', async () => {
    const response = await getCampaigns(request(undefined, aliceToken))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.campaigns).toHaveLength(3)
    expect(body.data.suggestions).toHaveLength(3)

    const campaign = body.data.campaigns[0] as {
      externalId: string
      platform: string
      audience: Record<string, unknown>
      creatives: unknown[]
    }
    expect(campaign.externalId).toBe('camp-fb-001')
    expect(campaign.platform).toBe('facebook')
    expect(campaign.audience).toEqual(expect.objectContaining({ ageRange: '25-34' }))
    expect(campaign.creatives.length).toBeGreaterThan(0)

    const suggestion = body.data.suggestions[0] as { campaignExternalId: string; title: string }
    expect(suggestion.campaignExternalId).toBe('camp-fb-001')
    expect(suggestion.title.length).toBeGreaterThan(0)
  })

  test('isolates campaigns between users', async () => {
    const alice = await (await getCampaigns(request(undefined, aliceToken))).json()
    const bob = await (await getCampaigns(request(undefined, bobToken))).json()

    const aliceIds = new Set(alice.data.campaigns.map((c: { id: number }) => c.id))
    expect(bob.data.campaigns).toHaveLength(3)
    expect(bob.data.campaigns.every((c: { id: number }) => !aliceIds.has(c.id))).toBe(true)
  })
})

describe('GET /api/ad-campaigns/[id]', () => {
  test('resolves by numeric id and by external id with audience/creatives', async () => {
    const list = await (await getCampaigns(request(undefined, aliceToken))).json()
    const campaign = list.data.campaigns[1] as { id: number; externalId: string }

    const byId = await getCampaign(
      request(`http://localhost/api/ad-campaigns/${campaign.id}`, aliceToken),
      params(String(campaign.id))
    )
    const byIdBody = await byId.json()
    expect(byId.status).toBe(200)
    expect(byIdBody.data.campaign.id).toBe(campaign.id)
    expect(byIdBody.data.campaign.audience).toEqual(expect.any(Object))
    expect(Array.isArray(byIdBody.data.campaign.creatives)).toBe(true)
    expect(byIdBody.data.suggestions).toHaveLength(1)

    const byExternal = await getCampaign(
      request(`http://localhost/api/ad-campaigns/${campaign.externalId}`, aliceToken),
      params(campaign.externalId)
    )
    expect((await byExternal.json()).data.campaign.id).toBe(campaign.id)
  })

  test('returns 404 for other users and unknown campaigns', async () => {
    const list = await (await getCampaigns(request(undefined, aliceToken))).json()
    const campaign = list.data.campaigns[0] as { id: number }

    const cross = await getCampaign(
      request(`http://localhost/api/ad-campaigns/${campaign.id}`, bobToken),
      params(String(campaign.id))
    )
    expect(cross.status).toBe(404)

    const missing = await getCampaign(
      request('http://localhost/api/ad-campaigns/99999', aliceToken),
      params('99999')
    )
    expect(missing.status).toBe(404)
  })
})
