﻿import { initDatabase } from '@/lib/db/init';
import { ErrorHandler } from '@/lib/framework/error-handler';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { SharedContext } from '@/lib/framework/shared-context';

// taskId 用数字字符串：AgentProgressTracker.isStopped 以 task_logs.id
// (BIGINT) 查询，非数字 taskId 在 Postgres 下会使所有进度写操作抛错
// （lib 层迁移残留缺陷，见 tests/framework/agent-progress.test.ts 说明）。

describe('Agent Error Recovery in Chain', () => {
  let db: ReturnType<typeof initDatabase>;
  let errorHandler: ErrorHandler;
  let progressTracker: AgentProgressTracker;
  let sharedContext: SharedContext;

  beforeEach(() => {
    db = initDatabase(':memory:');
    errorHandler = new ErrorHandler(db);
    progressTracker = new AgentProgressTracker(db);
    sharedContext = new SharedContext(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('when agent fails, scheduleRetry records it', async () => {
    await progressTracker.startTask('selection', '1');
    await progressTracker.startStep('selection', '1', AgentStep.ModelReasoning);
    await progressTracker.failStep('selection', '1', AgentStep.ModelReasoning, 'network error');
    const classification = errorHandler.classifyError('network error');
    expect(classification.retryable).toBe(true);
    await errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = await errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].agentType).toBe('selection');
    expect(tasks[0].taskName).toBe('fetchProducts');
    expect(tasks[0].retryCount).toBe(0);
  });

  test('getRetryTasks returns task when next_retry_at has passed', async () => {
    await errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = await errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].agentType).toBe('selection');
  });

  test('markRetried increments retryCount', async () => {
    await errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = await errorHandler.getRetryTasks();
    const taskId = tasks[0].id;
    expect(tasks[0].retryCount).toBe(0);
    await errorHandler.markRetried(taskId);
    const updated = await errorHandler.getRetryTasks();
    expect(updated[0].retryCount).toBe(1);
    await errorHandler.markRetried(taskId);
    const updated2 = await errorHandler.getRetryTasks();
    expect(updated2[0].retryCount).toBe(2);
  });

  test('after max retries, task is no longer returned by getRetryTasks', async () => {
    await errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' }, 3);
    const tasks = await errorHandler.getRetryTasks();
    const taskId = tasks[0].id;
    await errorHandler.markRetried(taskId);
    await errorHandler.markRetried(taskId);
    await errorHandler.markRetried(taskId);
    const retryable = await errorHandler.getRetryTasks();
    expect(retryable).toHaveLength(0);
  });

  test('removeRetryTask removes the record', async () => {
    await errorHandler.scheduleRetry('selection', 'fetchProducts', { query: 'shoes' });
    const tasks = await errorHandler.getRetryTasks();
    expect(tasks).toHaveLength(1);
    await errorHandler.removeRetryTask(tasks[0].id);
    const remaining = await errorHandler.getRetryTasks();
    expect(remaining).toHaveLength(0);
  });

  test('error recovery scenario: fail → scheduleRetry → markRetried → retry again', async () => {
    await progressTracker.startTask('content', '2');
    await progressTracker.startStep('content', '2', AgentStep.Execution);
    await progressTracker.failStep('content', '2', AgentStep.Execution, 'timeout');
    const errorType = errorHandler.classifyError('timeout');
    expect(errorType.retryable).toBe(true);
    await errorHandler.scheduleRetry('content', 'generateListing', { productId: 123 }, 5);
    const tasks1 = await errorHandler.getRetryTasks();
    expect(tasks1).toHaveLength(1);
    expect(tasks1[0].retryCount).toBe(0);
    const taskId = tasks1[0].id;
    await errorHandler.markRetried(taskId);
    const tasks2 = await errorHandler.getRetryTasks();
    expect(tasks2).toHaveLength(1);
    expect(tasks2[0].retryCount).toBe(1);
    await progressTracker.retryTask('content', '2');
    const progress = await progressTracker.getProgress('content', '2');
    const failedStep = progress!.steps.find((s) => s.step === AgentStep.Execution);
    expect(failedStep!.status).toBe('pending');
    await errorHandler.markRetried(taskId);
    const tasks3 = await errorHandler.getRetryTasks();
    expect(tasks3).toHaveLength(1);
    expect(tasks3[0].retryCount).toBe(2);
    await errorHandler.markRetried(taskId);
    const tasks4 = await errorHandler.getRetryTasks();
    expect(tasks4).toHaveLength(1);
    expect(tasks4[0].retryCount).toBe(3);
    await errorHandler.markRetried(taskId);
    await errorHandler.markRetried(taskId);
    const tasks5 = await errorHandler.getRetryTasks();
    expect(tasks5).toHaveLength(0);
  });

  test('multiple agents have independent retry queues', async () => {
    await errorHandler.scheduleRetry('selection', 'taskA', {}, 3);
    await errorHandler.scheduleRetry('content', 'taskB', {}, 3);
    await errorHandler.scheduleRetry('fulfillment', 'taskC', {}, 3);
    const allTasks = await errorHandler.getRetryTasks();
    expect(allTasks).toHaveLength(3);
    const selectionTasks = allTasks.filter((t) => t.agentType === 'selection');
    expect(selectionTasks).toHaveLength(1);
    expect(selectionTasks[0].taskName).toBe('taskA');
  });

  test('partial recovery: one task exhausted retries, another still retryable', async () => {
    await errorHandler.scheduleRetry('selection', 'exhausted', {}, 1);
    await errorHandler.scheduleRetry('selection', 'still-retryable', {}, 3);
    const exhaustedTasks = (await errorHandler.getRetryTasks()).filter((t) => t.taskName === 'exhausted');
    await errorHandler.markRetried(exhaustedTasks[0].id);
    const remaining = await errorHandler.getRetryTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].taskName).toBe('still-retryable');
  });
});
