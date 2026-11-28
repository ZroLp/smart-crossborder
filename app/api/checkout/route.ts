import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import {
  PlanNotFound,
  createCheckout,
  findPlan,
  requiresThreeds,
} from '@/lib/payment/payment-service';

/** P6-03: create a checkout for a plan. `plan` accepts a key or display name. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const requested =
    typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : '';
  if (!requested) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Missing plan' },
      { status: 400 }
    );
  }

  const db = getDb();
  // Exact key first; otherwise normalize display names ("Basic" → "basic").
  let planKey = (await findPlan(db, requested)) ? requested : undefined;
  if (!planKey) {
    const byName = await db
      .prepare('SELECT key FROM plans WHERE lower(name) = ?')
      .get(requested) as { key: string } | undefined;
    planKey = byName?.key;
  }
  if (!planKey) {
    return NextResponse.json(
      { success: false, code: 'INVALID_PLAN', error: 'Unknown plan' },
      { status: 400 }
    );
  }

  let payment;
  try {
    payment = await createCheckout(db, auth.user.id, planKey);
  } catch (error) {
    if (error instanceof PlanNotFound) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PLAN', error: 'Unknown plan' },
        { status: 400 }
      );
    }
    throw error;
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        plan: payment.plan_key,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        threeds: requiresThreeds(payment.amount_cents),
      },
    },
    { status: 201 }
  );
}
