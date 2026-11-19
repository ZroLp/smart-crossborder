import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import {
  clearSessionCookie,
  destroyAllSessionsForUser,
} from '@/lib/auth/session';
import { requireUser } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    await destroyAllSessionsForUser(auth.user.id, getDb());
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
