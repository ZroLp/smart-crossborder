import Database from 'better-sqlite3';
import { ErrorHandler } from '@/lib/framework/error-handler';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { SharedContext } from '@/lib/framework/shared-context';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_shared_context_agent_key ON shared_context(agent_type, key);
    CREATE TABLE IF NOT EXISTS agent_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      task_id TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_agent_progress_task ON agent_progress(agent_type, task_id);
  `);
  return db;
}

describe('Agent Error Recovery in Chain', () => {
  let db: Database.Database;
  let errorHandler: ErrorHandler;
  let progressTracker: AgentProgressTracker;
  let sharedContext: SharedContext;

  beforeEach(() => {
    db = createTestDb();
    errorHandler = new ErrorHandler(db);
    progressTracker = new AgentProgressTracker(db);
    sharedContext = new SharedContext(db);
  });

  afterEach(() => {
    db.close();
  });

  test('when agent fails, scheduleRetry records it', () => {
    progressTracker.startTask('selection', 'task-error-1');
    progressTracker.startStep('selection', 'task-error-1', AgentStep.ModelReasoning);
    progressTracker.failStep('selection', 'task-error-1', AgentStep.ModelReasoning, 'network error');
    const classification = errorHandler.classifyError('network error');
    expect(classification.retryable).toBe(true);
    errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].agentType).toBe('selection');
    expect(tasks[0].taskName).toBe('fetchProducts');
    expect(tasks[0].retryCount).toBe(0);
  });

  test('getRetryTasks returns task when next_retry_at has passed', () => {
    errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].agentType).toBe('selection');
  });

  test('markRetried increments retryCount', () => {
    errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = errorHandler.getRetryTasks();
    const taskId = tasks[0].id;
    expect(tasks[0].retryCount).toBe(0);
    errorHandler.markRetried(taskId);
    const updated = errorHandler.getRetryTasks();
    expect(updated[0].retryCount).toBe(1);
    errorHandler.markRetried(taskId);
    const updated2 = errorHandler.getRetryTasks();
    expect(updated2[0].retryCount).toBe(2);
  });

  test('after max retries, task is no longer returned by getRetryTasks', () => {
    errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' }, 3);
    const tasks = errorHandler.getRetryTasks();
    const taskId = tasks[0].id;
    errorHandler.markRetried(taskId);
    errorHandler.markRetried(taskId);
    errorHandler.markRetried(taskId);
    const retryable = errorHandler.getRetryTasks();
    expect(retryable).toHaveLength(0);
  });

  test('removeRetryTask removes the record', () => {
    errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    errorHandler.removeRetryTask(tasks[0].id);
    const remaining = errorHandler.getRetryTasks();
    expect(remaining).toHaveLength(0);
  });

  test('error recovery scenario: fail → scheduleRetry → markRetried → retry again', () => {
    progressTracker.startTask('content', 'recovery-task-1');
    progressTracker.startStep('content', 'recovery-task-1', AgentStep.Execution);
    progressTracker.failStep('content', 'recovery-task-1', AgentStep.Execution, 'timeout');
    const errorType = errorHandler.classifyError('timeout');
    expect(errorType.retryable).toBe(true);
    errorHandler.scheduleRetry('content', 'generateListing', { productId: 123 }, 5);
    const tasks1 = errorHandler.getRetryTasks();
    expect(tasks1).toHaveLength(1);
    expect(tasks1[0].retryCount).toBe(0);
    const taskId = tasks1[0].id;
    errorHandler.markRetried(taskId);
    const tasks2 = errorHandler.getRetryTasks();
    expect(tasks2).toHaveLength(1);
    expect(tasks2[0].retryCount).toBe(1);
    progressTracker.retryTask('content', 'recovery-task-1');
    const progress = progressTracker.getProgress('content', 'recovery-task-1');
    const failedStep = progress!.steps.find((s) => s.step === AgentStep.Execution);
    expect(failedStep!.status).toBe('pending');
    errorHandler.markRetried(taskId);
    const tasks3 = errorHandler.getRetryTasks();
    expect(tasks3).toHaveLength(1);
    expect(tasks3[0].retryCount).toBe(2);
    errorHandler.markRetried(taskId);
    const tasks4 = errorHandler.getRetryTasks();
    expect(tasks4).toHaveLength(1);
    expect(tasks4[0].retryCount).toBe(3);
    errorHandler.markRetried(taskId);
    errorHandler.markRetried(taskId);
    const tasks5 = errorHandler.getRetryTasks();
    expect(tasks5).toHaveLength(0);
  });

  test('multiple agents have independent retry queues', () => {
    errorHandler.scheduleRetry('selection', 'taskA', {}, 3);
    errorHandler.scheduleRetry('content', 'taskB', {}, 3);
    errorHandler.scheduleRetry('fulfillment', 'taskC', {}, 3);
    const allTasks = errorHandler.getRetryTasks();
    expect(allTasks).toHaveLength(3);
    const selectionTasks = allTasks.filter((t) => t.agentType === 'selection');
    expect(selectionTasks).toHaveLength(1);
    expect(selectionTasks[0].taskName).toBe('taskA');
  });

  test('partial recovery: one task exhausted retries, another still retryable', () => {
    errorHandler.scheduleRetry('selection', 'exhausted', {}, 1);
    errorHandler.scheduleRetry('selection', 'still-retryable', {}, 3);
    const exhaustedTasks = errorHandler.getRetryTasks().filter((t) => t.taskName === 'exhausted');
    errorHandler.markRetried(exhaustedTasks[0].id);
    const remaining = errorHandler.getRetryTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].taskName).toBe('still-retryable');
  });
});
