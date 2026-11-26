import { createHmac, randomBytes } from 'crypto';
import type { DbClient, DbRow } from '@/lib/db/client';

/**
 * P6-03: payment core on top of the `payments` / `subscriptions` / `plans`
 * tables. The gateway is pluggable; without credentials the deterministic
 * mock provider is used so the full checkout → 3DS → subscription lifecycle
 * stays testable end to end.
 */

export interface PlanRow {
  key: string;
  name: string;
  price_cents: number;
  currency: string;
  stores: number;
  ai_calls: number | null;
  features: string;
}

export type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' | 'refunded';

export interface PaymentRow {
  id: string;
  user_id: number;
  plan_key: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  threeds_status: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: number;
  user_id: number;
  plan_key: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export class PlanNotFound extends Error {
  constructor(planKey: string) {
    super(`Plan not found: ${planKey}`);
    this.name = 'PlanNotFound';
  }
}

/** Mock 3DS rule: amounts ≥ 500 CNY require 3DS; PAYMENT_MOCK_3DS=1 forces it for any plan. */
export function requiresThreeds(amountCents: number): boolean {
  return amountCents >= 50000 || process.env.PAYMENT_MOCK_3DS === '1';
}

/** Simulated 3DS challenge answer accepted by the mock provider. */
export const MOCK_3DS_CODE = '123456';

export async function listPlans(db: DbClient): Promise<PlanRow[]> {
  return (await db.prepare('SELECT key, name, price_cents, currency, stores, ai_calls, features FROM plans ORDER BY price_cents').all()) as PlanRow[];
}

export async function findPlan(db: DbClient, planKey: string): Promise<PlanRow | undefined> {
  return (await db.prepare('SELECT key, name, price_cents, currency, stores, ai_calls, features FROM plans WHERE key = ?').get(planKey)) as PlanRow | undefined;
}

export async function createCheckout(db: DbClient, userId: number, planKey: string): Promise<PaymentRow> {
  const plan = await findPlan(db, planKey);
  if (!plan) throw new PlanNotFound(planKey);

  const id = `pay-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const status: PaymentStatus = requiresThreeds(plan.price_cents) ? 'requires_action' : 'pending';
  await db
    .prepare(
      'INSERT INTO payments (id, user_id, plan_key, amount_cents, currency, status) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, userId, plan.key, plan.price_cents, plan.currency, status);

  return (await findPaymentById(db, id)) as PaymentRow;
}

export async function findPaymentById(db: DbClient, paymentId: string): Promise<PaymentRow | undefined> {
  return (await db
    .prepare('SELECT id, user_id, plan_key, amount_cents, currency, status, threeds_status, provider, created_at, updated_at FROM payments WHERE id = ?')
    .get(paymentId)) as PaymentRow | undefined;
}

export async function findPaymentByOwner(db: DbClient, paymentId: string, userId: number): Promise<PaymentRow | undefined> {
  return (await db
    .prepare('SELECT id, user_id, plan_key, amount_cents, currency, status, threeds_status, provider, created_at, updated_at FROM payments WHERE id = ? AND user_id = ?')
    .get(paymentId, userId)) as PaymentRow | undefined;
}

export async function listPaymentsByUser(db: DbClient, userId: number, limit = 20): Promise<PaymentRow[]> {
  return (await db
    .prepare(
      'SELECT id, user_id, plan_key, amount_cents, currency, status, threeds_status, provider, created_at, updated_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(userId, limit)) as PaymentRow[];
}

export type ConfirmOutcome = 'succeeded' | 'threeds_required' | 'failed' | 'invalid_state' | 'not_found';

/**
 * Confirm a pending/requires_action payment. Succeeding activates the
 * subscription lifecycle (new active row + users entitlement projection).
 * Idempotent: confirming an already-succeeded payment is a no-op.
 */
export async function confirmPayment(
  db: DbClient,
  paymentId: string,
  userId: number,
  threedsCode?: string
): Promise<ConfirmOutcome> {
  const payment = await findPaymentByOwner(db, paymentId, userId);
  if (!payment) return 'not_found';

  if (payment.status === 'succeeded') return 'succeeded';
  if (payment.status !== 'pending' && payment.status !== 'requires_action') return 'invalid_state';

  if (payment.status === 'requires_action') {
    if (threedsCode === undefined) {
      await setPaymentStatus(db, payment.id, 'requires_action', 'pending');
      return 'threeds_required';
    }
    if (threedsCode !== MOCK_3DS_CODE) {
      await setPaymentStatus(db, payment.id, 'failed', 'failed');
      return 'failed';
    }
    await setPaymentStatus(db, payment.id, 'succeeded', 'succeeded');
  } else {
    await setPaymentStatus(db, payment.id, 'succeeded', null);
  }

  await activatePlanForUser(db, userId, payment.plan_key, payment.id);
  return 'succeeded';
}

async function setPaymentStatus(db: DbClient, paymentId: string, status: PaymentStatus, threedsStatus: string | null): Promise<void> {
  await db
    .prepare('UPDATE payments SET status = ?, threeds_status = ?, updated_at = now() WHERE id = ?')
    .run(status, threedsStatus, paymentId);
}

/**
 * Activate the plan for a user: project it onto the `users` entitlement
 * columns (quota gate reads those), append to `subscription_logs`, and roll
 * the active subscription row forward by 30 days.
 */
export async function activatePlanForUser(db: DbClient, userId: number, planKey: string, paymentId?: string): Promise<void> {
  const plan = await findPlan(db, planKey);
  if (!plan) throw new PlanNotFound(planKey);

  const old = (await db.prepare('SELECT subscription_plan FROM users WHERE id = ?').get(userId)) as DbRow | undefined;
  const oldPlan = (old?.subscription_plan as string | null) || 'free';

  await db.transaction(async () => {
    await db
      .prepare(
        `UPDATE users
         SET subscription_plan = ?,
             subscription_stores = ?,
             subscription_ai_calls = ?,
             subscription_features = ?,
             updated_at = now()
         WHERE id = ?`
      )
      .run(plan.name, plan.stores, plan.ai_calls, plan.features, userId);

    await db
      .prepare('INSERT INTO subscription_logs (user_id, old_plan, new_plan, changed_at) VALUES (?, ?, ?, now())')
      .run(userId, oldPlan, plan.name);

    await db
      .prepare(`UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = ? AND status = 'active'`)
      .run(userId);
    await db
      .prepare(
        `INSERT INTO subscriptions (user_id, plan_key, status, current_period_end)
         VALUES (?, ?, 'active', now() + interval '30 days')`
      )
      .run(userId, plan.key);

    // P6-06: issue the invoice exactly once, at activation.
    if (paymentId) await issueInvoiceForPayment(db, paymentId, planKey);
  })();
}

/** P6-06: one invoice per payment (idempotent via the PK guard). */
async function issueInvoiceForPayment(db: DbClient, paymentId: string, planKey: string): Promise<void> {
  const exists = await db
    .prepare('SELECT 1 AS found FROM invoices WHERE payment_id = ?')
    .get(paymentId) as { found: number } | undefined;
  if (exists) return;

  const payment = await findPaymentById(db, paymentId);
  if (!payment) return;
  const invoiceId = `inv-${paymentId}`;
  await db
    .prepare(
      `INSERT INTO invoices (id, user_id, payment_id, plan_key, amount_cents, tax_amount_cents, currency)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .run(invoiceId, payment.user_id, paymentId, planKey, payment.amount_cents, payment.currency);
}

export async function listInvoicesByUser(db: DbClient, userId: number, limit = 20) {
  return (await db
    .prepare(
      'SELECT id, user_id, payment_id, plan_key, amount_cents, tax_amount_cents, currency, issued_at FROM invoices WHERE user_id = ? ORDER BY issued_at DESC LIMIT ?'
    )
    .all(userId, limit)) as DbRow[];
}

/** P6-06: refund a succeeded payment, void the subscription, reset entitlements to free. */
export type RefundOutcome = 'refunded' | 'not_found' | 'not_refundable';

export async function refundPayment(db: DbClient, paymentId: string, userId: number, reason?: string): Promise<RefundOutcome> {
  const payment = await findPaymentByOwner(db, paymentId, userId);
  if (!payment) return 'not_found';
  if (payment.status !== 'succeeded') return 'not_refundable';

  const refundId = `rfd-${paymentId}`;
  await db.transaction(async () => {
    await db
      .prepare('INSERT INTO refunds (id, user_id, payment_id, amount_cents, reason) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING')
      .run(refundId, userId, paymentId, payment.amount_cents, reason ?? null);
    await setPaymentStatus(db, paymentId, 'refunded', payment.threeds_status);

    await db
      .prepare(`UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = ? AND status = 'active'`)
      .run(userId);
    await db
      .prepare(
        `UPDATE users SET subscription_plan = NULL, subscription_stores = NULL,
             subscription_ai_calls = NULL, subscription_features = NULL, updated_at = now()
         WHERE id = ?`
      )
      .run(userId);
    await db
      .prepare('INSERT INTO subscription_logs (user_id, old_plan, new_plan, changed_at) VALUES (?, ?, ?, now())')
      .run(userId, payment.plan_key, 'free');
  })();
  return 'refunded';
}

export interface DunningRow {
  user_id: number;
  plan_key: string;
  status: string;
  current_period_end: string;
  days_overdue: number;
}

/** P6-06: dunning — active subscriptions whose period already ended. */
export async function findDunningTargets(db: DbClient): Promise<DunningRow[]> {
  const rows = (await db
    .prepare(
      `SELECT user_id, plan_key, status, current_period_end,
              greatest(0, date_part('day', now() - current_period_end)) AS days_overdue
         FROM subscriptions
        WHERE status = 'active' AND current_period_end < now()
        ORDER BY current_period_end ASC`
    )
    .all()) as DunningRow[];
  return rows;
}

export async function getActiveSubscription(db: DbClient, userId: number): Promise<SubscriptionRow | undefined> {
  return (await db
    .prepare(
      'SELECT id, user_id, plan_key, status, current_period_end, cancel_at_period_end, created_at, updated_at FROM subscriptions WHERE user_id = ? AND status = ?'
    )
    .get(userId, 'active')) as SubscriptionRow | undefined;
}

export type SubscriptionActionOutcome = 'updated' | 'no_subscription';

export async function setCancelAtPeriodEnd(db: DbClient, userId: number, cancel: boolean): Promise<SubscriptionActionOutcome> {
  const result = await db
    .prepare(
      'UPDATE subscriptions SET cancel_at_period_end = ?, updated_at = now() WHERE user_id = ? AND status = ?'
    )
    .run(cancel, userId, 'active');
  return result.changes > 0 ? 'updated' : 'no_subscription';
}

/* ---------------------- P6-04: webhook reliable ingest ---------------------- */

/** HMAC window for the `X-PAYMENT-TIMESTAMP` replay guard. */
export const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** Signature = HMAC_SHA256(secret, `${timestamp}.${payload}`), hex. */
export function signWebhook(secret: string, timestamp: string, rawPayload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawPayload}`).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawPayload: string,
  signature: string
): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const expected = signWebhook(secret, timestamp, rawPayload);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return a.equals(b);
}

export type WebhookResult = 'processed' | 'duplicate' | 'ignored' | 'replayed' | 'unknown_payment';

/**
 * Ledger-based webhook ingest: `event_id` PK gives idempotency (duplicates
 * ack without re-applying), the timestamp window rejects replays, and only
 * known event types mutate payment state.
 */
export async function ingestPaymentWebhook(
  db: DbClient,
  event: { event_id: string; event_type: string; payment_id: string },
  rawPayload: string,
  timestamp: string,
  signature: string
): Promise<WebhookResult> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !verifyWebhookSignature(secret, timestamp, rawPayload, signature)) {
    return 'replayed'; // signature failure is indistinguishable from replay; both → 401
  }
  const ts = Number(timestamp);
  if (Math.abs(Date.now() - ts) > WEBHOOK_REPLAY_WINDOW_MS) return 'replayed';

  const inserted = await db
    .prepare('INSERT INTO payment_webhook_events (event_id, event_type, payment_id, payload) VALUES (?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING')
    .run(event.event_id, event.event_type, event.payment_id, rawPayload);
  if (inserted.changes === 0) return 'duplicate';

  switch (event.event_type) {
    case 'payment.succeeded': {
      const payment = await findPaymentById(db, event.payment_id);
      if (!payment) return 'unknown_payment';
      if (payment.status !== 'succeeded') {
        await setPaymentStatus(db, payment.id, 'succeeded', payment.threeds_status);
        await activatePlanForUser(db, payment.user_id, payment.plan_key, payment.id);
      }
      return 'processed';
    }
    case 'payment.failed': {
      const payment = await findPaymentById(db, event.payment_id);
      if (!payment) return 'unknown_payment';
      if (payment.status === 'pending' || payment.status === 'requires_action') {
        await setPaymentStatus(db, payment.id, 'failed', payment.threeds_status);
      }
      return 'processed';
    }
    default:
      return 'ignored';
  }
}
