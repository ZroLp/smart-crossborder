import { createHash, randomInt } from 'crypto';
import type { DbClient } from '@/lib/db/client';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
/** Minimum interval between two code deliveries to the same user. */
export const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;

export function hashEmailCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export interface EmailCodeRequestResult {
  /** False only when the cooldown suppressed the delivery. */
  sent: boolean;
  /** Exposed only outside production when no real provider is configured. */
  devCode?: string;
}

export async function requestEmailVerificationCode(
  userId: number,
  email: string,
  db: DbClient
): Promise<EmailCodeRequestResult> {
  const recent = await db
    .prepare(
      `SELECT 1 AS found FROM email_verification_codes
        WHERE user_id = ? AND created_at > now() - interval '1 second' * ?
        LIMIT 1`
    )
    .get(userId, Math.ceil(EMAIL_CODE_COOLDOWN_MS / 1000)) as { found: number } | undefined;
  if (recent) return { sent: false };

  const code = String(randomInt(100000, 1000000));
  await db
    .prepare(
      `INSERT INTO email_verification_codes (user_id, email, code_hash, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, email, hashEmailCode(code), Date.now() + EMAIL_CODE_TTL_MS);

  const provider = process.env.EMAIL_PROVIDER;
  // MVP: no SMTP/API client wired yet. Log for observability and expose the
  // code outside production so the flow stays testable end to end.
  if (!provider) {
    console.info(`[email-verification] code for ${email} (no provider configured)`);
  } else {
    console.info(`[email-verification] code for ${email} via provider ${provider}`);
  }
  if (process.env.NODE_ENV === 'production') return { sent: true };
  return { sent: true, devCode: code };
}

export type EmailConfirmation = 'ok' | 'invalid' | 'expired';

export async function confirmEmailCode(
  userId: number,
  code: string,
  db: DbClient
): Promise<EmailConfirmation> {
  const row = (await db
    .prepare(
      `SELECT code_hash, expires_at FROM email_verification_codes
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .get(userId)) as { code_hash: string; expires_at: number } | undefined;

  if (!row || row.code_hash !== hashEmailCode(code)) return 'invalid';
  if (row.expires_at <= Date.now()) return 'expired';

  await db.prepare('DELETE FROM email_verification_codes WHERE user_id = ?').run(userId);
  await db.prepare('UPDATE users SET email_verified_at = now() WHERE id = ?').run(userId);
  return 'ok';
}
