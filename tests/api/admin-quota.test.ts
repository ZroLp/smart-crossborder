import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { createTask } from '@/lib/agents/task-service'

const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => {
  const actual = jest.requireActual('@/lib/auth/session')
  return { ...actual, getSessionUser: (...args: unknown[]) => mockGetSessionUser(...args) }
})

import { GET as getQuotaUsage } from '@/app/api/admin/quota/usage/route'

let db: DbClient
let adminUserId: number
let viewerUserId: number

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  jest.clearAllMocks()

  adminUserId = Number(
    (
      await new UserRepository(db).create({
        username: 'admin',
        password: 'x',
        email: null,
        role: 'admin',
      })
    ).lastInsertRowid
  )
  viewerUserId = Number(
    (
      await new UserRepository(db).create({
        username: 'bob',
        password: 'x',
        email: null,
        role: 'viewer',
      })
    ).lastInsertRowid
  )
  // Two active AI tasks for the viewer → usage 2, no limit (unlimited).
  await createTask('selection', {}, viewerUserId)
  await createTask('content', {}, viewerUserId)
})

afterEach(async () => {
  await db.close()
})

function adminRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/quota/usage')
}

describe('GET /api/admin/quota/usage', () => {
  test('returns per-user usage and totals for an admin', async () => {
    mockGetSessionUser.mockResolvedValue({
      id: adminUserId,
      username: 'admin',
      email: null,
      role: 'admin',
    })

    const response = await getQuotaUsage(adminRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.users)).toBe(true)
    expect(data.users).toHaveLength(2)

    const viewer = data.users.find((u: { userId: number }) => u.userId === viewerUserId)
    expect(viewer).toBeDefined()
    expect(viewer.plan).toBeNull()
    expect(viewer.aiCallsLimit).toBeNull()
    expect(viewer.aiCallsUsed).toBe(2)

    expect(data.totals.userCount).toBe(2)
    expect(data.totals.totalUsed).toBe(2)
  })

  test('reflects a configured subscription limit in the usage rows', async () => {
    await db
      .prepare('UPDATE users SET subscription_ai_calls = ?, subscription_plan = ? WHERE id = ?')
      .run(500, 'Pro', viewerUserId)
    mockGetSessionUser.mockResolvedValue({
      id: adminUserId,
      username: 'admin',
      email: null,
      role: 'admin',
    })

    const data = await (await getQuotaUsage(adminRequest())).json()
    const viewer = data.users.find((u: { userId: number }) => u.userId === viewerUserId)
    expect(viewer.plan).toBe('Pro')
    expect(viewer.aiCallsLimit).toBe(500)
    expect(data.totals.limited).toBe(1)
    expect(data.totals.unlimited).toBe(1)
  })

  test('returns 403 FORBIDDEN for non-admin sessions', async () => {
    mockGetSessionUser.mockResolvedValue({
      id: viewerUserId,
      username: 'bob',
      email: null,
      role: 'viewer',
    })

    const response = await getQuotaUsage(adminRequest())
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('FORBIDDEN')
  })

  test('returns 401 UNAUTHORIZED for anonymous requests', async () => {
    mockGetSessionUser.mockResolvedValue(null)

    const response = await getQuotaUsage(adminRequest())
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })
})
