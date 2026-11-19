import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { cleanupExpiredSessions } from '@/lib/auth/session';

/**
 * 供外部 cron / 定时器调用的会话清理端点。
 * 必须携带与 MAINTENANCE_SECRET 一致的 `x-maintenance-token`，否则 401/403。
 * 未配置该密钥时端点恒返回 403（生产默认拒绝），需在部署环境显式开启。
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, code: 'DISABLED', error: 'Maintenance endpoint disabled' },
      { status: 403 }
    );
  }

  const provided = request.headers.get('x-maintenance-token');
  if (provided !== secret) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', error: 'Invalid maintenance token' },
      { status: 401 }
    );
  }

  try {
    const removed = await cleanupExpiredSessions(getDb());
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
