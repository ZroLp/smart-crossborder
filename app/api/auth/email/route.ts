import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import {
  confirmEmailCode,
  requestEmailVerificationCode,
} from '@/lib/auth/email-verification';

interface UserRow {
  email: string | null;
  email_verified_at: string | null;
}

/** P6-01: email verification status + code request/confirm. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const db = getDb();
  const user = (await db
    .prepare('SELECT email, email_verified_at FROM users WHERE id = ?')
    .get(auth.user.id)) as UserRow | undefined;

  return NextResponse.json({
    success: true,
    email: user?.email ?? null,
    verified: user?.email_verified_at != null,
  });
}

export async function POST(request: NextRequest) {
  let body: { action?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const db = getDb();
  const user = (await db
    .prepare('SELECT email FROM users WHERE id = ?')
    .get(auth.user.id)) as { email: string | null } | undefined;

  if (body.action === 'request') {
    if (!user?.email) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_NOT_SET', error: 'No email on account' },
        { status: 400 }
      );
    }
    const result = await requestEmailVerificationCode(auth.user.id, user.email, db);
    return NextResponse.json({ success: true, sent: result.sent, ...(result.devCode ? { devCode: result.devCode } : {}) });
  }

  if (body.action === 'confirm') {
    if (typeof body.code !== 'string' || !body.code.trim()) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing code' },
        { status: 400 }
      );
    }
    const outcome = await confirmEmailCode(auth.user.id, body.code.trim(), db);
    if (outcome === 'invalid') {
      return NextResponse.json(
        { success: false, code: 'INVALID_CODE', error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    if (outcome === 'expired') {
      return NextResponse.json(
        { success: false, code: 'CODE_EXPIRED', error: 'Verification code expired' },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, verified: true });
  }

  return NextResponse.json(
    { success: false, code: 'INVALID_INPUT', error: 'Missing or invalid action' },
    { status: 400 }
  );
}
