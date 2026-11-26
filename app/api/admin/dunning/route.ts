import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireAdmin } from '@/lib/auth/guards';
import { findDunningTargets } from '@/lib/payment/payment-service';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

/** P6-06: dunning list — active subscriptions whose period has lapsed. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const targets = await findDunningTargets(getDb());
  return NextResponse.json({ success: true, targets });
}
