import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { confirmPayment } from '@/lib/payment/payment-service';

/**
 * P6-03: confirm a pending payment. For requires_action payments pass
 * `code` (the 3DS challenge answer). Success activates the subscription.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  let body: { code?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* no body is fine for pending payments */
  }
  const code = typeof body.code === 'string' && body.code.trim() ? body.code.trim() : undefined;

  const outcome = await confirmPayment(getDb(), id, auth.user.id, code);

  switch (outcome) {
    case 'not_found':
      return NextResponse.json(
        { success: false, code: 'PAYMENT_NOT_FOUND', error: 'Payment not found' },
        { status: 404 }
      );
    case 'threeds_required':
      return NextResponse.json(
        { success: false, code: 'THREEDS_REQUIRED', error: '3DS verification code required' },
        { status: 400 }
      );
    case 'failed':
      return NextResponse.json(
        { success: false, code: 'PAYMENT_FAILED', error: 'Payment failed' },
        { status: 402 }
      );
    case 'invalid_state':
      return NextResponse.json(
        { success: false, code: 'INVALID_STATE', error: 'Payment is not confirmable' },
        { status: 409 }
      );
    case 'succeeded':
      return NextResponse.json({ success: true, status: 'succeeded' });
  }
}
