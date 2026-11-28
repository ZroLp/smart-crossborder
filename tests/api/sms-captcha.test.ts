import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { GET as smsGET, POST as smsPOST } from '@/app/api/auth/sms/route'

let db: DbClient

interface Captured {
  captchaId: string
  a: number
  b: number
}

async function issueCaptcha(): Promise<Captured> {
  const res = await smsGET(new NextRequest('http://localhost/api/auth/sms'))
  expect(res.status).toBe(200)
  const data = await res.json()
  return { captchaId: data.captchaId, a: data.a, b: data.b }
}

function post(body: object, ip?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
})

afterEach(async () => {
  await db.close()
})

describe('GET /api/auth/sms (captcha)', () => {
  test('returns an arithmetic challenge', async () => {
    const { captchaId, a, b } = await issueCaptcha()
    expect(captchaId).not.toBe('')
    expect(a + b).toBeGreaterThan(19)
  })
})

describe('POST /api/auth/sms action=send', () => {
  test('correct captcha answer sends a code (devCode outside production)', async () => {
    const cap = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: String(cap.a + cap.b) }, '10.0.0.1')
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.delivery).toBe('mock')
    expect(String(data.devCode).length).toBe(6)
  })

  test('wrong captcha answer is rejected', async () => {
    const cap = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: '99999' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('CAPTCHA_INVALID')
  })

  test('captcha is single-use', async () => {
    const cap = await issueCaptcha()
    const ok = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: String(cap.a + cap.b) })
    )
    expect(ok.status).toBe(200)

    const reuse = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: String(cap.a + cap.b) })
    )
    expect(reuse.status).toBe(400)
    expect((await reuse.json()).code).toBe('CAPTCHA_INVALID')
  })

  test('phone cooldown blocks the second send within a minute', async () => {
    const cap = await issueCaptcha()
    await smsPOST(post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: String(cap.a + cap.b) }, '10.0.1.1'))

    const cap2 = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap2.captchaId, answer: String(cap2.a + cap2.b) })
    )
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('SMS_RATE_LIMITED')
  })

  test('per-phone daily cap blocks the 11th send', async () => {
    // seed 10 sends spread over the last 24h (expires_at is BIGINT ms)
    await db.exec(
      `INSERT INTO sms_verification_codes (phone, code_hash, expires_at, created_at)
       SELECT '+8613800001111', 'x', (extract(epoch from (now() + interval '10 minutes')) * 1000)::bigint, now() - (interval '1 hour' * s)
       FROM generate_series(0, 9) AS s`
    )
    const cap = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: '+8613800001111', captchaId: cap.captchaId, answer: String(cap.a + cap.b) }, '10.0.2.2')
    )
    expect(res.status).toBe(429)
  })

  test('per-IP hourly cap blocks sends from a busy IP', async () => {
    await db.exec(
      `INSERT INTO sms_verification_codes (phone, code_hash, ip, expires_at, created_at)
       SELECT v, 'x', '10.0.0.9', (extract(epoch from (now() + interval '10 minutes')) * 1000)::bigint, now()
       FROM unnest(ARRAY['+8613800000001', '+8613800000002', '+8613800000003']) AS v`
    )
    const cap = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: '+8613800004444', captchaId: cap.captchaId, answer: String(cap.a + cap.b) }, '10.0.0.9')
    )
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('SMS_RATE_LIMITED')
  })

  test('malformed phone is rejected', async () => {
    const cap = await issueCaptcha()
    const res = await smsPOST(
      post({ action: 'send', phone: 'nope', captchaId: cap.captchaId, answer: String(cap.a + cap.b) }, '10.0.3.3')
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.code).toBe('INVALID_INPUT')
  })
})

describe('POST /api/auth/sms action=verify', () => {
  test('wrong code then correct code verifies', async () => {
    const cap = await issueCaptcha()
    const sent = await smsPOST(
      post({ action: 'send', phone: '+8613900002222', captchaId: cap.captchaId, answer: String(cap.a + cap.b) })
    )
    const devCode = (await sent.json()).devCode as string

    const wrong = await smsPOST(post({ action: 'verify', phone: '+8613900002222', code: '000000' }))
    expect(wrong.status).toBe(400)
    expect((await wrong.json()).code).toBe('INVALID_CODE')

    const ok = await smsPOST(post({ action: 'verify', phone: '+8613900002222', code: devCode }))
    expect(ok.status).toBe(200)
    expect((await ok.json()).verified).toBe(true)

    // a verified code cannot be reused
    const reuse = await smsPOST(post({ action: 'verify', phone: '+8613900002222', code: devCode }))
    expect(reuse.status).toBe(400)
  })

  test('NO_CODE when nothing was requested', async () => {
    const res = await smsPOST(post({ action: 'verify', phone: '+8613955556666', code: '123456' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('NO_CODE')
  })
})
