import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { hashPassword, verifyPasswordHash } from '@/lib/auth/password-hash'
import { validatePasswordStrength } from '@/lib/auth/password-policy'
import { destroyOtherSessionsForUser, getSessionToken } from '@/lib/auth/session'
import { requireUser } from '@/lib/auth/guards'

export async function POST(request: NextRequest) {
  try {
    let body: {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = body;

    if (
      typeof currentPassword !== 'string' ||
      !currentPassword ||
      typeof newPassword !== 'string' ||
      !newPassword
    ) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 身份只取会话，不接受请求体中的 userId。
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, code: 'WEAK_PASSWORD', error: passwordCheck.error ?? 'Password is too weak' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          code: 'SAME_PASSWORD',
          error: 'New password must be different from the current password',
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const userRepo = new UserRepository(db);
    const user = await userRepo.findById(auth.user.id);

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', error: 'User not found' },
        { status: 404 }
      );
    }

    if (!verifyPasswordHash(currentPassword, user.password)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    await userRepo.update(user.id, { password: hashPassword(newPassword) });

    // 改密后销毁该用户其他会话，保留当前会话。
    await destroyOtherSessionsForUser(user.id, getSessionToken(request), db);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
