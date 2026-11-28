import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { AnalyticsRepository } from '@/lib/db/analytics-repository';

/** P5-02 埋点汇总：事件计数、渠道归因分布与激活漏斗。 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const summary = await AnalyticsRepository.of(db).summary(auth.user.id);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
