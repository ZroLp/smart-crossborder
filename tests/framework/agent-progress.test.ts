import { initDatabase } from '@/lib/db/init';
import { DbClient } from '@/lib/db/client';
import { AgentProgressTracker, AgentStep, StepRecord, ProgressRecord } from '@/lib/framework/agent-progress';
import { SharedContext } from '@/lib/framework/shared-context';
import { MessageBus } from '@/lib/framework/message-bus';
import { BaseAgent } from '@/lib/framework/base-agent';
import { AgentResult, AgentType } from '@/lib/framework/types';

/**
 * 本文件所有 taskId 用数字字符串（'1'/'2'/'3'）而非 'task-1' 这类：
 * AgentProgressTracker.isStopped 内部执行
 * `SELECT status FROM task_logs WHERE id = ?`（taskId 作为 task_logs 的
 * BIGINT 主键查询），非数字 taskId 在 Postgres 下会直接抛
 * "invalid input syntax for type bigint"，导致所有进度写操作失败。
 * （这是 lib/framework/agent-progress.ts 的迁移残留缺陷，见任务报告；
 * 真实任务 ID 若为数字则不受影响。）
 */

class TestAgent extends BaseAgent {
  constructor(type: AgentType, messageBus: MessageBus, sharedContext: SharedContext, progressTracker?: AgentProgressTracker) {
    super({ name: `Test ${type}`, type, description: 'Test' }, messageBus, sharedContext, progressTracker);
  }

  async execute(): Promise<AgentResult> {
    return { success: true, data: {} };
  }

  validate(): boolean {
    return true;
  }
}

describe('AgentProgressTracker', () => {
  let db: DbClient;
  let tracker: AgentProgressTracker;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    tracker = new AgentProgressTracker(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('startTask creates progress with 5 pending steps', async () => {
    await tracker.startTask('selection', '1');
    const progress = await tracker.getProgress('selection', '1');

    expect(progress).not.toBeNull();
    expect(progress!.agentType).toBe('selection');
    expect(progress!.taskId).toBe('1');
    expect(progress!.steps).toHaveLength(5);

    const stepNames = progress!.steps.map((s) => s.step);
    expect(stepNames).toEqual([
      AgentStep.DataCollection,
      AgentStep.ModelReasoning,
      AgentStep.StrategyGeneration,
      AgentStep.Execution,
      AgentStep.ResultCallback,
    ]);

    progress!.steps.forEach((s) => {
      expect(s.status).toBe('pending');
      expect(s.input).toBeNull();
      expect(s.output).toBeNull();
      expect(s.duration).toBeNull();
    });
  });

  test('startStep marks step as running', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.DataCollection, { source: 'shopify' });

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);

    expect(step!.status).toBe('running');
    expect(step!.input).toEqual({ source: 'shopify' });

    const otherSteps = progress!.steps.filter((s) => s.step !== AgentStep.DataCollection);
    otherSteps.forEach((s) => {
      expect(s.status).toBe('pending');
    });
  });

  test('completeStep marks step as completed with duration', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.DataCollection);
    await tracker.completeStep('selection', '1', AgentStep.DataCollection, { products: 42 });

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);

    expect(step!.status).toBe('completed');
    expect(step!.output).toEqual({ products: 42 });
    expect(step!.duration).not.toBeNull();
    expect(step!.duration).toBeGreaterThanOrEqual(0);
  });

  test('failStep marks step as failed', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.ModelReasoning);
    await tracker.failStep('selection', '1', AgentStep.ModelReasoning, 'API timeout');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);

    expect(step!.status).toBe('failed');
    expect(step!.output).toEqual({ error: 'API timeout' });
    expect(step!.duration).not.toBeNull();
  });

  test('pauseTask marks running step as paused', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.Execution);
    await tracker.pauseTask('selection', '1');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('paused');
  });

  test('resumeTask resumes paused step', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.Execution);
    await tracker.pauseTask('selection', '1');
    await tracker.resumeTask('selection', '1');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('running');
  });

  test('terminateTask marks running and paused steps as failed', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.Execution);
    await tracker.terminateTask('selection', '1');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('failed');
  });

  test('terminateTask marks paused steps as failed', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.Execution);
    await tracker.pauseTask('selection', '1');
    await tracker.terminateTask('selection', '1');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('failed');
  });

  test('retryTask resets failed step to pending', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.ModelReasoning);
    await tracker.failStep('selection', '1', AgentStep.ModelReasoning, 'API error');
    await tracker.retryTask('selection', '1');

    const progress = await tracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);

    expect(step!.status).toBe('pending');
    expect(step!.input).toBeNull();
    expect(step!.output).toBeNull();
    expect(step!.duration).toBeNull();
  });

  test('getProgress returns null for non-existent task', async () => {
    const progress = await tracker.getProgress('selection', '999999');
    expect(progress).toBeNull();
  });

  test('getProgress returns correct record', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startStep('selection', '1', AgentStep.DataCollection, { url: 'test' });
    await tracker.completeStep('selection', '1', AgentStep.DataCollection, { count: 10 });
    await tracker.startStep('selection', '1', AgentStep.ModelReasoning);

    const progress = await tracker.getProgress('selection', '1');

    expect(progress).not.toBeNull();
    expect(progress!.id).toBeGreaterThan(0);
    expect(progress!.agentType).toBe('selection');
    expect(progress!.taskId).toBe('1');
    expect(progress!.createdAt).toBeDefined();
    expect(progress!.updatedAt).toBeDefined();

    const dcStep = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(dcStep!.status).toBe('completed');
    expect(dcStep!.input).toEqual({ url: 'test' });
    expect(dcStep!.output).toEqual({ count: 10 });

    const mrStep = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);
    expect(mrStep!.status).toBe('running');
  });

  test('multiple tasks are isolated', async () => {
    await tracker.startTask('selection', '1');
    await tracker.startTask('content', '2');

    await tracker.startStep('selection', '1', AgentStep.DataCollection);
    await tracker.completeStep('selection', '1', AgentStep.DataCollection, { data: 'yes' });

    const progress1 = await tracker.getProgress('selection', '1');
    const progress2 = await tracker.getProgress('content', '2');

    expect(progress1!.steps[0].status).toBe('completed');
    expect(progress2!.steps[0].status).toBe('pending');
  });
});

