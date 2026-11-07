import { createHash, randomBytes } from 'crypto';
import type { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
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

interface SessionTokenRow {
  token_hash: string;
  expires_at: number;
}

/** Only the SHA-256 hash of the token is persisted. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Create a session for a user and return the raw token (never stored). */
export function createSession(userId: number, db: Database.Database = getDb()): string {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
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
export function getSessionUser(
  request: RequestWithCookies,
  db: Database.Database = getDb()
): SessionUser | null {
  const token = getSessionToken(request);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.username, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    )
    .get(tokenHash) as SessionUserRow | undefined;

  if (!row) return null;

  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    id: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
  };
}

export function destroySessionByToken(
  token: string | null,
  db: Database.Database = getDb()
): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}

/** Destroy the current request's session (logout). */
export function destroyCurrentSession(
  request: RequestWithCookies,
  db: Database.Database = getDb()
): void {
  destroySessionByToken(getSessionToken(request), db);
}

/**
 * Destroy every session of a user, optionally keeping the current one
 * (used after a password change).
 */
export function destroyOtherSessionsForUser(
  userId: number,
  keepToken: string | null,
  db: Database.Database = getDb()
): void {
  if (keepToken) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
      userId,
      hashSessionToken(keepToken)
    );
  } else {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
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
