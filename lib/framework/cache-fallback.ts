import { DbClient } from '../db/client';

export interface CacheEntry {
  id: number;
  source: string;
  key: string;
  data: string;
  fetchedAt: string;
  expiresAt: string | null;
}

interface CacheEntryRow {
  id: number;
  source: string;
  key: string;
  data: string;
  fetched_at: string;
  expires_at: string | null;
}

export class CacheFallback {
  private db: DbClient;

  // data_cache 由中心 schema（lib/db/schema.ts）创建。
  constructor(db: DbClient) {
    this.db = db;
  }

  async set(source: string, key: string, data: Record<string, unknown>, ttlMs: number = 3600000): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await this.db
      .prepare(`INSERT INTO data_cache (source, key, data, expires_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (source, key) DO UPDATE SET data = excluded.data, fetched_at = CURRENT_TIMESTAMP, expires_at = excluded.expires_at`)
      .run(source, key, JSON.stringify(data), expiresAt);
  }

  async get(source: string, key: string): Promise<{ data: Record<string, unknown>; isStale: boolean; fetchedAt: string } | null> {
    const row = await this.db
      .prepare('SELECT * FROM data_cache WHERE source = ? AND key = ?')
      .get(source, key) as CacheEntryRow | undefined;

    if (!row) {
      return null;
    }

    const now = Date.now();
    const isStale = row.expires_at !== null && new Date(row.expires_at).getTime() <= now;

    return {
      data: JSON.parse(row.data) as Record<string, unknown>,
      isStale,
      fetchedAt: row.fetched_at,
    };
  }

  async invalidate(source: string, key: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM data_cache WHERE source = ? AND key = ?')
      .run(source, key);
  }

  async cleanExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare('DELETE FROM data_cache WHERE expires_at IS NOT NULL AND expires_at <= ?')
      .run(now);
    return result.changes;
  }
}
