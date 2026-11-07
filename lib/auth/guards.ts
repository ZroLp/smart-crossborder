import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { getSessionUser, SessionUser } from './session';

export type AuthUser = SessionUser;

export type AuthResolution =
  | { user: AuthUser; response: null }
  | { user: null; response: NextResponse };

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', error: 'Authentication required' },
    { status: 401 }
  );
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { success: false, code: 'FORBIDDEN', error: 'Insufficient permissions' },
    { status: 403 }
  );
}

export function isLegacyAuthCompatEnabled(): boolean {
  return process.env.AUTH_LEGACY_COMPAT === '1';
}

function findLegacyUser(raw: unknown): AuthUser | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;

  const user = new UserRepository(getDb()).findById(id);
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

/**
 * Resolve the authenticated user.
 * Session cookie always wins. Query/body/header userId is only honored when
 * AUTH_LEGACY_COMPAT=1 (local fallback, disabled by default).
 */
export function getAuthUser(request: NextRequest, legacyUserId?: unknown): AuthUser | null {
  const sessionUser = getSessionUser(request);
  if (sessionUser) return sessionUser;

  if (!isLegacyAuthCompatEnabled()) return null;

  const raw =
    legacyUserId ??
    request.nextUrl?.searchParams?.get('userId') ??
    request.headers.get('x-user-id');
  return findLegacyUser(raw);
}

export function requireUser(request: NextRequest, legacyUserId?: unknown): AuthResolution {
  const user = getAuthUser(request, legacyUserId);
  if (!user) return { user: null, response: unauthorizedResponse() };
  return { user, response: null };
}

export function requireRole(
  request: NextRequest,
  roles: string[],
  legacyUserId?: unknown
): AuthResolution {
  const resolution = requireUser(request, legacyUserId);
  if (resolution.response) return resolution;

  if (!roles.includes(resolution.user.role)) {
    return { user: null, response: forbiddenResponse() };
  }
  return resolution;
}

export function requireAdmin(request: NextRequest, legacyUserId?: unknown): AuthResolution {
  return requireRole(request, ['admin'], legacyUserId);
}
