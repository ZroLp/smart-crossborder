import Database from 'better-sqlite3';
import { ErrorHandler } from '@/lib/framework/error-handler';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('ErrorHandler', () => {
  let db: Database.Database;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    db = createTestDb();
    errorHandler = new ErrorHandler(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('classifyError', () => {
    test('classifies network errors from string', () => {
      const result = errorHandler.classifyError('网络连接中断');
      expect(result.type).toBe('network');
      expect(result.message).toBe('网络连接失败');
      expect(result.suggestion).toBe('请检查网络连接后重试');
      expect(result.retryable).toBe(true);
    });

    test('classifies network errors from English keyword', () => {
      const result = errorHandler.classifyError('Network error occurred');
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    test('classifies network errors from ECONNREFUSED', () => {
      const result = errorHandler.classifyError('ECONNREFUSED 127.0.0.1:3000');
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    test('classifies network errors from ENOTFOUND', () => {
      const result = errorHandler.classifyError('ENOTFOUND api.example.com');
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    test('classifies network errors from Error object', () => {
      const result = errorHandler.classifyError(new Error('network timeout'));
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    test('classifies compliance errors from Chinese keyword', () => {
      const result = errorHandler.classifyError('内容不合规');
      expect(result.type).toBe('compliance');
      expect(result.message).toBe('内容不合规');
      expect(result.suggestion).toBe('请修改违规内容后重新生成');
      expect(result.retryable).toBe(false);
    });

    test('classifies compliance errors from English keyword', () => {
      const result = errorHandler.classifyError('compliance violation detected');
      expect(result.type).toBe('compliance');
      expect(result.retryable).toBe(false);
    });

    test('classifies compliance errors from forbidden', () => {
      const result = errorHandler.classifyError('Access forbidden');
      expect(result.type).toBe('compliance');
      expect(result.retryable).toBe(false);
    });

    test('classifies parameter errors from Chinese keyword', () => {
      const result = errorHandler.classifyError('参数错误');
      expect(result.type).toBe('parameter');
      expect(result.message).toBe('参数错误');
      expect(result.suggestion).toBe('请检查输入参数');
      expect(result.retryable).toBe(true);
    });

    test('classifies parameter errors from English keyword', () => {
      const result = errorHandler.classifyError('Invalid parameter value');
      expect(result.type).toBe('parameter');
      expect(result.retryable).toBe(true);
    });

    test('classifies parameter errors from parameter keyword', () => {
      const result = errorHandler.classifyError('parameter missing');
      expect(result.type).toBe('parameter');
      expect(result.retryable).toBe(true);
    });

    test('classifies timeout errors from Chinese keyword', () => {
      const result = errorHandler.classifyError('请求超时');
      expect(result.type).toBe('timeout');
      expect(result.message).toBe('请求超时');
      expect(result.suggestion).toBe('请稍后重试');
      expect(result.retryable).toBe(true);
    });

    test('classifies timeout errors from English keyword', () => {
      const result = errorHandler.classifyError('Request timeout after 30s');
      expect(result.type).toBe('timeout');
      expect(result.retryable).toBe(true);
    });

    test('classifies unknown errors', () => {
      const result = errorHandler.classifyError('Something went wrong');
      expect(result.type).toBe('unknown');
      expect(result.message).toBe('未知错误');
      expect(result.suggestion).toBe('请联系技术支持');
      expect(result.retryable).toBe(false);
    });

    test('classifies unknown errors from Error object', () => {
      const result = errorHandler.classifyError(new Error('Random failure'));
      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
    });

    test('prioritizes network over other types', () => {
      const result = errorHandler.classifyError('network timeout error');
      expect(result.type).toBe('network');
    });

    test('prioritizes compliance over parameter and unknown', () => {
      const result = errorHandler.classifyError('compliance parameter issue');
      expect(result.type).toBe('compliance');
    });
  });

  describe('scheduleRetry and getRetryTasks', () => {
    test('scheduleRetry adds task to retry queue', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].agentType).toBe('selection');
      expect(tasks[0].taskName).toBe('fetchProducts');
      expect(tasks[0].input).toBe(JSON.stringify({ query: 'shoes' }));
      expect(tasks[0].retryCount).toBe(0);
      expect(tasks[0].maxRetries).toBe(3);
    });

    test('scheduleRetry uses custom maxRetries', () => {
      errorHandler.scheduleRetry('content', 'generateListing', { id: 1 }, 5);
      const tasks = errorHandler.getRetryTasks();
      expect(tasks[0].maxRetries).toBe(5);
    });

    test('getRetryTasks returns empty array when no tasks', () => {
      const tasks = errorHandler.getRetryTasks();
      expect(tasks).toEqual([]);
    });

    test('getRetryTasks returns tasks with correct structure', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      const task = tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('agentType');
      expect(task).toHaveProperty('taskName');
      expect(task).toHaveProperty('input');
      expect(task).toHaveProperty('retryCount');
      expect(task).toHaveProperty('maxRetries');
      expect(task).toHaveProperty('nextRetryAt');
      expect(task).toHaveProperty('createdAt');
      expect(typeof task.id).toBe('number');
      expect(typeof task.nextRetryAt).toBe('string');
      expect(typeof task.createdAt).toBe('string');
    });
  });

  describe('markRetried', () => {
    test('increments retry count', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      const taskId = tasks[0].id;

      errorHandler.markRetried(taskId);

      const updated = db.prepare('SELECT retry_count FROM retry_tasks WHERE id = ?').get(taskId) as { retry_count: number };
      expect(updated.retry_count).toBe(1);
    });

    test('increments retry count multiple times', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      const taskId = tasks[0].id;

      errorHandler.markRetried(taskId);
      errorHandler.markRetried(taskId);
      errorHandler.markRetried(taskId);

      const updated = db.prepare('SELECT retry_count FROM retry_tasks WHERE id = ?').get(taskId) as { retry_count: number };
      expect(updated.retry_count).toBe(3);
    });

    test('updates retryCount when marking retried', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      const taskId = tasks[0].id;
      expect(tasks[0].retryCount).toBe(0);

      errorHandler.markRetried(taskId);

      const updated = errorHandler.getRetryTasks();
      expect(updated[0].retryCount).toBe(1);
    });
  });

  describe('removeRetryTask', () => {
    test('removes task from queue', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      const tasks = errorHandler.getRetryTasks();
      expect(tasks).toHaveLength(1);

      errorHandler.removeRetryTask(tasks[0].id);

      const remaining = db.prepare('SELECT COUNT(*) as count FROM retry_tasks').get() as { count: number };
      expect(remaining.count).toBe(0);
    });

    test('removes only the specified task', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
      errorHandler.scheduleRetry('content', 'generateListing', { id: 1 });

      const tasks = errorHandler.getRetryTasks();
      expect(tasks).toHaveLength(2);

      errorHandler.removeRetryTask(tasks[0].id);

      const remaining = db.prepare('SELECT COUNT(*) as count FROM retry_tasks').get() as { count: number };
      expect(remaining.count).toBe(1);
    });
  });

  describe('retry limit enforcement', () => {
    test('getRetryTasks excludes tasks that reached max retries', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' }, 2);
      const tasks = errorHandler.getRetryTasks();
      const taskId = tasks[0].id;

      errorHandler.markRetried(taskId);
      errorHandler.markRetried(taskId);

      const retryable = errorHandler.getRetryTasks();
      expect(retryable).toHaveLength(0);
    });

    test('getRetryTasks includes tasks that have not reached max retries', () => {
      errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' }, 3);
      const tasks = errorHandler.getRetryTasks();
      const taskId = tasks[0].id;

      errorHandler.markRetried(taskId);

      const retryable = errorHandler.getRetryTasks();
      expect(retryable).toHaveLength(1);
      expect(retryable[0].retryCount).toBe(1);
    });

    test('getRetryTasks excludes tasks with future nextRetryAt', () => {
      db.prepare('INSERT INTO retry_tasks (agent_type, task_name, input, max_retries, next_retry_at) VALUES (?, ?, ?, ?, ?)')
        .run('selection', 'fetchProducts', '{}', 3, new Date(Date.now() + 60000).toISOString());

      const retryable = errorHandler.getRetryTasks();
      expect(retryable).toHaveLength(0);
    });
  });
});
