import { createHash, randomBytes } from 'crypto';
import type { NextResponse } from 'next/server';
import { DbClient } from '@/lib/db/client';
import { getDb } from '@/lib/db/init';

export const SESSION_COOKIE_NAME = 'sumaitong_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
}

export interface RequestWithCookies {
  cookies?: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}

interface SessionUserRow {
  user_id: number;
  expires_at: number;
  username: string;
  email: string | null;
  role: string;
}

/** Only the SHA-256 hash of the token is persisted. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Create a session for a user and return the raw token (never stored). */
export async function createSession(userId: number, db: DbClient = getDb()): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashSessionToken(token),
    userId,
    now + SESSION_TTL_MS
  );
  return token;
}

/** Read the session token from the cookie (NextRequest or raw Cookie header). */
export function getSessionToken(request: RequestWithCookies): string | null {
  const fromCookies = request.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  if (fromCookies) return fromCookies;

  const cookieHeader = request.headers?.get?.('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(separator + 1).trim()) || null;
  }
  return null;
}

/** Resolve the current session user, deleting the row when expired. */
export async function getSessionUser(
  request: RequestWithCookies,
  db: DbClient = getDb()
): Promise<SessionUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const row = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.username, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    )
    .get(tokenHash) as SessionUserRow | undefined;

  if (!row) return null;

  if (row.expires_at <= Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    id: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
  };
}

export async function destroySessionByToken(
  token: string | null,
  db: DbClient = getDb()
): Promise<void> {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}

/** Destroy the current request's session (logout). */
export async function destroyCurrentSession(
  request: RequestWithCookies,
  db: DbClient = getDb()
): Promise<void> {
  await destroySessionByToken(getSessionToken(request), db);
}

/**
 * Destroy every session of a user, optionally keeping the current one
 * (used after a password change).
 */
export async function destroyOtherSessionsForUser(
  userId: number,
  keepToken: string | null,
  db: DbClient = getDb()
): Promise<void> {
  if (keepToken) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
      userId,
      hashSessionToken(keepToken)
    );
  } else {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

/** Destroy every session of the user (logout-all), then drop the caller's token. */
export async function destroyAllSessionsForUser(
  userId: number,
  db: DbClient = getDb()
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/** Batch-delete expired session rows; returns the number removed. */
export async function cleanupExpiredSessions(db: DbClient = getDb()): Promise<number> {
  const now = Date.now();
  const info = await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  return Number(info.changes ?? 0);
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
}
