import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';

export interface TaskLog {
  id: number;
  root_task_id?: number | null;
  parent_task_id?: number | null;
  attempt_number?: number;
  started_at?: string | null;
  ended_at?: string | null;
  chain?: number;
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
  constructor(db: Database.Database) {
    super(db, 'task_logs');
  }

  findByAgentType(agentType: string): TaskLog[] {
    return this.db.prepare('SELECT * FROM task_logs WHERE agent_type = ?').all(agentType) as TaskLog[];
  }

  findByStatus(status: string): TaskLog[] {
    return this.db.prepare('SELECT * FROM task_logs WHERE status = ?').all(status) as TaskLog[];
  }

  findByUserId(userId: number, limit: number = 100, offset: number = 0): TaskLog[] {
    return this.db
      .prepare('SELECT * FROM task_logs WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(userId, limit, offset) as TaskLog[];
  }

  countByUserId(userId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM task_logs WHERE user_id = ?')
      .get(userId) as { count: number };
    return row.count;
  }

  findAttempts(taskId: number): TaskLog[] {
    const task = this.findById(taskId);
    if (!task) return [];
    const root = task.root_task_id ?? task.id;
    return this.db.prepare('SELECT * FROM task_logs WHERE id = ? OR root_task_id = ? ORDER BY attempt_number, id').all(root, root) as TaskLog[];
  }

  findEvents(taskId: number): unknown[] {
    return this.db.prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY id').all(taskId);
  }

  updateStatus(id: number, status: string, output?: string, error?: string): Database.RunResult {
    const current = this.findById(id);
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
    const result = this.db.prepare(sql).run(...values, current.status);
    if (!result.changes) throw new Error('Concurrent task state update: ' + id);
    return result;
  }
}
