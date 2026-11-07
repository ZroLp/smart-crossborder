import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { hashPassword } from '@/lib/auth/password-hash'
import { validatePasswordStrength } from '@/lib/auth/password-policy'
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getClientKey,
  recordLoginFailure,
} from '@/lib/auth/login-rate-limit'
import {
  clearSessionCookie,
  createSession,
  destroyCurrentSession,
  setSessionCookie,
} from '@/lib/auth/session'
import { requireUser } from '@/lib/auth/guards'

export async function GET(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const user = new UserRepository(db).findById(auth.user.id);

    return NextResponse.json({
      success: true,
      role: auth.user.role,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email,
        role: auth.user.role,
        created_at: user?.created_at,
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
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { action, username, password } = body;

    if (typeof action !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing or invalid action' },
        { status: 400 }
      );
    }

    if (action === 'logout') {
      destroyCurrentSession(request);
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

      const existing = userRepo.findByUsername(normalizedUsername);
      if (existing) {
        return NextResponse.json(
          { success: false, code: 'INVALID_INPUT', error: 'Username already exists' },
          { status: 400 }
        );
      }
      const result = userRepo.create({ username: normalizedUsername, password: hashPassword(password), email: null })
      const userId = Number(result.lastInsertRowid);
      const role = userRepo.getRole(userId) || 'viewer';

      const token = createSession(userId, db);
      const response = NextResponse.json({ success: true, userId, role });
      setSessionCookie(response, token);
      return response;
    }

    if (action === 'login') {
      const clientKey = getClientKey(request, normalizedUsername);
      const limit = checkLoginRateLimit(clientKey);
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

      const valid = userRepo.verifyPassword(normalizedUsername, password);
      if (!valid) {
        recordLoginFailure(clientKey);
        return NextResponse.json(
          { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' }
        );
      }

      clearLoginFailures(clientKey);
      const user = userRepo.findByUsername(normalizedUsername);
      const role = userRepo.getRole(user!.id) || 'viewer';

      const token = createSession(user!.id, db);
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
