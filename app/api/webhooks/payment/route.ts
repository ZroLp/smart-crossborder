import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ingestPaymentWebhook } from '@/lib/payment/payment-service';

/**
 * P6-04: gateway webhook with signature + idempotency + replay protection.
 * Signature scheme: `X-PAYMENT-SIGNATURE` = HMAC_SHA256(PAYMENT_WEBHOOK_SECRET,
 * `${X-PAYMENT-TIMESTAMP}.${rawBody}`), hex. Without a configured secret the
 * endpoint fails closed.
 */
export async function POST(request: NextRequest) {
  if (!process.env.PAYMENT_WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, code: 'WEBHOOK_NOT_CONFIGURED', error: 'PAYMENT_WEBHOOK_SECRET missing' },
      { status: 503 }
    );
  }

  const rawPayload = await request.text();
  let event: { event_id?: unknown; event_type?: unknown; payment_id?: unknown };
  try {
    event = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_PAYLOAD', error: 'Not JSON' },
      { status: 400 }
    );
  }
  const { event_id, event_type, payment_id } = event as Record<string, string>;
  if (!event_id || !event_type || !payment_id) {
    return NextResponse.json(
      { success: false, code: 'INVALID_PAYLOAD', error: 'Missing event_id/event_type/payment_id' },
      { status: 400 }
    );
  }

  const timestamp = request.headers.get('x-payment-timestamp') ?? '';
  const signature = request.headers.get('x-payment-signature') ?? '';

  const result = await ingestPaymentWebhook(getDb(), { event_id, event_type, payment_id }, rawPayload, timestamp, signature);

  switch (result) {
    case 'replayed':
      return NextResponse.json(
        { success: false, code: 'INVALID_SIGNATURE', error: 'Signature or replay window check failed' },
        { status: 401 }
      );
    case 'unknown_payment':
      return NextResponse.json(
        { success: false, code: 'PAYMENT_NOT_FOUND', error: 'Unknown payment id' },
        { status: 404 }
      );
    case 'duplicate':
      return NextResponse.json({ success: true, duplicate: true });
    case 'ignored':
      return NextResponse.json({ success: true, result: 'ignored' });
    case 'processed':
      return NextResponse.json({ success: true, result: 'processed' });
  }
}
