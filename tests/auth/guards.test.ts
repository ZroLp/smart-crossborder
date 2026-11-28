import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { DbClient } from '@/lib/db/client'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { requireAdmin, requireRole, requireUser } from '@/lib/auth/guards'

let db: DbClient
let adminId: number
let viewerId: number

function request(options: { token?: string; url?: string } = {}): NextRequest {
  return new NextRequest(options.url ?? 'http://localhost/api/test', {
    headers: options.token ? { cookie: `${SESSION_COOKIE_NAME}=${options.token}` } : {},
  })
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  const repo = new UserRepository(db)
  adminId = Number((await repo.create({ username: 'admin-user', password: 'x', email: null, role: 'admin' })).lastInsertRowid)
  viewerId = Number((await repo.create({ username: 'viewer-user', password: 'x', email: null, role: 'viewer' })).lastInsertRowid)
})

afterEach(async () => {
  await db.close()
})

describe('requireUser', () => {
  test('returns 401 for anonymous requests', async () => {
    const result = await requireUser(request())
    expect(result.user).toBeNull()
    expect(result.response!.status).toBe(401)
  })

  test('returns the session user for authenticated requests', async () => {
    const token = await createSession(viewerId, db)
    const result = await requireUser(request({ token }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(viewerId)
    expect(result.user!.role).toBe('viewer')
  })
})

describe('requireAdmin', () => {
  test('allows admins', async () => {
    const token = await createSession(adminId, db)
    const result = await requireAdmin(request({ token }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(adminId)
  })

  test('returns 403 for non-admin sessions', async () => {
    const token = await createSession(viewerId, db)
    const result = await requireAdmin(request({ token }))
    expect(result.response!.status).toBe(403)
    expect(result.user).toBeNull()
  })

  test('returns 403 for roles outside the allow-list', async () => {
    const token = await createSession(viewerId, db)
    const result = await requireRole(request({ token }), ['operator'])
    expect(result.response!.status).toBe(403)
  })
})

describe('query userId is never an identity source', () => {
  test('returns 401 for anonymous requests carrying a userId', async () => {
    const result = await requireUser(request({ url: `http://localhost/api/test?userId=${adminId}` }))
    expect(result.user).toBeNull()
    expect(result.response!.status).toBe(401)
  })

  test('session identity wins over a mismatched query userId', async () => {
    const token = await createSession(viewerId, db)
    const result = await requireUser(request({ token, url: `http://localhost/api/test?userId=${adminId}` }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(viewerId)
  })
})
