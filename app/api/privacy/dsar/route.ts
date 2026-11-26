import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

/**
 * P7-02 DSAR 自助（GDPR Art.20 数据可携权 / Art.17 被遗忘权，30 天 SLA 可测）。
 *
 * POST /api/privacy/dsar  { type: 'export' | 'delete' }
 *   - export：立即生成 JSON 快照（users 本行 + sessions + user_devices +
 *     analytics_events + task_logs + consent_records + 本人订单摘要）存入 export_json，
 *     status 直接置 fulfilled；
 *   - delete：PII 清除（users.email=NULL、password=''、username=deleted-<id>），
 *     其余关联数据保留审计行，请求本身置 fulfilled；
 *   - 两者均记 sla_due_at = requested_at + 30 天。
 * GET /api/privacy/dsar  本人请求列表。
 */
const DSAR_TYPES = ['export', 'delete'] as const;
type DsarType = (typeof DSAR_TYPES)[number];

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { type } = body;
  if (typeof type !== 'string' || !(DSAR_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_TYPE', error: `type must be one of: ${DSAR_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const userId = auth.user.id;
    const dsarType = type as DsarType;

    let exportJson: string | null = null;
    if (dsarType === 'export') {
      const [userRow, sessions, devices, analytics, tasks, consents] = [
        await db.prepare('SELECT * FROM users WHERE id = ?').get(userId),
        await db.prepare('SELECT * FROM sessions WHERE user_id = ?').all(userId),
        await db.prepare('SELECT * FROM user_devices WHERE user_id = ?').all(userId),
        await db.prepare('SELECT * FROM analytics_events WHERE user_id = ?').all(userId),
        await db.prepare('SELECT * FROM task_logs WHERE user_id = ?').all(userId),
        await db.prepare('SELECT * FROM consent_records WHERE user_id = ?').all(userId),
      ];
      // 订单摘要：仅取本人（经 shops 关联）订单号/金额/状态，不带客户 PII。
      const orders = await db
        .prepare(
          `SELECT o.order_number, o.total_amount, o.status
             FROM orders o JOIN shops s ON o.shop_id = s.id
            WHERE s.user_id = ?`
        )
        .all(userId);
      exportJson = JSON.stringify({
        generated_at: new Date().toISOString(),
        users: userRow ? [userRow] : [],
        sessions: sessions ?? [],
        user_devices: devices ?? [],
        analytics_events: analytics ?? [],
        task_logs: tasks ?? [],
        consent_records: consents ?? [],
        orders,
      });
    } else {
      // PII 清除：email 置空、密码抹除、匿名化 username（保留审计行，关联数据不级联删除）。
      await db
        .prepare(`UPDATE users SET email = NULL, password = '', username = CONCAT('deleted-', id) WHERE id = ?`)
        .run(userId);
    }

    const { lastInsertRowid } = await db
      .prepare(
        `INSERT INTO dsar_requests (user_id, dsar_type, status, sla_due_at, requested_at, fulfilled_at, export_json)
         VALUES (?, ?, 'fulfilled', now() + interval '30 days', now(), now(), ?)`
      )
      .run(userId, dsarType, exportJson);

    const row = (await db
      .prepare('SELECT id, dsar_type, status, sla_due_at, requested_at, fulfilled_at FROM dsar_requests WHERE id = ?')
      .get(lastInsertRowid as number)) as {
      id: number;
      dsar_type: string;
      status: string;
      sla_due_at: string;
      requested_at: string;
      fulfilled_at: string;
    };

    return NextResponse.json({ success: true, data: row }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const db = getDb();
    const rows = await db
      .prepare(
        `SELECT id, dsar_type, status, sla_due_at, requested_at, fulfilled_at, export_json
           FROM dsar_requests WHERE user_id = ? ORDER BY requested_at DESC`
      )
      .all(auth.user.id);

    return NextResponse.json({ success: true, data: { requests: rows ?? [] } });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
