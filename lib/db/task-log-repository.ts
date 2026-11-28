import { DbClient, RunResult } from './client';
import { BaseRepository } from './base-repository';

export interface TaskLog {
  id: number;
  root_task_id?: number | null;
  parent_task_id?: number | null;
  attempt_number?: number;
  started_at?: string | null;
  ended_at?: string | null;
  chain?: number;
  idempotency_key?: string | null;
  claimed_by?: string | null;
  heartbeat_at?: string | null;
  lease_until?: string | null;
  requeue_count?: number;
  agent_type: string;
  task_name: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

export class TaskLogRepository extends BaseRepository<TaskLog> {
  constructor(db: DbClient) {
    super(db, 'task_logs');
  }

  async findByAgentType(agentType: string): Promise<TaskLog[]> {
    return (await this.db.prepare('SELECT * FROM task_logs WHERE agent_type = ?').all(agentType)) as TaskLog[];
  }

  async findByStatus(status: string): Promise<TaskLog[]> {
    return (await this.db.prepare('SELECT * FROM task_logs WHERE status = ?').all(status)) as TaskLog[];
  }

  async findByUserId(userId: number, limit: number = 100, offset: number = 0): Promise<TaskLog[]> {
    return (await this.db
      .prepare('SELECT * FROM task_logs WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(userId, limit, offset)) as TaskLog[];
  }

  async countByUserId(userId: number): Promise<number> {
    const row = (await this.db
      .prepare('SELECT COUNT(*) as count FROM task_logs WHERE user_id = ?')
      .get(userId)) as { count: number };
    return row.count;
  }

  async findAttempts(taskId: number): Promise<TaskLog[]> {
    const task = await this.findById(taskId);
    if (!task) return [];
    const root = task.root_task_id ?? task.id;
    return (await this.db.prepare('SELECT * FROM task_logs WHERE id = ? OR root_task_id = ? ORDER BY attempt_number, id').all(root, root)) as TaskLog[];
  }

  async findEvents(taskId: number): Promise<unknown[]> {
    return this.db.prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY id').all(taskId);
  }

  /** Look up the task stored under a unique idempotency key (null when absent). */
  async findByIdempotencyKey(key: string): Promise<TaskLog | null> {
    return ((await this.db
      .prepare('SELECT * FROM task_logs WHERE idempotency_key = ? ORDER BY id DESC LIMIT 1')
      .get(key)) as TaskLog | undefined) ?? null;
  }

  async updateStatus(id: number, status: string, output?: string, error?: string): Promise<RunResult> {
    const current = await this.findById(id);
    if (!current) throw new Error('Task not found: ' + id);
    if (current.status === status) return { changes: 0, lastInsertRowid: id };
    const allowed: Record<string, string[]> = { pending: ['running', 'terminated', 'completed', 'failed'], running: ['paused', 'terminated', 'completed', 'failed'], paused: ['running', 'terminated'], failed: ['pending'], completed: [], terminated: [] };
    if (!allowed[current.status]?.includes(status)) throw new Error('Invalid task transition: ' + current.status + ' -> ' + status);
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    if (status === 'running') updates.push('started_at = CURRENT_TIMESTAMP', 'ended_at = NULL', 'error = NULL');
    if (['completed', 'failed', 'terminated'].includes(status)) updates.push('ended_at = CURRENT_TIMESTAMP');
    const values: (string | number)[] = [status, id];

    if (output !== undefined) {
      updates.push('output = ?');
      values.splice(values.length - 1, 0, output);
    }

    if (error !== undefined) {
      updates.push('error = ?');
      values.splice(values.length - 1, 0, error);
    }

    const sql = `UPDATE task_logs SET ${updates.join(', ')} WHERE id = ? AND status = ?`;
    const result = await this.db.prepare(sql).run(...values, current.status);
    if (!result.changes) throw new Error('Concurrent task state update: ' + id);
    return result;
  }
}
