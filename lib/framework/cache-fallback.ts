import Database from 'better-sqlite3';

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
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_data_cache_source_key ON data_cache(source, key);
    `);
  }

  set(source: string, key: string, data: Record<string, unknown>, ttlMs: number = 3600000): void {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.db
      .prepare(`INSERT INTO data_cache (source, key, data, expires_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(source, key) DO UPDATE SET data = excluded.data, fetched_at = CURRENT_TIMESTAMP, expires_at = excluded.expires_at`)
      .run(source, key, JSON.stringify(data), expiresAt);
  }

  get(source: string, key: string): { data: Record<string, unknown>; isStale: boolean; fetchedAt: string } | null {
    const row = this.db
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

  invalidate(source: string, key: string): void {
    this.db
      .prepare('DELETE FROM data_cache WHERE source = ? AND key = ?')
      .run(source, key);
  }

  cleanExpired(): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('DELETE FROM data_cache WHERE expires_at IS NOT NULL AND expires_at <= ?')
      .run(now);
    return result.changes;
  }
}
