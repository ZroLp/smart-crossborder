import type { NextRequest } from 'next/server';
import type { DbClient } from '@/lib/db/client';

/** Best-effort client IP extraction (X-Forwarded-For first hop, then X-Real-IP). */
export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || null;
}

export function getUserAgent(request: NextRequest): string {
  const ua = (request.headers.get('user-agent') || '').trim().slice(0, 255);
  return ua || 'unknown';
}

export interface UserDevice {
  user_agent: string;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
}

/**
 * P6-01: upsert the (user, device) pair so every login/registration records
 * the origin IP and user agent for audit / device listing.
 */
export async function recordUserDevice(userId: number, request: NextRequest, db: DbClient): Promise<void> {
  const userAgent = getUserAgent(request);
  const ip = getClientIp(request);
  try {
    await db
      .prepare(
        `INSERT INTO user_devices (user_id, user_agent, ip)
         VALUES (?, ?, ?)
         ON CONFLICT (user_id, user_agent)
         DO UPDATE SET ip = EXCLUDED.ip, last_seen_at = now()`
      )
      .run(userId, userAgent, ip);
  } catch (error) {
    // P9-01: 设备审计为 best-effort，失败不得阻断登录/注册主流程。
    console.warn('[auth] recordUserDevice failed:', error);
  }
}

export async function listUserDevices(userId: number, db: DbClient, limit = 50): Promise<UserDevice[]> {
  return (await db
    .prepare(
      `SELECT user_agent, ip, last_seen_at, created_at
         FROM user_devices
        WHERE user_id = ?
        ORDER BY last_seen_at DESC
        LIMIT ?`
    )
    .all(userId, limit)) as UserDevice[];
}
