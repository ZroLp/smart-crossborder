import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { listInvoicesByUser } from '@/lib/payment/payment-service';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

/** P6-06: current user's invoices (issued on subscription activation). */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const invoices = await listInvoicesByUser(getDb(), auth.user.id);
  return NextResponse.json({ success: true, data: invoices });
}
