import crypto from 'crypto';
import { DbClient } from '@/lib/db/client';
import { getDb } from '@/lib/db/init';

const STATE_TTL_MS = 10 * 60 * 1000;

function getDatabase(db?: DbClient): DbClient {
  return db || getDb();
}

export async function generateState(userId: number, db?: DbClient): Promise<string> {
  const database = getDatabase(db);
  const state = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  await database.prepare('INSERT INTO oauth_states (state, user_id, expires_at) VALUES (?, ?, ?)').run(state, userId, now + STATE_TTL_MS);
  return state;
}

export async function validateState(state: string, db?: DbClient): Promise<{ userId: number } | null> {
  const database = getDatabase(db);
  const row = await database.prepare('SELECT user_id, expires_at FROM oauth_states WHERE state = ?').get(state) as { user_id: number; expires_at: number } | undefined;
  if (!row) return null;

  if (Date.now() > row.expires_at) {
    await database.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
    return null;
  }

  await database.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  return { userId: row.user_id };
}
