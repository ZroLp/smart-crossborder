import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { listUserDevices } from '@/lib/auth/device';

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic';

/** P6-01: device/IP history of the current user. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const devices = await listUserDevices(auth.user.id, getDb());
  return NextResponse.json({ success: true, devices });
}
