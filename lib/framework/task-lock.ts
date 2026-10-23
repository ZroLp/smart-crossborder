import Database from 'better-sqlite3';

export interface LockRecord {
  id: number;
  resource: string;
  agentType: string;
  taskId: string;
  acquiredAt: string;
}

interface LockRecordRow {
  id: number;
  resource: string;
  agent_type: string;
  task_id: string;
  acquired_at: string;
}

export class TaskLock {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT UNIQUE NOT NULL,
        agent_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        acquired_at DATETIME DEFAULT (datetime('now'))
      );
    `);
  }

  acquire(resource: string, agentType: string, taskId: string): boolean {
    try {
      this.db
        .prepare('INSERT INTO task_locks (resource, agent_type, task_id) VALUES (?, ?, ?)')
        .run(resource, agentType, taskId);
      return true;
    } catch {
      return false;
    }
  }

  release(resource: string, agentType: string, taskId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM task_locks WHERE resource = ? AND agent_type = ? AND task_id = ?')
      .run(resource, agentType, taskId);
    return result.changes > 0;
  }

  isLocked(resource: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM task_locks WHERE resource = ?')
      .get(resource);
    return row !== undefined;
  }

  getLockInfo(resource: string): LockRecord | null {
    const row = this.db
      .prepare('SELECT * FROM task_locks WHERE resource = ?')
      .get(resource) as LockRecordRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      resource: row.resource,
      agentType: row.agent_type,
      taskId: row.task_id,
      acquiredAt: row.acquired_at,
    };
  }

  forceRelease(resource: string): void {
    this.db
      .prepare('DELETE FROM task_locks WHERE resource = ?')
      .run(resource);
  }

  cleanExpired(maxAgeMs: number = 30000): number {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString().replace('T', ' ').replace('Z', '');
    const result = this.db
      .prepare('DELETE FROM task_locks WHERE acquired_at <= ?')
      .run(cutoff);
    return result.changes;
  }
}
