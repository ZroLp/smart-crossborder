import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { getClientIp } from '@/lib/auth/device';

/**
 * P7-01 阻断式同意管理（GDPR Art.7 可举证 + PIPL 单独同意复用本表 purpose='pipl_cross_border'）。
 *
 * GET  /api/consent  该用户各 purpose 的最新同意状态
 * POST /api/consent  upsert：{ purpose: 'analytics' | 'pipl_cross_border', consented: boolean }
 *   - 再次同意：刷新 consented_at 并清除 withdrawn_at
 *   - 撤回：记 withdrawn_at（UNIQUE(user_id, purpose) 保证每 purpose 单行最新态）
 */
const CONSENT_PURPOSES = ['analytics', 'pipl_cross_border'] as const;
type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const db = getDb();
    const rows = (await db
      .prepare(
        `SELECT purpose, consented, consented_at, withdrawn_at, created_at
           FROM consent_records WHERE user_id = ? ORDER BY created_at ASC`
      )
      .all(auth.user.id)) as Array<{
      purpose: string;
      consented: boolean;
      consented_at: string | null;
      withdrawn_at: string | null;
      created_at: string;
    }>;

    return NextResponse.json({
      success: true,
      data: {
        records: rows.map((row) => ({
          purpose: row.purpose,
          consented: Boolean(row.consented),
          consented_at: row.consented_at ?? null,
          withdrawn_at: row.withdrawn_at ?? null,
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { purpose?: unknown; consented?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { purpose, consented } = body;
  if (typeof purpose !== 'string' || !(CONSENT_PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: `purpose must be one of: ${CONSENT_PURPOSES.join(', ')}` },
      { status: 400 }
    );
  }
  if (typeof consented !== 'boolean') {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'consented must be a boolean' },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const userId = auth.user.id;
    const ip = getClientIp(request);

    const existing = await db
      .prepare('SELECT id FROM consent_records WHERE user_id = ? AND purpose = ?')
      .get(userId, purpose as ConsentPurpose);

    if (existing) {
      if (consented) {
        await db
          .prepare(
            `UPDATE consent_records SET consented = true, consented_at = now(), withdrawn_at = NULL, ip = ?
               WHERE id = ?`
          )
          .run(ip, (existing as { id: number }).id);
      } else {
        await db
          .prepare('UPDATE consent_records SET consented = false, withdrawn_at = now(), ip = ? WHERE id = ?')
          .run(ip, (existing as { id: number }).id);
      }
    } else {
      await db
        .prepare(
          `INSERT INTO consent_records (user_id, purpose, consented, ip, consented_at, withdrawn_at)
           VALUES (?, ?, ?, ?, CASE WHEN ? THEN now() ELSE NULL END, CASE WHEN ? THEN now() ELSE NULL END)`
        )
        .run(userId, purpose, consented, ip, consented, !consented);
    }

    return NextResponse.json({ success: true, data: { purpose, consented } });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
