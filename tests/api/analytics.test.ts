import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { createTask, executeTaskById, resetTaskRuntimeForTests } from '@/lib/agents/task-service'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { POST as postShop } from '@/app/api/shop/route'
import { POST as postTrack } from '@/app/api/analytics/track/route'
import { GET as getSummary } from '@/app/api/analytics/summary/route'

const mockExecuteTask = jest.fn()

jest.mock('@/lib/api/agent-service', () => {
  const actual = jest.requireActual('@/lib/api/agent-service')
  return {
    ...actual,
    getOrchestrator: jest.fn(() => ({
      executeTask: mockExecuteTask,
      executeChain: jest.fn(),
    })),
  }
})

let db: DbClient
let token: string
let userId: number

function authedPost(path: string, body: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${token}` },
    body,
  })
}

function anonymousPost(path: string, body: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

function authedGet(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'GET',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  })
}

async function eventRows(userIdToQuery?: number): Promise<Array<{ event_name: string; source: string | null }>> {
  if (userIdToQuery != null) {
    return (await db.prepare('SELECT event_name, source FROM analytics_events WHERE user_id = ?').all(userIdToQuery)) as Array<{ event_name: string; source: string | null }>
  }
  return (await db.prepare('SELECT event_name, source FROM analytics_events').all()) as Array<{ event_name: string; source: string | null }>
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  jest.clearAllMocks()
  resetTaskRuntimeForTests()
  delete process.env.TASK_QUEUE_ENABLED
  userId = Number(
    (
      await new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' })
    ).lastInsertRowid
  )
  token = await createSession(userId, db)
  mockExecuteTask.mockResolvedValue({ success: true, data: {} })
})

afterEach(async () => {
  await db.close()
})

describe('POST /api/analytics/track', () => {
  test('401 without session', async () => {
    const response = await postTrack(anonymousPost('/api/analytics/track', JSON.stringify({ eventName: 'signup' })))
    expect(response.status).toBe(401)
  })

  test('202 for valid events and persists the row', async () => {
    const response = await postTrack(
      authedPost('/api/analytics/track', JSON.stringify({ eventName: 'signup', source: 'utm:blog', sessionId: 's-1', properties: { plan: 'pro' } }))
    )
    expect(response.status).toBe(202)
    expect((await response.json()).ok).toBe(true)

    const rows = await eventRows(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0].event_name).toBe('signup')
    expect(rows[0].source).toBe('utm:blog')
  })

  test('400 for unknown event names (whitelist of 4)', async () => {
    for (const name of ['hacked', 'TASK_SUBMITTED', '']) {
      const response = await postTrack(authedPost('/api/analytics/track', JSON.stringify({ eventName: name })))
      expect(response.status).toBe(400)
    }
  })

  test('400 when properties is not a plain object', async () => {
    for (const bad of ['str', [1, 2], null]) {
      const response = await postTrack(authedPost('/api/analytics/track', JSON.stringify({ eventName: 'signup', properties: bad })))
      expect(response.status).toBe(400)
    }
  })
})

describe('GET /api/analytics/summary', () => {
  test('returns zeroed totals and empty sources for a fresh user', async () => {
    const response = await getSummary(authedGet('/api/analytics/summary'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.totals).toEqual({ signup: 0, shop_connected: 0, task_submitted: 0, task_completed: 0 })
    expect(data.data.sources).toEqual([])
  })

  test('aggregates totals, source attribution and funnel', async () => {
    await postTrack(authedPost('/api/analytics/track', JSON.stringify({ eventName: 'signup', source: 'utm:blog' })))
    await postTrack(authedPost('/api/analytics/track', JSON.stringify({ eventName: 'signup' })))

    const response = await getSummary(authedGet('/api/analytics/summary'))
    const data = await response.json()

    expect(data.data.totals.signup).toBe(2)
    // attribution: 'utm:blog' (1) + 'direct' (1); ties broken alphabetically
    expect(data.data.sources).toEqual([
      { source: 'direct', count: 1 },
      { source: 'utm:blog', count: 1 },
    ])
    expect(data.data.funnel.signup).toBe(2)
  })

  test('is scoped to the session user only', async () => {
    const otherId = Number(
      (
        await new UserRepository(db).create({ username: 'mallory', password: 'x', email: null, role: 'viewer' })
      ).lastInsertRowid
    )
    const otherToken = await createSession(otherId, db)
    const otherReq = new NextRequest('http://localhost/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${otherToken}` },
      body: JSON.stringify({ eventName: 'signup', source: 'utm:evil' }),
    })
    await postTrack(otherReq)

    const response = await getSummary(authedGet('/api/analytics/summary'))
    const data = await response.json()
    expect(data.data.totals.signup).toBe(0)
    expect(JSON.stringify(data.data.sources)).not.toContain('utm:evil')
  })
})

describe('P5-02 server-side event wiring', () => {
  test('shop binding records shop_connected', async () => {
    const response = await postShop(
      authedPost('/api/shop', JSON.stringify({ shopName: 'Demo', domain: 'demo.myshopify.com', accessToken: 'shpat_x' }))
    )
    expect(response.status).toBe(200)

    const rows = await eventRows(userId)
    expect(rows.map((row) => row.event_name)).toEqual(['shop_connected'])
  })

  test('task creation and completion record task_submitted / task_completed', async () => {
    const task = await createTask('ad-optimizer', { adData: { campaigns: [] } }, userId)
    expect((await eventRows(userId)).map((row) => row.event_name)).toEqual(['task_submitted'])

    const result = await executeTaskById(Number(task.taskId), false)
    expect(result.status).toBe('completed')

    expect((await eventRows(userId)).map((row) => row.event_name)).toEqual(['task_submitted', 'task_completed'])
  })

  test('failed tasks do NOT record task_completed', async () => {
    mockExecuteTask.mockResolvedValue({ success: false, error: 'boom' })
    const task = await createTask('ad-optimizer', { adData: { campaigns: [] } }, userId)
    const result = await executeTaskById(Number(task.taskId), false)
    expect(result.status).toBe('failed')

    expect((await eventRows(userId)).map((row) => row.event_name)).toEqual(['task_submitted'])
  })

  test('events are isolated across users', async () => {
    await createTask('ad-optimizer', { adData: { campaigns: [] } }, userId)
    const otherId = Number(
      (
        await new UserRepository(db).create({ username: 'bob', password: 'x', email: null, role: 'viewer' })
      ).lastInsertRowid
    )
    expect(await eventRows(otherId)).toHaveLength(0)
    expect(await eventRows(userId)).toHaveLength(1)
  })
})
