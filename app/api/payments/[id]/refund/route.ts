import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { refundPayment } from '@/lib/payment/payment-service';

/** P6-06: refund a succeeded payment (owner-scoped). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  let body: { reason?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* reason is optional */
  }

  const outcome = await refundPayment(getDb(), id, auth.user.id, typeof body.reason === 'string' ? body.reason : undefined);

  switch (outcome) {
    case 'not_found':
      return NextResponse.json(
        { success: false, code: 'PAYMENT_NOT_FOUND', error: 'Payment not found' },
        { status: 404 }
      );
    case 'not_refundable':
      return NextResponse.json(
        { success: false, code: 'INVALID_STATE', error: 'Payment is not refundable' },
        { status: 409 }
      );
    case 'refunded':
      return NextResponse.json({ success: true, refundId: `rfd-${id}`, status: 'refunded' });
  }
}
