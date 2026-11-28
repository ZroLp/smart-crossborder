import { createHash, randomInt, randomUUID } from 'crypto';
import type { DbClient } from '@/lib/db/client';
import { getSmsProvider } from './providers';

/**
 * P6-02: SMS verification with captcha pre-check, anti-bombing limits and
 * hashed, expiring 6-digit codes. All counters are DB-based so they hold
 * across instances.
 */

export const SMS_CODE_TTL_MS = 10 * 60 * 1000;
export const CAPTCHA_TTL_MS = 5 * 60 * 1000;

export const SMS_LIMITS = {
  /** one send per phone per minute */
  perPhoneMinutes: 60 * 1000,
  /** max sends per phone per 24h */
  perPhoneDaily: 10,
  /** max sends per IP per hour */
  perIpHourly: 3,
} as const;

export function hashSmsCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function isWellFormedPhone(phone: string): boolean {
  return /^\+?[0-9]{7,15}$/.test(phone.trim());
}

export interface CaptchaChallenge {
  captchaId: string;
  /** arithmetic challenge: a + b */
  a: number;
  b: number;
}

export async function issueCaptcha(db: DbClient): Promise<CaptchaChallenge> {
  const a = randomInt(10, 99);
  const b = randomInt(10, 99);
  const id = randomUUID();
  await db
    .prepare('INSERT INTO captcha_challenges (id, answer_hash, expires_at) VALUES (?, ?, ?)')
    .run(id, createHash('sha256').update(String(a + b)).digest('hex'), Date.now() + CAPTCHA_TTL_MS);
  return { captchaId: id, a, b };
}

export type CaptchaOutcome = 'ok' | 'invalid';

export async function checkCaptcha(db: DbClient, captchaId: string, answer: string): Promise<CaptchaOutcome> {
  const row = (await db
    .prepare('SELECT answer_hash, expires_at FROM captcha_challenges WHERE id = ?')
    .get(captchaId)) as { answer_hash: string; expires_at: number } | undefined;
  if (!row) return 'invalid';
  if (row.expires_at <= Date.now()) return 'invalid';

  await db.prepare('DELETE FROM captcha_challenges WHERE id = ?').run(captchaId);
  return row.answer_hash === createHash('sha256').update(answer).digest('hex') ? 'ok' : 'invalid';
}

export type RateLimitReason = 'phone-cooldown' | 'phone-daily' | 'ip-hourly' | null;

export async function getSmsRateLimit(
  db: DbClient,
  phone: string,
  ip: string | null
): Promise<RateLimitReason> {
  const phoneWindow = (await db
    .prepare(`SELECT 1 AS found FROM sms_verification_codes WHERE phone = ? AND created_at > now() - interval '1 minute' LIMIT 1`)
    .get(phone)) as { found: number } | undefined;
  if (phoneWindow) return 'phone-cooldown';

  const daily = (await db
    .prepare('SELECT COUNT(*) AS c FROM sms_verification_codes WHERE phone = ? AND created_at > now() - interval \'24 hours\'')
    .get(phone)) as { c: number };
  if (daily.c >= SMS_LIMITS.perPhoneDaily) return 'phone-daily';

  if (ip) {
    const ipCount = (await db
      .prepare('SELECT COUNT(*) AS c FROM sms_verification_codes WHERE ip = ? AND created_at > now() - interval \'1 hour\'')
      .get(ip)) as { c: number };
    if (ipCount.c >= SMS_LIMITS.perIpHourly) return 'ip-hourly';
  }
  return null;
}

export type SmsSendOutcome =
  | { ok: true; devCode?: string; delivery: string }
  | { ok: false; reason: RateLimitReason | 'captcha' | 'validation' };

export interface SendSmsParams {
  phone: string;
  ip: string | null;
  captchaId: string;
  answer: string;
}

export async function sendSmsCode(db: DbClient, params: SendSmsParams): Promise<SmsSendOutcome> {
  if (!isWellFormedPhone(params.phone)) return { ok: false, reason: 'validation' };
  const phone = params.phone.trim();

  const captcha = await checkCaptcha(db, params.captchaId, params.answer);
  if (captcha !== 'ok') return { ok: false, reason: 'captcha' };

  const reason = await getSmsRateLimit(db, phone, params.ip);
  if (reason) return { ok: false, reason };

  const code = String(randomInt(100000, 1000000));
  await db
    .prepare('INSERT INTO sms_verification_codes (phone, code_hash, ip, expires_at) VALUES (?, ?, ?, ?)')
    .run(phone, hashSmsCode(code), params.ip, Date.now() + SMS_CODE_TTL_MS);

  const result = await getSmsProvider().send(phone, code);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    ok: true,
    delivery: result.provider,
    devCode: !result.ok || isProduction ? undefined : code,
  };
}

export type SmsVerifyOutcome = 'ok' | 'invalid' | 'expired' | 'not-found';

export async function verifySmsCode(db: DbClient, phone: string, code: string): Promise<SmsVerifyOutcome> {
  const row = (await db
    .prepare(
      `SELECT code_hash, expires_at FROM sms_verification_codes
        WHERE phone = ? AND verified_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .get(phone)) as { code_hash: string; expires_at: number } | undefined;

  if (!row) return 'not-found';
  if (row.code_hash !== hashSmsCode(code)) return 'invalid';
  if (row.expires_at <= Date.now()) return 'expired';

  await db.prepare('UPDATE sms_verification_codes SET verified_at = now() WHERE phone = ?').run(phone);
  return 'ok';
}
