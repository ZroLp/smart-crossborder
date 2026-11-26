import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireAdmin } from '@/lib/auth/guards';
import { getClientIp } from '@/lib/auth/device';
import { recordAudit } from '@/lib/admin/audit';

/**
 * P7-06 泄露 72h 响应（GDPR Art.33：知悉后 72 小时内通知监管机构）。
 *
 * POST /api/admin/breach  { description, user_id? } → 建档并计算
 *   notification_deadline_at = detected_at + interval '72 hours'（201 返回含 deadline）。
 * GET  /api/admin/breach  泄露报告列表。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  let body: { description?: unknown; user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { description, user_id } = body;
  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'description is required' },
      { status: 400 }
    );
  }

  let userId: number | null = null;
  if (user_id !== undefined && user_id !== null) {
    if (typeof user_id !== 'number' || !Number.isInteger(user_id)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'user_id must be an integer' },
        { status: 400 }
      );
    }
    userId = user_id;
  }

  try {
    const db = getDb();
    if (userId !== null) {
      const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) {
        return NextResponse.json(
          { success: false, code: 'USER_NOT_FOUND', error: 'Referenced user does not exist' },
          { status: 404 }
        );
      }
    }
    // 同一时钟源计算 detected_at 与 72h deadline（GDPR Art.33）。
    const ts = (await db
      .prepare(`SELECT now() AS detected_at, now() + interval '72 hours' AS notification_deadline_at`)
      .get()) as { detected_at: string; notification_deadline_at: string };

    const { lastInsertRowid } = await db
      .prepare(
        `INSERT INTO breach_reports (user_id, description, detected_at, notification_deadline_at, status)
         VALUES (?, ?, ?, ?, 'open')`
      )
      .run(userId, description.trim(), ts.detected_at, ts.notification_deadline_at);

    // P8-02: 写操作审计（新建记录，before 恒为 null）
    await recordAudit(db, {
      actorId: auth.user.id,
      action: 'breach.create',
      resource: 'breach_report',
      resourceId: String(lastInsertRowid),
      before: null,
      after: {
        id: lastInsertRowid,
        user_id: userId,
        description: description.trim(),
        detected_at: ts.detected_at,
        notification_deadline_at: ts.notification_deadline_at,
        status: 'open',
      },
      ip: getClientIp(request),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: lastInsertRowid,
          user_id: userId,
          description: description.trim(),
          detected_at: ts.detected_at,
          notification_deadline_at: ts.notification_deadline_at,
          status: 'open',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const rows = await getDb()
      .prepare(
        `SELECT id, user_id, description, detected_at, notification_deadline_at, status
           FROM breach_reports ORDER BY detected_at DESC`
      )
      .all();
    return NextResponse.json({ success: true, data: { reports: rows ?? [] } });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
