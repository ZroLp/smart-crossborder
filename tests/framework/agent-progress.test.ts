import Database from 'better-sqlite3';
import { AgentProgressTracker, AgentStep, StepRecord, ProgressRecord } from '@/lib/framework/agent-progress';
import { SharedContext } from '@/lib/framework/shared-context';
import { MessageBus } from '@/lib/framework/message-bus';
import { BaseAgent } from '@/lib/framework/base-agent';
import { AgentResult, AgentType } from '@/lib/framework/types';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      task_id TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_agent_progress_task ON agent_progress(agent_type, task_id);

    CREATE TABLE IF NOT EXISTS shared_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_shared_context_agent_key ON shared_context(agent_type, key);
  `);
  return db;
}

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
  let db: Database.Database;
  let tracker: AgentProgressTracker;

  beforeEach(() => {
    db = createTestDb();
    tracker = new AgentProgressTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  test('startTask creates progress with 5 pending steps', () => {
    tracker.startTask('selection', 'task-1');
    const progress = tracker.getProgress('selection', 'task-1');

    expect(progress).not.toBeNull();
    expect(progress!.agentType).toBe('selection');
    expect(progress!.taskId).toBe('task-1');
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

  test('startStep marks step as running', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.DataCollection, { source: 'shopify' });

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);

    expect(step!.status).toBe('running');
    expect(step!.input).toEqual({ source: 'shopify' });

    const otherSteps = progress!.steps.filter((s) => s.step !== AgentStep.DataCollection);
    otherSteps.forEach((s) => {
      expect(s.status).toBe('pending');
    });
  });

  test('completeStep marks step as completed with duration', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.DataCollection);
    tracker.completeStep('selection', 'task-1', AgentStep.DataCollection, { products: 42 });

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);

    expect(step!.status).toBe('completed');
    expect(step!.output).toEqual({ products: 42 });
    expect(step!.duration).not.toBeNull();
    expect(step!.duration).toBeGreaterThanOrEqual(0);
  });

  test('failStep marks step as failed', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.ModelReasoning);
    tracker.failStep('selection', 'task-1', AgentStep.ModelReasoning, 'API timeout');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);

    expect(step!.status).toBe('failed');
    expect(step!.output).toEqual({ error: 'API timeout' });
    expect(step!.duration).not.toBeNull();
  });

  test('pauseTask marks running step as paused', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.Execution);
    tracker.pauseTask('selection', 'task-1');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('paused');
  });

  test('resumeTask resumes paused step', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.Execution);
    tracker.pauseTask('selection', 'task-1');
    tracker.resumeTask('selection', 'task-1');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('running');
  });

  test('terminateTask marks running and paused steps as failed', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.Execution);
    tracker.terminateTask('selection', 'task-1');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('failed');
  });

  test('terminateTask marks paused steps as failed', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.Execution);
    tracker.pauseTask('selection', 'task-1');
    tracker.terminateTask('selection', 'task-1');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.Execution);

    expect(step!.status).toBe('failed');
  });

  test('retryTask resets failed step to pending', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.ModelReasoning);
    tracker.failStep('selection', 'task-1', AgentStep.ModelReasoning, 'API error');
    tracker.retryTask('selection', 'task-1');

    const progress = tracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);

    expect(step!.status).toBe('pending');
    expect(step!.input).toBeNull();
    expect(step!.output).toBeNull();
    expect(step!.duration).toBeNull();
  });

  test('getProgress returns null for non-existent task', () => {
    const progress = tracker.getProgress('selection', 'non-existent');
    expect(progress).toBeNull();
  });

  test('getProgress returns correct record', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startStep('selection', 'task-1', AgentStep.DataCollection, { url: 'test' });
    tracker.completeStep('selection', 'task-1', AgentStep.DataCollection, { count: 10 });
    tracker.startStep('selection', 'task-1', AgentStep.ModelReasoning);

    const progress = tracker.getProgress('selection', 'task-1');

    expect(progress).not.toBeNull();
    expect(progress!.id).toBeGreaterThan(0);
    expect(progress!.agentType).toBe('selection');
    expect(progress!.taskId).toBe('task-1');
    expect(progress!.createdAt).toBeDefined();
    expect(progress!.updatedAt).toBeDefined();

    const dcStep = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(dcStep!.status).toBe('completed');
    expect(dcStep!.input).toEqual({ url: 'test' });
    expect(dcStep!.output).toEqual({ count: 10 });

    const mrStep = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);
    expect(mrStep!.status).toBe('running');
  });

  test('multiple tasks are isolated', () => {
    tracker.startTask('selection', 'task-1');
    tracker.startTask('content', 'task-2');

    tracker.startStep('selection', 'task-1', AgentStep.DataCollection);
    tracker.completeStep('selection', 'task-1', AgentStep.DataCollection, { data: 'yes' });

    const progress1 = tracker.getProgress('selection', 'task-1');
    const progress2 = tracker.getProgress('content', 'task-2');

    expect(progress1!.steps[0].status).toBe('completed');
    expect(progress2!.steps[0].status).toBe('pending');
  });
});

describe('BaseAgent progress tracking integration', () => {
  let db: Database.Database;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;
  let messageBus: MessageBus;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
    messageBus = new MessageBus();
  });

  afterEach(() => {
    db.close();
  });

  test('trackProgress creates progress record', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    agent.trackProgress('task-1');

    const progress = progressTracker.getProgress('selection', 'task-1');
    expect(progress).not.toBeNull();
    expect(progress!.steps).toHaveLength(5);
  });

  test('updateStep with start marks step as running', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    agent.trackProgress('task-1');
    agent.updateStep('task-1', AgentStep.DataCollection, 'start', { source: 'api' });

    const progress = progressTracker.getProgress('selection', 'task-1');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(step!.status).toBe('running');
    expect(step!.input).toEqual({ source: 'api' });
  });

  test('updateStep with complete marks step as completed', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    agent.trackProgress('task-2');
    agent.updateStep('task-2', AgentStep.DataCollection, 'start');
    agent.updateStep('task-2', AgentStep.DataCollection, 'complete', { items: 5 });

    const progress = progressTracker.getProgress('selection', 'task-2');
    const step = progress!.steps.find((s) => s.step === AgentStep.DataCollection);
    expect(step!.status).toBe('completed');
    expect(step!.output).toEqual({ items: 5 });
  });

  test('updateStep with fail marks step as failed', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext, progressTracker);
    agent.trackProgress('task-3');
    agent.updateStep('task-3', AgentStep.ModelReasoning, 'start');
    agent.updateStep('task-3', AgentStep.ModelReasoning, 'fail', { error: 'timeout' });

    const progress = progressTracker.getProgress('selection', 'task-3');
    const step = progress!.steps.find((s) => s.step === AgentStep.ModelReasoning);
    expect(step!.status).toBe('failed');
    expect(step!.output).toEqual({ error: 'timeout' });
  });

  test('trackProgress does nothing when no progressTracker', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    agent.trackProgress('task-1');

    const progress = progressTracker.getProgress('selection', 'task-1');
    expect(progress).toBeNull();
  });

  test('updateStep does nothing when no progressTracker', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    expect(() => {
      agent.updateStep('task-1', AgentStep.DataCollection, 'start');
    }).not.toThrow();
  });
});
