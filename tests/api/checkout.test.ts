import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { MOCK_3DS_CODE } from '@/lib/payment/payment-service'
import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { POST as confirmPOST } from '@/app/api/payments/[id]/confirm/route'
import { GET as paymentGET } from '@/app/api/payments/[id]/route'
import { GET as subscriptionGET, POST as subscriptionPOST } from '@/app/api/subscription/route'

let db: DbClient

function json(url: string, body: object, cookie?: string): NextRequest {
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

async function makeUser(username: string, email?: string): Promise<{ cookie: string; userId: number }> {
  const userRepo = new UserRepository(db)
  await userRepo.create({ username, password: hashPassword('Str0ngPass!'), email })
  const id = Number((await userRepo.findByUsername(username))!.id)

  const response = await (await import('@/app/api/auth/route')).POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'P603Test/1.0', 'x-forwarded-for': '10.0.0.7' },
      body: JSON.stringify({ action: 'login', username, password: 'Str0ngPass!' }),
    })
  )
  const setCookie = response.headers.get('set-cookie') || ''
  const match = setCookie.match(/sumaitong_session=([^;]+)/)
  return { cookie: match ? `sumaitong_session=${match[1]}` : '', userId: id }
}

async function checkout(cookie: string, plan: string): Promise<{ status: number; body: any }> {
  const res = await checkoutPOST(json('/api/checkout', { plan }, cookie))
  return { status: res.status, body: await res.json() }
}

async function confirm(paymentId: string, cookie: string, code?: string): Promise<{ status: number; body: any }> {
  const res = await confirmPOST(
    json(`/api/payments/${paymentId}/confirm`, code !== undefined ? { code } : {}, cookie),
    { params: { id: paymentId } }
  )
  return { status: res.status, body: await res.json() }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
})

afterEach(async () => {
  await db.close()
})

describe('POST /api/checkout (P6-03)', () => {
  test('401 without session', async () => {
    const { status, body } = await checkout('', 'pro')
    expect(status).toBe(401)
  })

  test('missing / unknown plan → 400', async () => {
    const bob = await makeUser('bob')
    expect((await checkout(bob.cookie, '')).status).toBe(400)
    expect((await checkout(bob.cookie, 'platinum')).status).toBe(400)
  })

  test('pro checkout creates a pending payment', async () => {
    const bob = await makeUser('bob')
    const { status, body } = await checkout(bob.cookie, 'pro')
    expect(status).toBe(201)
    expect(body.data.status).toBe('pending')
    expect(body.data.amountCents).toBe(29900)
    expect(body.data.threeds).toBe(false)
  })
})

describe('POST /api/payments/:id/confirm + subscription activation (P6-03)', () => {
  test('confirming pro activates the subscription and entitlements', async () => {
    const bob = await makeUser('bob')
    const { body } = await checkout(bob.cookie, 'pro')
    const paymentId = body.data.paymentId as string

    const ok = await confirm(paymentId, bob.cookie)
    expect(ok.status).toBe(200)
    expect(ok.body.status).toBe('succeeded')

    // entitlement projection
    const userRow = await db.prepare('SELECT subscription_plan, subscription_ai_calls, subscription_stores FROM users WHERE id = ?').get(bob.userId)
    expect(userRow).toMatchObject({ subscription_plan: 'Pro', subscription_ai_calls: 50000, subscription_stores: 10 })

    // active subscription row
    const sub = await db.prepare('SELECT plan_key, status, cancel_at_period_end FROM subscriptions WHERE user_id = ?').get(bob.userId)
    expect(sub).toMatchObject({ plan_key: 'pro', status: 'active', cancel_at_period_end: false })

    // GET /api/subscription reflects the active sub
    const subRes = await subscriptionGET(getUrl('/api/subscription', bob.cookie))
    const subData = await subRes.json()
    expect(subRes.status).toBe(200)
    expect(subData.data.subscription.plan_key).toBe('pro')
    expect(subData.data.subscription.cancel_at_period_end).toBe(false)

    // confirming again is a no-op (idempotent)
    const again = await confirm(paymentId, bob.cookie)
    expect(again.status).toBe(200)
  })

  test('cross-user payment → 404', async () => {
    const bob = await makeUser('bob')
    const carol = await makeUser('carol')
    const { body } = await checkout(bob.cookie, 'basic')
    const paymentId = body.data.paymentId as string

    const other = await confirm(paymentId, carol.cookie)
    expect(other.status).toBe(404)

    const view = await paymentGET(getUrl(`/api/payments/${paymentId}`, carol.cookie), { params: { id: paymentId } })
    expect(view.status).toBe(404)
  })
})

describe('3DS flow (P6-03)', () => {
  test('enterprise requires 3DS; wrong code fails, correct code activates', async () => {
    const bob = await makeUser('bob')
    const { status, body } = await checkout(bob.cookie, 'enterprise')
    expect(status).toBe(201)
    expect(body.data.status).toBe('requires_action')
    expect(body.data.threeds).toBe(true)
    const paymentId = body.data.paymentId as string

    // no code → 400 THREEDS_REQUIRED
    const noCode = await confirm(paymentId, bob.cookie)
    expect(noCode.status).toBe(400)
    expect(noCode.body.code).toBe('THREEDS_REQUIRED')

    // wrong 3DS code → 402 PAYMENT_FAILED, payment marked failed
    const wrong = await confirm(paymentId, bob.cookie, '000000')
    expect(wrong.status).toBe(402)
    const failedRow = await db.prepare('SELECT status FROM payments WHERE id = ?').get(paymentId)
    expect((failedRow as { status: string }).status).toBe('failed')

    // a fresh enterprise payment with the correct 3DS code succeeds
    const second = await checkout(bob.cookie, 'enterprise')
    const ok = await confirm(second.body.data.paymentId, bob.cookie, MOCK_3DS_CODE)
    expect(ok.status).toBe(200)
    expect(ok.body.status).toBe('succeeded')
    const userRow = await db.prepare('SELECT subscription_ai_calls FROM users WHERE id = ?').get(bob.userId)
    expect((userRow as { subscription_ai_calls: number | null }).subscription_ai_calls).toBe(-1)
  })
})

describe('POST /api/subscription (P6-03 lifecycle)', () => {
  test('cancel sets cancel_at_period_end, restore clears it', async () => {
    const bob = await makeUser('bob')
    const { body } = await checkout(bob.cookie, 'basic')
    await confirm(body.data.paymentId, bob.cookie)

    const cancelled = await subscriptionPOST(json('/api/subscription', { action: 'cancel' }, bob.cookie))
    expect(cancelled.status).toBe(200)
    expect(await cancelled.json()).toMatchObject({ success: true, cancelAtPeriodEnd: true })

    const restored = await subscriptionPOST(json('/api/subscription', { action: 'restore' }, bob.cookie))
    expect(restored.status).toBe(200)
    expect(await restored.json()).toMatchObject({ success: true, cancelAtPeriodEnd: false })
  })

  test('404 NO_SUBSCRIPTION when nothing is active', async () => {
    const bob = await makeUser('bob')
    const res = await subscriptionPOST(json('/api/subscription', { action: 'cancel' }, bob.cookie))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('NO_SUBSCRIPTION')
  })

  test('unknown action → 400', async () => {
    const bob = await makeUser('bob')
    const res = await subscriptionPOST(json('/api/subscription', { action: 'frobnicate' }, bob.cookie))
    expect(res.status).toBe(400)
  })
})
