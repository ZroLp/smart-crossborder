import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { signWebhook } from '@/lib/payment/payment-service'
import { POST as webhookPOST } from '@/app/api/webhooks/payment/route'

let db: DbClient

const SECRET = 'test-webhook-secret'

async function createPendingPayment(plan: 'basic' | 'pro' | 'enterprise' = 'basic'): Promise<{ userId: number; paymentId: string }> {
  const userRepo = new UserRepository(db)
  const username = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await userRepo.create({ username, password: hashPassword('Str0ngPass!'), email: null })
  const userId = Number((await userRepo.findByUsername(username))!.id)

  const { createCheckout } = await import('@/lib/payment/payment-service')
  const payment = await createCheckout(db, userId, plan)
  return { userId, paymentId: payment.id }
}

function signedRequest(payload: object, signature?: string): NextRequest {
  const raw = JSON.stringify(payload)
  const ts = String(Date.now())
  const sig = signature ?? signWebhook(SECRET, ts, raw)
  return new NextRequest('http://localhost/api/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment-timestamp': ts,
      'x-payment-signature': sig,
    },
    body: raw,
  })
}

function event(event_id: string, event_type: string, payment_id: string): Record<string, string> {
  return { event_id, event_type, payment_id }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
})

afterEach(async () => {
  delete process.env.PAYMENT_WEBHOOK_SECRET
  await db.close()
})

describe('POST /api/webhooks/payment (P6-04)', () => {
  test('payment.succeeded activates the subscription', async () => {
    const { userId, paymentId } = await createPendingPayment('basic')

    const res = await webhookPOST(signedRequest(event('evt-1', 'payment.succeeded', paymentId)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, result: 'processed' })

    const userRow = await db.prepare('SELECT subscription_plan FROM users WHERE id = ?').get(userId)
    expect((userRow as { subscription_plan: string }).subscription_plan).toBe('Basic')
    const sub = await db.prepare('SELECT plan_key FROM subscriptions WHERE user_id = ? AND status = ?').get(userId, 'active')
    expect((sub as { plan_key: string }).plan_key).toBe('basic')
  })

  test('duplicate event is acknowledged without re-applying', async () => {
    const { paymentId } = await createPendingPayment('pro')

    const first = await webhookPOST(signedRequest(event('evt-2', 'payment.succeeded', paymentId)))
    expect((await first.json()).result).toBe('processed')

    const second = await webhookPOST(signedRequest(event('evt-2', 'payment.succeeded', paymentId)))
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ success: true, duplicate: true })
  })

  test('unknown event type is ignored (ack, no state change)', async () => {
    const { paymentId } = await createPendingPayment('basic')
    const res = await webhookPOST(signedRequest(event('evt-3', 'plan.upgraded', paymentId)))
    expect(res.status).toBe(200)
    expect((await res.json()).result).toBe('ignored')
    const payment = await db.prepare('SELECT status FROM payments WHERE id = ?').get(paymentId)
    expect((payment as { status: string }).status).toBe('pending')
  })

  test('bad signature → 401', async () => {
    const { paymentId } = await createPendingPayment('basic')
    const res = await webhookPOST(signedRequest(event('evt-4', 'payment.succeeded', paymentId), signWebhook('wrong-secret', '1', 'x')))
    expect(res.status).toBe(401)
  })

  test('out-of-window timestamp → 401 (replay)', async () => {
    const { paymentId } = await createPendingPayment('basic')
    const raw = JSON.stringify(event('evt-5', 'payment.succeeded', paymentId))
    const staleTs = String(Date.now() - 60 * 60 * 1000)
    const req = new NextRequest('http://localhost/api/webhooks/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-payment-timestamp': staleTs,
        'x-payment-signature': signWebhook(SECRET, staleTs, raw),
      },
      body: raw,
    })
    const res = await webhookPOST(req)
    expect(res.status).toBe(401)
  })

  test('unknown payment id → 404', async () => {
    const res = await webhookPOST(signedRequest(event('evt-6', 'payment.succeeded', 'pay-nope')))
    expect(res.status).toBe(404)
  })

  test('no secret configured → 503 (fail closed)', async () => {
    delete process.env.PAYMENT_WEBHOOK_SECRET
    const { paymentId } = await createPendingPayment('basic')
    const res = await webhookPOST(signedRequest(event('evt-7', 'payment.succeeded', paymentId)))
    expect(res.status).toBe(503)
  })

  test('payment.failed marks an in-flight payment failed', async () => {
    const { paymentId } = await createPendingPayment('basic')
    const res = await webhookPOST(signedRequest(event('evt-8', 'payment.failed', paymentId)))
    expect(res.status).toBe(200)
    const payment = await db.prepare('SELECT status FROM payments WHERE id = ?').get(paymentId)
    expect((payment as { status: string }).status).toBe('failed')
  })
})
