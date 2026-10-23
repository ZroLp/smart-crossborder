import Database from 'better-sqlite3';
import { SharedContext } from './shared-context';

export type SyncEvent = {
  id: number;
  source: 'web' | 'mobile';
  agentType: string;
  key: string;
  action: 'write' | 'read' | 'delete';
  timestamp: string;
};

export interface MutexLock {
  id: number;
  resource: string;
  holder: string;
  acquiredAt: string;
}

const LOCK_EXPIRY_MS = 30000;

interface SyncEventRow {
  id: number;
  source: string;
  agent_type: string;
  key: string;
  action: string;
  timestamp: string;
}

interface MutexLockRow {
  id: number;
  resource: string;
  holder: string;
  acquired_at: string;
}

export class SyncService {
  private db: Database.Database;
  private sharedContext: SharedContext;

  constructor(db: Database.Database, sharedContext: SharedContext) {
    this.db = db;
    this.sharedContext = sharedContext;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        key TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_events_source ON sync_events(source);

      CREATE TABLE IF NOT EXISTS mutex_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT UNIQUE NOT NULL,
        holder TEXT NOT NULL,
        acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  syncWrite(source: 'web' | 'mobile', agentType: string, key: string, data: Record<string, unknown>): void {
    this.sharedContext.setData(agentType, key, data);
    this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'write');
  }

  syncRead(source: 'web' | 'mobile', agentType: string, key: string): Record<string, unknown> | null {
    const result = this.sharedContext.getData(agentType, key);
    this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'read');
    return result;
  }

  syncDelete(source: 'web' | 'mobile', agentType: string, key: string): void {
    this.sharedContext.clear(agentType, key);
    this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'delete');
  }

  getSyncEvents(source?: 'web' | 'mobile', limit?: number): SyncEvent[] {
    let rows: SyncEventRow[];

    if (source) {
      rows = this.db
        .prepare('SELECT * FROM sync_events WHERE source = ? ORDER BY id DESC LIMIT ?')
        .all(source, limit ?? 100) as SyncEventRow[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM sync_events ORDER BY id DESC LIMIT ?')
        .all(limit ?? 100) as SyncEventRow[];
    }

    return rows.map((row) => ({
      id: row.id,
      source: row.source as 'web' | 'mobile',
      agentType: row.agent_type,
      key: row.key,
      action: row.action as 'write' | 'read' | 'delete',
      timestamp: row.timestamp,
    }));
  }

  private cleanExpiredLocks(): void {
    this.db
      .prepare("DELETE FROM mutex_locks WHERE acquired_at <= datetime('now', '-30 seconds')")
      .run();
  }

  acquireLock(resource: string, holder: string): boolean {
    this.cleanExpiredLocks();

    const existing = this.db
      .prepare('SELECT holder FROM mutex_locks WHERE resource = ?')
      .get(resource) as MutexLockRow | undefined;

    if (existing) {
      return false;
    }

    try {
      this.db
        .prepare('INSERT INTO mutex_locks (resource, holder) VALUES (?, ?)')
        .run(resource, holder);
      return true;
    } catch {
      return false;
    }
  }

  releaseLock(resource: string, holder: string): boolean {
    const result = this.db
      .prepare('DELETE FROM mutex_locks WHERE resource = ? AND holder = ?')
      .run(resource, holder);

    return result.changes > 0;
  }

  isLocked(resource: string): boolean {
    this.cleanExpiredLocks();

    const row = this.db
      .prepare('SELECT 1 FROM mutex_locks WHERE resource = ?')
      .get(resource);

    return row !== undefined;
  }

  getLockHolder(resource: string): string | null {
    this.cleanExpiredLocks();

    const row = this.db
      .prepare('SELECT holder FROM mutex_locks WHERE resource = ?')
      .get(resource) as MutexLockRow | undefined;

    return row ? row.holder : null;
  }
}
