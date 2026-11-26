import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { TrackingEventRepository } from '@/lib/db/order-detail-repository';

/**
 * P5-07：POST 写入物流轨迹事件（含 carrier + tracking_number）
 *
 * POST /api/orders/[id]/tracking
 * body: {
 *   status: string,          // e.g. 'shipped', 'in_transit', 'delivered'
 *   location?: string,
 *   description?: string,
 *   carrier?: string,       // e.g. 'DHL Express'
 *   tracking_number?: string, // e.g. 'DHL-2024-US-001'
 *   occurred_at?: string    // ISO 8601, defaults to now()
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', error: 'Invalid order id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!status) {
      return NextResponse.json(
        { success: false, error: 'status is required', code: 'VALIDATION' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify the order belongs to the current user (via shop ownership)
    const order = (await db
      .prepare(
        `SELECT o.id FROM orders o
         JOIN shops s ON s.id = o.shop_id
         WHERE o.id = ? AND s.user_id = ?`
      )
      .get(orderId, auth.user.id)) as { id: number } | undefined;

    if (!order) {
      return NextResponse.json(
        { success: false, code: 'ORDER_NOT_FOUND', error: 'Order not found' },
        { status: 404 }
      );
    }

    const repo = new TrackingEventRepository(db);
    const eventId = await repo.add({
      order_id: orderId,
      status,
      location: typeof body.location === 'string' ? body.location : null,
      description: typeof body.description === 'string' ? body.description : null,
      carrier: typeof body.carrier === 'string' ? body.carrier : null,
      tracking_number: typeof body.tracking_number === 'string' ? body.tracking_number : null,
      occurred_at:
        typeof body.occurred_at === 'string'
          ? body.occurred_at
          : new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          eventId,
          orderId,
          status,
          carrier: typeof body.carrier === 'string' ? body.carrier : null,
          trackingNumber: typeof body.tracking_number === 'string' ? body.tracking_number : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
