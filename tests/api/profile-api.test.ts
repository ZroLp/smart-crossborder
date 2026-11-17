import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { GET as getProfile } from '@/app/api/profile/route'

let db: Database.Database
let aliceId: number
let bobId: number
let aliceToken: string
let aliceSecondToken: string
let bobToken: string

function request(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/profile', {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  aliceId = Number(users.create({ username: 'alice', password: 'x', email: 'a@test.com', role: 'admin' }).lastInsertRowid)
  bobId = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  aliceToken = createSession(aliceId, db)
  aliceSecondToken = createSession(aliceId, db)
  bobToken = createSession(bobId, db)

  db.prepare('INSERT INTO user_preferences (user_id, locale, timezone, currency) VALUES (?, ?, ?, ?)').run(
    aliceId,
    'en',
    'America/New_York',
    'USD'
  )
})

afterEach(() => {
  db.close()
})

describe('GET /api/profile', () => {
  test('requires a session', async () => {
    const response = await getProfile(request())
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('returns user without password, preferences and own sessions only', async () => {
    const response = await getProfile(request(aliceToken))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.user.id).toBe(aliceId)
    expect(body.data.user.username).toBe('alice')
    expect(body.data.user.email).toBe('a@test.com')
    expect(body.data.user.role).toBe('admin')
    expect(body.data.user.password).toBeUndefined()

    expect(body.data.preferences).toEqual({
      locale: 'en',
      timezone: 'America/New_York',
      currency: 'USD',
    })

    expect(body.data.sessions).toHaveLength(2)
    for (const session of body.data.sessions as Array<Record<string, unknown>>) {
      expect(session.token_hash).toBeUndefined()
      expect(session.ip).toBe('未知')
      expect(['当前设备', '未知']).toContain(session.device)
      expect(session.createdAt).toBeDefined()
      expect(session.expiresAt).toBeDefined()
    }

    const current = (body.data.sessions as Array<{ current: boolean; device: string }>).filter(
      (session) => session.current
    )
    expect(current).toHaveLength(1)
    expect(current[0].device).toBe('当前设备')

    // bob 的会话不出现在 alice 的列表中
    expect((body.data.sessions as Array<{ id: number }>).length).toBe(
      (db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ?').get(aliceId) as { c: number }).c
    )
    expect((db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ?').get(bobId) as { c: number }).c).toBe(1)
    expect(bobToken).toBeTruthy()
  })

  test('returns null preferences when the user has none', async () => {
    const body = await (await getProfile(request(bobToken))).json()
    expect(body.data.preferences).toBeNull()
    expect(body.data.sessions).toHaveLength(1)
    expect(body.data.sessions[0].current).toBe(true)
  })
})
