import { DbClient } from '../db/client';
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
  private db: DbClient;
  private sharedContext: SharedContext;

  // sync_events / mutex_locks 由中心 schema（lib/db/schema.ts）创建。
  constructor(db: DbClient, sharedContext: SharedContext) {
    this.db = db;
    this.sharedContext = sharedContext;
  }

  async syncWrite(source: 'web' | 'mobile', agentType: string, key: string, data: Record<string, unknown>): Promise<void> {
    await this.sharedContext.setData(agentType, key, data);
    await this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'write');
  }

  async syncRead(source: 'web' | 'mobile', agentType: string, key: string): Promise<Record<string, unknown> | null> {
    const result = await this.sharedContext.getData(agentType, key);
    await this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'read');
    return result;
  }

  async syncDelete(source: 'web' | 'mobile', agentType: string, key: string): Promise<void> {
    await this.sharedContext.clear(agentType, key);
    await this.db
      .prepare('INSERT INTO sync_events (source, agent_type, key, action) VALUES (?, ?, ?, ?)')
      .run(source, agentType, key, 'delete');
  }

  async getSyncEvents(source?: 'web' | 'mobile', limit?: number): Promise<SyncEvent[]> {
    let rows: SyncEventRow[];

    if (source) {
      rows = await this.db
        .prepare('SELECT * FROM sync_events WHERE source = ? ORDER BY id DESC LIMIT ?')
        .all(source, limit ?? 100) as SyncEventRow[];
    } else {
      rows = await this.db
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

  private async cleanExpiredLocks(): Promise<void> {
    await this.db
      .prepare("DELETE FROM mutex_locks WHERE acquired_at <= now() - ?::interval")
      .run(`${LOCK_EXPIRY_MS / 1000} seconds`);
  }

  async acquireLock(resource: string, holder: string): Promise<boolean> {
    await this.cleanExpiredLocks();

    const existing = await this.db
      .prepare('SELECT holder FROM mutex_locks WHERE resource = ?')
      .get(resource) as MutexLockRow | undefined;

    if (existing) {
      return false;
    }

    try {
      await this.db
        .prepare('INSERT INTO mutex_locks (resource, holder) VALUES (?, ?)')
        .run(resource, holder);
      return true;
    } catch {
      return false;
    }
  }

  async releaseLock(resource: string, holder: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM mutex_locks WHERE resource = ? AND holder = ?')
      .run(resource, holder);

    return result.changes > 0;
  }

  async isLocked(resource: string): Promise<boolean> {
    await this.cleanExpiredLocks();

    const row = await this.db
      .prepare('SELECT 1 FROM mutex_locks WHERE resource = ?')
      .get(resource);

    return row !== undefined;
  }

  async getLockHolder(resource: string): Promise<string | null> {
    await this.cleanExpiredLocks();

    const row = await this.db
      .prepare('SELECT holder FROM mutex_locks WHERE resource = ?')
      .get(resource) as MutexLockRow | undefined;

    return row ? row.holder : null;
  }
}
