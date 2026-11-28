import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { hashPassword } from '@/lib/auth/password-hash'
import { validatePasswordStrength } from '@/lib/auth/password-policy'
import {
  checkLoginRateLimitAsync,
  clearLoginFailuresAsync,
  getClientKey,
  recordLoginFailureAsync,
} from '@/lib/auth/login-rate-limit'
import {
  clearSessionCookie,
  createSession,
  destroyCurrentSession,
  setSessionCookie,
} from '@/lib/auth/session'
import { requireUser } from '@/lib/auth/guards'
import { recordUserDevice } from '@/lib/auth/device'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const user = await new UserRepository(db).findById(auth.user.id);
    const emailVerifiedAt = (
      await db.prepare('SELECT email_verified_at FROM users WHERE id = ?').get(auth.user.id)
    ) as { email_verified_at: string | null } | undefined;

    return NextResponse.json({
      success: true,
      role: auth.user.role,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email,
        role: auth.user.role,
        created_at: user?.created_at,
        email_verified_at: emailVerifiedAt?.email_verified_at ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: {
      action?: unknown;
      username?: unknown;
      password?: unknown;
      email?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { action, username, password, email } = body;

    if (typeof action !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing or invalid action' },
        { status: 400 }
      );
    }

    if (action === 'logout') {
      await destroyCurrentSession(request);
      const response = NextResponse.json({ success: true });
      clearSessionCookie(response);
      return response;
    }

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing action, username, or password' },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim();
    const db = getDb();
    const userRepo = new UserRepository(db);

    if (action === 'register') {
      const { valid, error } = validatePasswordStrength(password);
      if (!valid) {
        return NextResponse.json(
          { success: false, code: 'WEAK_PASSWORD', error: error ?? 'Password is too weak' },
          { status: 400 }
        );
      }

      let normalizedEmail: string | null = null;
      if (typeof email === 'string') {
        const trimmedEmail = email.trim();
        if (trimmedEmail === '') {
          normalizedEmail = null;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          return NextResponse.json(
            { success: false, code: 'INVALID_INPUT', error: 'Invalid email address' },
            { status: 400 }
          );
        }
        normalizedEmail = trimmedEmail.toLowerCase();
      }

      const existing = await userRepo.findByUsername(normalizedUsername);
      if (existing) {
        return NextResponse.json(
          { success: false, code: 'INVALID_INPUT', error: 'Username already exists' },
          { status: 400 }
        );
      }
      const result = await userRepo.create({ username: normalizedUsername, password: hashPassword(password), email: normalizedEmail })
      const userId = Number(result.lastInsertRowid);
      const role = (await userRepo.getRole(userId)) || 'viewer';

      const token = await createSession(userId, db);
      await recordUserDevice(userId, request, db);
      const response = NextResponse.json({ success: true, userId, role, email: normalizedEmail });
      setSessionCookie(response, token);
      return response;
    }

    if (action === 'login') {
      const clientKey = getClientKey(request, normalizedUsername);
      const limit = await checkLoginRateLimitAsync(clientKey);
      if (!limit.allowed) {
        return NextResponse.json(
          {
            success: false,
            code: 'RATE_LIMITED',
            error: 'Too many failed login attempts. Please try again later.',
          },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
        );
      }

      const valid = await userRepo.verifyPassword(normalizedUsername, password);
      if (!valid) {
        await recordLoginFailureAsync(clientKey);
        return NextResponse.json(
          { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' }
        );
      }

      await clearLoginFailuresAsync(clientKey);
      const user = await userRepo.findByUsername(normalizedUsername);
      const role = (await userRepo.getRole(user!.id)) || 'viewer';

      const token = await createSession(user!.id, db);
      await recordUserDevice(user!.id, request, db);
      const response = NextResponse.json({ success: true, userId: user!.id, role });
      setSessionCookie(response, token);
      return response;
    }

    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: `Invalid action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
