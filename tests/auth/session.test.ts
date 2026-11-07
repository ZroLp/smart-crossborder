import type Database from 'better-sqlite3'
import { NextRequest, NextResponse } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  clearSessionCookie,
  createSession,
  destroyCurrentSession,
  destroyOtherSessionsForUser,
  getSessionToken,
  getSessionUser,
  hashSessionToken,
  setSessionCookie,
} from '@/lib/auth/session'

let db: Database.Database
let userId: number

function requestWithToken(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const repo = new UserRepository(db)
  const created = repo.create({ username: 'alice', password: 'x', email: 'a@test.com', role: 'admin' })
  userId = Number(created.lastInsertRowid)
})

afterEach(() => {
  db.close()
})

describe('session storage', () => {
  test('stores only the SHA-256 hash of the token', () => {
    const token = createSession(userId, db)
    const row = db.prepare('SELECT token_hash, user_id FROM sessions').get() as {
      token_hash: string
      user_id: number
    }

    expect(row.token_hash).toBe(hashSessionToken(token))
    expect(row.token_hash).not.toBe(token)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(row.user_id).toBe(userId)
  })

  test('resolves the user from the session cookie', () => {
    const token = createSession(userId, db)
    const user = getSessionUser(requestWithToken(token), db)

    expect(user).toEqual({ id: userId, username: 'alice', email: 'a@test.com', role: 'admin' })
  })

  test('resolves the user from a raw Cookie header', () => {
    const token = createSession(userId, db)
    const request = {
      headers: { get: (name: string) => (name === 'cookie' ? `other=1; ${SESSION_COOKIE_NAME}=${token}` : null) },
    }

    expect(getSessionUser(request, db)!.id).toBe(userId)
  })

  test('returns null without a cookie or with an unknown token', () => {
    expect(getSessionUser(requestWithToken(), db)).toBeNull()
    expect(getSessionUser(requestWithToken('deadbeef'), db)).toBeNull()
  })

  test('rejects and deletes expired sessions', () => {
    const token = 'expired-token'
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      hashSessionToken(token),
      userId,
      Date.now() - 1000
    )

    expect(getSessionUser(requestWithToken(token), db)).toBeNull()
    const count = db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }
    expect(count.c).toBe(0)
  })

  test('new sessions expire after seven days', () => {
    const before = Date.now()
    createSession(userId, db)
    const row = db.prepare('SELECT expires_at FROM sessions').get() as { expires_at: number }
    expect(row.expires_at).toBeGreaterThanOrEqual(before + SESSION_TTL_MS - 1000)
    expect(row.expires_at).toBeLessThanOrEqual(Date.now() + SESSION_TTL_MS + 1000)
  })

  test('destroys the current session on logout', () => {
    const token = createSession(userId, db)
    destroyCurrentSession(requestWithToken(token), db)

    expect(getSessionUser(requestWithToken(token), db)).toBeNull()
    expect(getSessionToken(requestWithToken(token))).toBe(token)
  })

  test('keeps the current session and destroys the other sessions', () => {
    const current = createSession(userId, db)
    createSession(userId, db)
    createSession(userId, db)

    destroyOtherSessionsForUser(userId, current, db)

    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).toBe(hashSessionToken(current))
    expect(getSessionUser(requestWithToken(current), db)).not.toBeNull()
  })
})

describe('session cookie attributes', () => {
  test('sets an HttpOnly, SameSite=Lax, path=/ cookie', () => {
    const response = NextResponse.json({ ok: true })
    setSessionCookie(response, 'token-value')

    const cookie = response.cookies.get(SESSION_COOKIE_NAME)
    expect(cookie?.value).toBe('token-value')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('lax')
    expect(cookie?.path).toBe('/')
    expect(cookie?.maxAge).toBe(Math.floor(SESSION_TTL_MS / 1000))
  })

  test('clears the cookie', () => {
    const response = NextResponse.json({ ok: true })
    clearSessionCookie(response)

    const cookie = response.cookies.get(SESSION_COOKIE_NAME)
    expect(cookie?.value).toBe('')
    expect(cookie?.maxAge).toBe(0)
  })
})
