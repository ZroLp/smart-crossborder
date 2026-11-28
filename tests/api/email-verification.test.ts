import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { GET as authGET, POST as authPOST } from '@/app/api/auth/route'
import { GET as emailGET, POST as emailPOST } from '@/app/api/auth/email/route'
import { GET as devicesGET } from '@/app/api/auth/devices/route'

let db: DbClient

const UA = 'Mozilla/5.0 P6TestBot'

function extractSessionCookie(response: Response): string {
  const raw = response.headers.get('set-cookie') || ''
  const match = raw.match(/sumaitong_session=([^;]+)/)
  return match ? `sumaitong_session=${match[1]}` : ''
}

async function register(user: {
  username: string
  password: string
  email?: string | null
}): Promise<string> {
  const response = await authPOST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': UA,
        'x-forwarded-for': '9.8.7.6',
      },
      body: JSON.stringify({ action: 'register', username: user.username, password: user.password, email: user.email ?? null }),
    })
  )
  expect(response.status).toBe(200)
  return extractSessionCookie(response)
}

function postJson(url: string, body: object, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function getUrl(url: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers: cookie ? { cookie } : {} })
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  await new UserRepository(db).create({ username: 'alice', password: hashPassword('correctPass123'), email: 'a@test.com' })
})

afterEach(async () => {
  await db.close()
})

describe('register with email (P6-01)', () => {
  test('stores the normalized email and returns it', async () => {
    const cookie = await register({ username: 'bob', password: 'StrongPass123', email: 'BOB@Example.COM' })
    const me = await authGET(getUrl('/api/auth', cookie))
    const data = await me.json()
    expect(data.user.email).toBe('bob@example.com')
    expect(data.user.email_verified_at).toBeNull()
  })

  test('rejects malformed email', async () => {
    const response = await authPOST(
      new NextRequest('http://localhost/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username: 'carol', password: 'StrongPass123', email: 'not-an-email' }),
      })
    )
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('INVALID_INPUT')
  })
})

describe('POST /api/auth/email (P6-01)', () => {
  test('full verify flow: request -> wrong code -> correct code', async () => {
    const cookie = await register({ username: 'dave', password: 'StrongPass123', email: 'dave@test.com' })

    const requestRes = await emailPOST(postJson('/api/auth/email', { action: 'request' }, cookie))
    expect(requestRes.status).toBe(200)
    const requestData = await requestRes.json()
    expect(requestData.sent).toBe(true)
    expect(typeof requestData.devCode).toBe('string')

    const wrong = await emailPOST(postJson('/api/auth/email', { action: 'confirm', code: '000000' }, cookie))
    expect(wrong.status).toBe(400)
    expect((await wrong.json()).code).toBe('INVALID_CODE')

    const ok = await emailPOST(postJson('/api/auth/email', { action: 'confirm', code: requestData.devCode }, cookie))
    expect(ok.status).toBe(200)
    expect((await ok.json()).verified).toBe(true)

    const status = await emailGET(getUrl('/api/auth/email', cookie))
    const statusData = await status.json()
    expect(statusData.verified).toBe(true)
    expect(statusData.email).toBe('dave@test.com')

    const row = await db.prepare('SELECT email_verified_at FROM users WHERE username = ?').get('dave')
    expect(row).toMatchObject({ email_verified_at: expect.any(String) })
  })

  test('cooldown suppresses immediate re-send', async () => {
    const cookie = await register({ username: 'erin', password: 'StrongPass123', email: 'e@test.com' })

    const first = await emailPOST(postJson('/api/auth/email', { action: 'request' }, cookie))
    expect((await first.json()).sent).toBe(true)

    const second = await emailPOST(postJson('/api/auth/email', { action: 'request' }, cookie))
    expect(second.status).toBe(200)
    const secondData = await second.json()
    expect(secondData.sent).toBe(false)
    expect(secondData.devCode).toBeUndefined()
  })

  test('400 EMAIL_NOT_SET when the account has no email', async () => {
    const cookie = await register({ username: 'frank', password: 'StrongPass123' })
    const res = await emailPOST(postJson('/api/auth/email', { action: 'request' }, cookie))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('EMAIL_NOT_SET')
  })

  test('requires authentication', async () => {
    const res = await emailGET(getUrl('/api/auth/email'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/devices (P6-01)', () => {
  test('login records device + IP', async () => {
    const cookie = await register({ username: 'gina', password: 'StrongPass123', email: 'g@test.com' })
    const res = await devicesGET(getUrl('/api/auth/devices', cookie))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.devices).toHaveLength(1)
    expect(data.devices[0].user_agent).toBe(UA)
    expect(data.devices[0].ip).toBe('9.8.7.6')

    // second login from a different IP upserts the same device (same UA)
    await authPOST(
      new NextRequest('http://localhost/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': UA,
          'x-forwarded-for': '5.6.7.8',
          cookie,
        },
        body: JSON.stringify({ action: 'login', username: 'gina', password: 'StrongPass123' }),
      })
    )
    const after = await devicesGET(getUrl('/api/auth/devices', cookie))
    const afterData = await after.json()
    expect(afterData.devices).toHaveLength(1)
    expect(afterData.devices[0].ip).toBe('5.6.7.8')
  })
})
