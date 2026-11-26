import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import {
  getActiveSubscription,
  listPlans,
  setCancelAtPeriodEnd,
} from '@/lib/payment/payment-service';
import { getClientIp } from '@/lib/auth/device';
import { fetchSubscriptionSnapshot, recordAudit } from '@/lib/admin/audit';

/** P6-03: current subscription + plan catalog. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const db = getDb();
  const [subscription, plans, user] = await Promise.all([
    getActiveSubscription(db, auth.user.id),
    listPlans(db),
    db.prepare('SELECT subscription_plan FROM users WHERE id = ?').get(auth.user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      subscription,
      plans,
      /** Projected entitlement columns (null = free tier). */
      plan: (user as { subscription_plan: string | null } | undefined)?.subscription_plan ?? null,
    },
  });
}

/** P6-03: subscription lifecycle control (cancel at period end / restore). */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { action?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* fall through */
  }
  const action = body.action;

  if (action === 'cancel' || action === 'restore') {
    const db = getDb();
    const before = await fetchSubscriptionSnapshot(db, auth.user.id);
    const outcome = await setCancelAtPeriodEnd(db, auth.user.id, action === 'cancel');
    if (outcome === 'no_subscription') {
      return NextResponse.json(
        { success: false, code: 'NO_SUBSCRIPTION', error: 'No active subscription' },
        { status: 404 }
      );
    }
    // P8-02: 写操作审计（该用户订阅行变更前/后快照）
    const after = await fetchSubscriptionSnapshot(db, auth.user.id);
    await recordAudit(db, {
      actorId: auth.user.id,
      action: `subscription.${action}`,
      resource: 'subscription',
      resourceId: String(after?.id ?? before?.id ?? null),
      before,
      after,
      ip: getClientIp(request),
    });
    return NextResponse.json({ success: true, cancelAtPeriodEnd: action === 'cancel' });
  }

  return NextResponse.json(
    { success: false, code: 'INVALID_INPUT', error: 'action must be cancel or restore' },
    { status: 400 }
  );
}
