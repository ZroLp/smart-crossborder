import Database from 'better-sqlite3';

export type ErrorType = 'network' | 'compliance' | 'parameter' | 'timeout' | 'unknown';

export interface ErrorClassification {
  type: ErrorType;
  message: string;
  suggestion: string;
  retryable: boolean;
}

export interface RetryTask {
  id: number;
  agentType: string;
  taskName: string;
  input: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  createdAt: string;
}

interface RetryTaskRow {
  id: number;
  agent_type: string;
  task_name: string;
  input: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  created_at: string;
}

export class ErrorHandler {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS retry_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_type TEXT NOT NULL,
        task_name TEXT NOT NULL,
        input TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER NOT NULL,
        next_retry_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  classifyError(error: Error | string): ErrorClassification {
    const message = error instanceof Error ? error.message : error;
    const lower = message.toLowerCase();

    if (lower.includes('网络') || lower.includes('network') || lower.includes('econnrefused') || lower.includes('enotfound')) {
      return { type: 'network', message: '网络连接失败', suggestion: '请检查网络连接后重试', retryable: true };
    }

    if (lower.includes('合规') || lower.includes('compliance') || lower.includes('forbidden')) {
      return { type: 'compliance', message: '内容不合规', suggestion: '请修改违规内容后重新生成', retryable: false };
    }

    if (lower.includes('参数') || lower.includes('parameter') || lower.includes('invalid')) {
      return { type: 'parameter', message: '参数错误', suggestion: '请检查输入参数', retryable: true };
    }

    if (lower.includes('超时') || lower.includes('timeout')) {
      return { type: 'timeout', message: '请求超时', suggestion: '请稍后重试', retryable: true };
    }

    return { type: 'unknown', message: '未知错误', suggestion: '请联系技术支持', retryable: false };
  }

  scheduleRetry(agentType: string, taskName: string, input: Record<string, unknown>, maxRetries: number = 3): void {
    const nextRetryAt = new Date().toISOString().replace('T', ' ').replace('Z', '');
    this.db
      .prepare('INSERT INTO retry_tasks (agent_type, task_name, input, max_retries, next_retry_at) VALUES (?, ?, ?, ?, ?)')
      .run(agentType, taskName, JSON.stringify(input), maxRetries, nextRetryAt);
  }

  getRetryTasks(): RetryTask[] {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const rows = this.db
      .prepare('SELECT * FROM retry_tasks WHERE next_retry_at <= ? AND retry_count < max_retries')
      .all(now) as RetryTaskRow[];

    return rows.map((row) => ({
      id: row.id,
      agentType: row.agent_type,
      taskName: row.task_name,
      input: row.input,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
    }));
  }

  markRetried(taskId: number): void {
    const nextRetryAt = new Date().toISOString().replace('T', ' ').replace('Z', '');
    this.db
      .prepare('UPDATE retry_tasks SET retry_count = retry_count + 1, next_retry_at = ? WHERE id = ?')
      .run(nextRetryAt, taskId);
  }

  removeRetryTask(taskId: number): void {
    this.db
      .prepare('DELETE FROM retry_tasks WHERE id = ?')
      .run(taskId);
  }
}
