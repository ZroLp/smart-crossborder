import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, destroyCurrentSession } from '@/lib/auth/session';

/** 销毁当前会话并清 Cookie（幂等；无会话也返回成功）。 */
export async function POST(request: NextRequest) {
  try {
    destroyCurrentSession(request);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
