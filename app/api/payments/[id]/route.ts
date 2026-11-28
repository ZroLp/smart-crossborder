import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { findPaymentByOwner } from '@/lib/payment/payment-service';

/** P6-03: single payment (owner-scoped; cross-user → 404). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const payment = await findPaymentByOwner(getDb(), id, auth.user.id);
  if (!payment) {
    return NextResponse.json(
      { success: false, code: 'PAYMENT_NOT_FOUND', error: 'Payment not found' },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, data: payment });
}
