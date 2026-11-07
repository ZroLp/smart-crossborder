import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { requireAdmin, requireRole, requireUser } from '@/lib/auth/guards'

let db: Database.Database
let adminId: number
let viewerId: number

function request(options: { token?: string; url?: string } = {}): NextRequest {
  return new NextRequest(options.url ?? 'http://localhost/api/test', {
    headers: options.token ? { cookie: `${SESSION_COOKIE_NAME}=${options.token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const repo = new UserRepository(db)
  adminId = Number(repo.create({ username: 'admin-user', password: 'x', email: null, role: 'admin' }).lastInsertRowid)
  viewerId = Number(repo.create({ username: 'viewer-user', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  delete process.env.AUTH_LEGACY_COMPAT
})

afterEach(() => {
  db.close()
  delete process.env.AUTH_LEGACY_COMPAT
})

describe('requireUser', () => {
  test('returns 401 for anonymous requests', () => {
    const result = requireUser(request())
    expect(result.user).toBeNull()
    expect(result.response!.status).toBe(401)
  })

  test('returns the session user for authenticated requests', () => {
    const token = createSession(viewerId, db)
    const result = requireUser(request({ token }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(viewerId)
    expect(result.user!.role).toBe('viewer')
  })
})

describe('requireAdmin', () => {
  test('allows admins', () => {
    const token = createSession(adminId, db)
    const result = requireAdmin(request({ token }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(adminId)
  })

  test('returns 403 for non-admin sessions', () => {
    const token = createSession(viewerId, db)
    const result = requireAdmin(request({ token }))
    expect(result.response!.status).toBe(403)
    expect(result.user).toBeNull()
  })

  test('returns 403 for roles outside the allow-list', () => {
    const token = createSession(viewerId, db)
    const result = requireRole(request({ token }), ['operator'])
    expect(result.response!.status).toBe(403)
  })
})

describe('AUTH_LEGACY_COMPAT', () => {
  test('is disabled by default: query userId does not authenticate', () => {
    const result = requireUser(request({ url: `http://localhost/api/test?userId=${adminId}` }))
    expect(result.response!.status).toBe(401)
  })

  test('can be enabled as a local fallback', () => {
    process.env.AUTH_LEGACY_COMPAT = '1'
    const result = requireUser(request({ url: `http://localhost/api/test?userId=${adminId}` }))
    expect(result.response).toBeNull()
    expect(result.user!.id).toBe(adminId)
  })

  test('session still wins over the legacy fallback', () => {
    process.env.AUTH_LEGACY_COMPAT = '1'
    const token = createSession(viewerId, db)
    const result = requireUser(request({ token, url: `http://localhost/api/test?userId=${adminId}` }))
    expect(result.user!.id).toBe(viewerId)
  })
})
