import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

interface ComplianceItem {
  id: number;
  user_id: number;
  kind: string;
  payload: string;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ComplianceEvent {
  id: number;
  item_id: number;
  event_type: string;
  detail: string | null;
  created_at: string;
}

// P5-06：GET 返回合规项详情 + 审计时间线；POST 写入审计事件（如标记已处理）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', error: 'Invalid compliance item id' },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = (await db
      .prepare(
        'SELECT id, kind, payload, source, created_at, updated_at FROM compliance_items WHERE id = ? AND user_id = ?'
      )
      .get(itemId, auth.user.id)) as ComplianceItem | undefined;

    if (!row) {
      return NextResponse.json(
        { success: false, code: 'COMPLIANCE_NOT_FOUND', error: 'Compliance item not found' },
        { status: 404 }
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.payload);
      if (parsed && typeof parsed === 'object') payload = parsed;
    } catch {
      // keep empty on malformed payload
    }

    const events = (await db
      .prepare(
        'SELECT id, item_id, event_type, detail, created_at FROM compliance_events WHERE item_id = ? AND user_id = ? ORDER BY created_at'
      )
      .all(itemId, auth.user.id)) as ComplianceEvent[];

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        kind: row.kind,
        source: row.source,
        payload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        events: events.map((e) => ({
          id: e.id,
          eventType: e.event_type,
          detail: e.detail,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', error: 'Invalid compliance item id' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const eventType =
      typeof body.event_type === 'string' && body.event_type.trim() ? body.event_type.trim() : null;
    const detail = typeof body.detail === 'string' ? body.detail : null;

    if (!eventType) {
      return NextResponse.json(
        { success: false, error: 'event_type is required', code: 'VALIDATION' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify the item belongs to the current user
    const item = (await db
      .prepare('SELECT id FROM compliance_items WHERE id = ? AND user_id = ?')
      .get(itemId, auth.user.id)) as { id: number } | undefined;

    if (!item) {
      return NextResponse.json(
        { success: false, code: 'COMPLIANCE_NOT_FOUND', error: 'Compliance item not found' },
        { status: 404 }
      );
    }

    // Insert audit event
    await db
      .prepare(
        'INSERT INTO compliance_events (item_id, user_id, event_type, detail) VALUES (?, ?, ?, ?)'
      )
      .run(itemId, auth.user.id, eventType, detail);

    // Update item's updated_at
    await db
      .prepare('UPDATE compliance_items SET updated_at = now() WHERE id = ?')
      .run(itemId);

    return NextResponse.json({
      success: true,
      data: { eventId: itemId, eventType, recordedAt: new Date().toISOString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
