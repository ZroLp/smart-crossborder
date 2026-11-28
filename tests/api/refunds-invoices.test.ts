import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { createCheckout, confirmPayment } from '@/lib/payment/payment-service'
import { POST as refundPOST } from '@/app/api/payments/[id]/refund/route'
import { GET as invoicesGET } from '@/app/api/invoices/route'
import { GET as dunningGET } from '@/app/api/admin/dunning/route'

let db: DbClient

function getUrl(url: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers: cookie ? { cookie } : {} })
}

async function makeUser(username: string, role: string = 'viewer'): Promise<{ cookie: string; userId: number }> {
  const userRepo = new UserRepository(db)
  await userRepo.create({ username, password: hashPassword('Str0ngPass!'), email: null })
  const userId = Number((await userRepo.findByUsername(username))!.id)
  if (role !== 'viewer') await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId)

  const response = await (await import('@/app/api/auth/route')).POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password: 'Str0ngPass!' }),
    })
  )
  const match = (response.headers.get('set-cookie') || '').match(/sumaitong_session=([^;]+)/)
  return { cookie: match ? `sumaitong_session=${match[1]}` : '', userId }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
})

afterEach(async () => {
  await db.close()
})

describe('P6-06 invoices', () => {
  test('activation issues exactly one invoice', async () => {
    const bob = await makeUser('invoice-bob')
    const payment = await createCheckout(db, bob.userId, 'pro')
    await confirmPayment(db, payment.id, bob.userId)

    const res = await invoicesGET(getUrl('/api/invoices', bob.cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ payment_id: payment.id, plan_key: 'pro', amount_cents: 29900 })
  })

  test('webhook re-ingestion does not duplicate the invoice', async () => {
    const bob = await makeUser('invoice-bob2')
    const payment = await createCheckout(db, bob.userId, 'pro')
    await confirmPayment(db, payment.id, bob.userId)
    await confirmPayment(db, payment.id, bob.userId) // idempotent no-op

    const res = await invoicesGET(getUrl('/api/invoices', bob.cookie))
    expect((await res.json()).data).toHaveLength(1)
  })
})

describe('P6-06 refunds', () => {
  async function payAndSucceed(username: string, plan = 'basic') {
    const bob = await makeUser(username)
    const payment = await createCheckout(db, bob.userId, plan)
    await confirmPayment(db, payment.id, bob.userId)
    return { ...bob, paymentId: payment.id }
  }

  test('refund succeeds once, then 409', async () => {
    const bob = await payAndSucceed('refund-bob')
    const ok = await refundPOST(
      new NextRequest('http://localhost/api/payments/x/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: bob.cookie },
        body: JSON.stringify({ reason: 'changed mind' }),
      }),
      { params: { id: bob.paymentId } }
    )
    expect(ok.status).toBe(200)

    const second = await refundPOST(
      new NextRequest('http://localhost/api/payments/x/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: bob.cookie },
      }),
      { params: { id: bob.paymentId } }
    )
    expect(second.status).toBe(409)

    const payment = await db.prepare('SELECT status FROM payments WHERE id = ?').get(bob.paymentId)
    expect((payment as { status: string }).status).toBe('refunded')
    const userRow = await db.prepare('SELECT subscription_plan FROM users WHERE id = ?').get(bob.userId)
    expect((userRow as { subscription_plan: string | null }).subscription_plan).toBeNull()
  })

  test('cross-user refund → 404', async () => {
    const bob = await payAndSucceed('refund-bob2')
    const carol = await makeUser('refund-carol')
    const res = await refundPOST(
      new NextRequest('http://localhost/api/payments/x/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: carol.cookie },
      }),
      { params: { id: bob.paymentId } }
    )
    expect(res.status).toBe(404)
  })

  test('pending payment is not refundable → 409', async () => {
    const bob = await makeUser('refund-bob3')
    const payment = await createCheckout(db, bob.userId, 'basic')
    const res = await refundPOST(
      new NextRequest('http://localhost/api/payments/x/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: bob.cookie },
      }),
      { params: { id: payment.id } }
    )
    expect(res.status).toBe(409)
  })
})

describe('P6-06 dunning', () => {
  test('admin sees lapsed subscriptions; others get 403', async () => {
    const bob = await makeUser('dunning-bob')
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', 1)

    const payment = await createCheckout(db, bob.userId, 'basic')
    await confirmPayment(db, payment.id, bob.userId)
    // simulate period lapse
    await db.prepare('UPDATE subscriptions SET current_period_end = now() - interval \'1 day\' WHERE user_id = ?').run(bob.userId)

    const adminUser = await makeUser('dunning-admin', 'admin')
    const res = await dunningGET(getUrl('/api/admin/dunning', adminUser.cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.targets).toHaveLength(1)
    expect(body.targets[0]).toMatchObject({ user_id: bob.userId, plan_key: 'basic', days_overdue: 1 })

    const viewer = await makeUser('dunning-viewer')
    expect((await dunningGET(getUrl('/api/admin/dunning', viewer.cookie))).status).toBe(403)
  })
})
