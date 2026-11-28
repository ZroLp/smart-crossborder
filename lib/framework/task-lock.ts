import { DbClient } from '../db/client';

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
  private db: DbClient;

  // task_locks 由中心 schema（lib/db/schema.ts）创建。
  constructor(db: DbClient) {
    this.db = db;
  }

  /**
   * 依赖唯一约束实现互斥获取。`ON CONFLICT DO NOTHING` 时插入生效
   * rowCount=1、冲突 rowCount=0，据此返回布尔。相比捕获唯一约束
   * 违例，不产生 Postgres 错误响应，PGlite 测试桥不会失步
   * （真实 Postgres 行为等价）。
   */
  async acquire(resource: string, agentType: string, taskId: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'INSERT INTO task_locks (resource, agent_type, task_id) VALUES (?, ?, ?) ON CONFLICT (resource) DO NOTHING'
      )
      .run(resource, agentType, taskId);
    return result.changes > 0;
  }

  async release(resource: string, agentType: string, taskId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM task_locks WHERE resource = ? AND agent_type = ? AND task_id = ?')
      .run(resource, agentType, taskId);
    return result.changes > 0;
  }

  async isLocked(resource: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM task_locks WHERE resource = ?')
      .get(resource);
    return row !== undefined;
  }

  async getLockInfo(resource: string): Promise<LockRecord | null> {
    const row = await this.db
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

  async forceRelease(resource: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM task_locks WHERE resource = ?')
      .run(resource);
  }

  async cleanExpired(maxAgeMs: number = 30000): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM task_locks WHERE acquired_at <= now() - ?::interval")
      .run(`${(maxAgeMs / 1000).toFixed(3)} seconds`);
    return result.changes;
  }
}
