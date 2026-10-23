import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';

interface TaskLog {
  id: number;
  agent_type: string;
  task_name: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
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

  updateStatus(id: number, status: string, output?: string, error?: string): Database.RunResult {
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: (string | number)[] = [status, id];

    if (output !== undefined) {
      updates.push('output = ?');
      values.splice(values.length - 1, 0, output);
    }

    if (error !== undefined) {
      updates.push('error = ?');
      values.splice(values.length - 1, 0, error);
    }

    const sql = `UPDATE task_logs SET ${updates.join(', ')} WHERE id = ?`;
    return this.db.prepare(sql).run(...values);
  }
}
