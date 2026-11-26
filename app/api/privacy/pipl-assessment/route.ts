import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

/**
 * P7-08 PIPL 跨境评估归档（PIPL 第 38/39/40 条）。
 * 返回该用户跨境合规评估的归档 JSON：
 *   机制 = 标准合同 + 单独同意（consent_records purpose='pipl_cross_border'），
 *   区域化 = users.data_residency；archived_at 取该同意记录 created_at（无记录为 null）。
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const db = getDb();
    const consent = (await db
      .prepare(
        `SELECT purpose, consented, consented_at, withdrawn_at, created_at
           FROM consent_records WHERE user_id = ? AND purpose = 'pipl_cross_border'`
      )
      .get(auth.user.id)) as
      | {
          purpose: string;
          consented: boolean;
          consented_at: string | null;
          withdrawn_at: string | null;
          created_at: string;
        }
      | undefined;

    const userRow = (await db
      .prepare('SELECT data_residency FROM users WHERE id = ?')
      .get(auth.user.id)) as { data_residency: string | null } | undefined;

    const separateConsent = consent
      ? {
          purpose: consent.purpose,
          consented: Boolean(consent.consented),
          consented_at: consent.consented_at ?? null,
          withdrawn_at: consent.withdrawn_at ?? null,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        basis: 'PIPL 第 38/39/40 条',
        assessment: {
          mechanism: '标准合同 + 单独同意',
          separate_consent: separateConsent,
          regionalization: userRow?.data_residency ?? 'CN',
        },
        archived_at: consent ? consent.created_at : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
