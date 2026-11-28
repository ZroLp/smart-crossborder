import { NextRequest, NextResponse } from 'next/server';
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

/**
 * Resolve the authenticated user from the session cookie only.
 * Query/body/header 中的 userId 一律不作为身份来源。
 */
export function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  return getSessionUser(request);
}

export async function requireUser(request: NextRequest): Promise<AuthResolution> {
  const user = await getAuthUser(request);
  if (!user) return { user: null, response: unauthorizedResponse() };
  return { user, response: null };
}

export async function requireRole(request: NextRequest, roles: string[]): Promise<AuthResolution> {
  const resolution = await requireUser(request);
  if (resolution.response) return resolution;

  if (!roles.includes(resolution.user.role)) {
    return { user: null, response: forbiddenResponse() };
  }
  return resolution;
}

export async function requireAdmin(request: NextRequest): Promise<AuthResolution> {
  return requireRole(request, ['admin']);
}