describe('BaseAgent progress tracking integration', () => {
  let db: DbClient;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;
  let messageBus: MessageBus;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
    messageBus = new MessageBus();
  });

  afterEach(async () => {
    await db.close();
  });

  test('trackProgress creates progress record', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    await agent.trackProgress('1');

    const progress = await progressTracker.getProgress('selection', '1');
    expect(progress).not.toBeNull();
    expect(progress!.steps).toHaveLength(5);
  });

  test('updateStep with start marks step as running', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    await agent.trackProgress('1');
    await agent.updateStep('1', AgentStep.DataCollection, 'start', { source: 'api' });

    const progress = await progressTracker.getProgress('selection', '1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(step!.status).toBe('running');
    expect(step!.input).toEqual({ source: 'api' });
  });

  test('updateStep with complete marks step as completed', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    await agent.trackProgress('2');
    await agent.updateStep('2', AgentStep.DataCollection, 'start');
    await agent.updateStep('2', AgentStep.DataCollection, 'complete', { items: 5 });

    const progress = await progressTracker.getProgress('selection', '2');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(step!.status).toBe('completed');
    expect(step!.output).toEqual({ items: 5 });
  });

  test('updateStep with fail marks step as failed', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    await agent.trackProgress('3');
    await agent.updateStep('3', AgentStep.ModelReasoning, 'start');
    await agent.updateStep('3', AgentStep.ModelReasoning, 'fail', { error: 'timeout' });

    const progress = await progressTracker.getProgress('selection', '3');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);
    expect(step!.status).toBe('failed');
    expect(step!.output).toEqual({ error: 'timeout' });
  });

  test('trackProgress does nothing when no progressTracker', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    await agent.trackProgress('1');

    const progress = await progressTracker.getProgress('selection', '1');
    expect(progress).toBeNull();
  });

  test('updateStep does nothing when no progressTracker', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    expect(async () => {
      await agent.updateStep('1', AgentStep.DataCollection, 'start');
    }).not.toThrow();
  });
});

