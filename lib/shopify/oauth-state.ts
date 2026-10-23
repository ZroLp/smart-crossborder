import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db/init';

const STATE_TTL_MS = 10 * 60 * 1000;

function getDatabase(db?: Database.Database): Database.Database {
  return db || getDb();
}

export function generateState(userId: number, db?: Database.Database): string {
  const database = getDatabase(db);
  const state = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  database.prepare('INSERT INTO oauth_states (state, user_id, expires_at) VALUES (?, ?, ?)').run(state, userId, now + STATE_TTL_MS);
  return state;
}

export function validateState(state: string, db?: Database.Database): { userId: number } | null {
  const database = getDatabase(db);
  const row = database.prepare('SELECT user_id, expires_at FROM oauth_states WHERE state = ?').get(state) as { user_id: number; expires_at: number } | undefined;
  if (!row) return null;

  if (Date.now() > row.expires_at) {
    database.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
    return null;
  }

  database.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  return { userId: row.user_id };
}
