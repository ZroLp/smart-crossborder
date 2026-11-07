import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { GET, POST } from '@/app/api/auth/route'

let db: Database.Database

function post(body: object, cookie?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function get(cookie?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    headers: cookie ? { cookie } : {},
  })
}

function extractSessionCookie(response: Response): string {
  const raw = response.headers.get('set-cookie') || ''
  const match = raw.match(/sumaitong_session=([^;]+)/)
  return match ? `sumaitong_session=${match[1]}` : ''
}

beforeEach(() => {
  db = initDatabase(':memory:')
  const repo = new UserRepository(db)
  repo.create({ username: 'alice', password: hashPassword('correctPass123'), email: 'a@test.com', role: 'viewer' })
  resetLoginRateLimitForTests()
})

afterEach(() => {
  db.close()
})

describe('POST /api/auth (login/register/logout)', () => {
  test('login success sets an HttpOnly session cookie and keeps userId', async () => {
    const response = await POST(post({ action: 'login', username: 'alice', password: 'correctPass123' }))
    const data = await response.json()
    const setCookie = response.headers.get('set-cookie') || ''

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe(1)
    expect(data.role).toBe('viewer')
    expect(setCookie).toContain('sumaitong_session=')
    expect(setCookie.toLowerCase()).toContain('httponly')

    const token = extractSessionCookie(response)
    expect(token).not.toBe('')
    expect(db.prepare('SELECT COUNT(*) as c FROM sessions').get()).toEqual({ c: 1 })
  })

  test('GET /api/auth returns the session user instead of requiring userId', async () => {
    const login = await POST(post({ action: 'login', username: 'alice', password: 'correctPass123' }))
    const cookie = extractSessionCookie(login)

    const response = await GET(get(cookie))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.id).toBe(1)
    expect(data.user.username).toBe('alice')
    expect(data.role).toBe('viewer')
  })

  test('GET /api/auth returns 401 without a session', async () => {
    const response = await GET(get())
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('logout destroys the session and clears the cookie', async () => {
    const login = await POST(post({ action: 'login', username: 'alice', password: 'correctPass123' }))
    const cookie = extractSessionCookie(login)

    const logout = await POST(post({ action: 'logout' }, cookie))
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie') || '').toContain('sumaitong_session=;')

    const after = await GET(get(cookie))
    expect(after.status).toBe(401)
  })

  test('rejects invalid credentials and weak registration', async () => {
    const invalid = await POST(post({ action: 'login', username: 'alice', password: 'wrongPass123' }))
    const invalidData = await invalid.json()
    expect(invalidData.success).toBe(false)
    expect(invalidData.code).toBe('INVALID_CREDENTIALS')

    const weak = await POST(post({ action: 'register', username: 'newuser', password: 'short' }))
    expect(weak.status).toBe(400)
    expect((await weak.json()).code).toBe('WEAK_PASSWORD')
  })

  test('returns 429 with Retry-After from the sixth attempt on', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await POST(post({ action: 'login', username: 'alice', password: 'wrongPass123' }))
      expect(response.status).not.toBe(429)
    }

    const blocked = await POST(post({ action: 'login', username: 'alice', password: 'wrongPass123' }))
    const data = await blocked.json()

    expect(blocked.status).toBe(429)
    expect(data.code).toBe('RATE_LIMITED')
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
})
