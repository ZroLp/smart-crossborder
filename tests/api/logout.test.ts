import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { GET as authGet } from '@/app/api/auth/route'

let db: Database.Database
let userId: number
let token: string

function request(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

beforeEach(() => {
  db = initDatabase(':memory:')
  userId = Number(
    new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' })
      .lastInsertRowid
  )
  token = createSession(userId, db)
})

afterEach(() => {
  db.close()
})

describe('POST /api/auth/logout', () => {
  test('destroys the current session and clears the cookie', async () => {
    const response = await logoutPost(request(token))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(response.headers.get('set-cookie') || '').toContain('sumaitong_session=;')
    expect(db.prepare('SELECT COUNT(*) c FROM sessions').get()).toEqual({ c: 0 })

    const protectedResponse = await authGet(
      new NextRequest('http://localhost/api/auth', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      })
    )
    expect(protectedResponse.status).toBe(401)
  })

  test('keeps other device sessions alive', async () => {
    const otherToken = createSession(userId, db)

    await logoutPost(request(token))

    const stillValid = await authGet(
      new NextRequest('http://localhost/api/auth', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${otherToken}` },
      })
    )
    expect(stillValid.status).toBe(200)
  })

  test('is idempotent for anonymous requests', async () => {
    const response = await logoutPost(request())
    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
  })
})
