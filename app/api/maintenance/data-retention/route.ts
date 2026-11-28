import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireAdmin } from '@/lib/auth/guards';
import { runRetentionCleanup } from '@/lib/privacy/retention';

/**
 * P7-03 保留期自动清理端点（admin）。
 * 按 data_retention_policies 逐策略删除超期数据，返回 { cleaned: { data_type: rows } }。
 * 供 cron / 定时器定期调用。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const { cleaned } = await runRetentionCleanup(getDb());
    return NextResponse.json({ success: true, cleaned });
  } catch (error) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
