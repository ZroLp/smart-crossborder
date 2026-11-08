import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initDatabase } from '@/lib/db/init';
import { getOrchestrator, resetOrchestrator, VALID_AGENT_TYPES } from '@/lib/api/agent-service';
import { withTaskRuntime, taskRuntime } from '@/lib/framework/task-runtime';
import { AgentStep } from '@/lib/framework/agent-progress';
import { runAgentTask, retryTask, terminateTask, createTask } from '@/lib/agents/task-service';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { migrateTaskLifecycle } from '@/lib/db/migrations/task-lifecycle';

const input = { products: [{ name: 'Test', category: 'home', price: 20, cost: 5, sales: 100 }] };
let db: ReturnType<typeof initDatabase>;
beforeEach(() => { db = initDatabase(':memory:'); resetOrchestrator(); });
afterEach(() => { resetOrchestrator(); if (db.open) db.close(); });

test('initialization failure never caches an incomplete singleton; recovery registers six agents', () => {
  db.close();
  expect(() => getOrchestrator()).toThrow();
  db = initDatabase(':memory:');
  expect(getOrchestrator().getRegisteredAgents()).toHaveLength(6);
});

test('concurrent task scopes share dependencies across all six agents and isolate stored context', async () => {
  const orchestrator = getOrchestrator();
  const taskA = createTask('selection', {}).taskId;
  const taskB = createTask('selection', {}).taskId;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const a = withTaskRuntime(taskA, new AbortController().signal, async () => {
    const runtime = taskRuntime.getStore()!;
    for (const type of VALID_AGENT_TYPES) {
      const agent = orchestrator.getAgent(type)!;
      expect(Reflect.get(agent, 'sharedContext')).toBe(runtime.context);
      expect(Reflect.get(agent, 'progressTracker')).toBe(runtime.tracker);
    }
    orchestrator.getAgent('selection')!.writeToSharedContext('result', { owner: 'A' });
    await barrier;
    expect(orchestrator.getAgent('content')!.readFromSharedContext('selection', 'result')).toEqual({ owner: 'A' });
  });
  await withTaskRuntime(taskB, new AbortController().signal, async () => {
    expect(orchestrator.getAgent('store-builder')!.readFromSharedContext('selection', 'result')).toBeNull();
    orchestrator.getAgent('selection')!.writeToSharedContext('result', { owner: 'B' });
    release();
  });
  await a;
  expect(taskRuntime.getStore()).toBeUndefined();
});

test('real chain stores per-agent progress and task-scoped selection/build results', async () => {
  const task = await runAgentTask({ agentType: 'selection', input, chain: true });
  // Existing content -> ad input is incompatible; the first three agents still complete.
  expect(task.status).toBe('failed');
  const rows = db.prepare('SELECT * FROM agent_progress WHERE task_id=? ORDER BY id').all(task.taskId) as { steps: string }[];
  expect(rows.length).toBeGreaterThanOrEqual(3);
  expect(rows.slice(0, 3).every(row => JSON.parse(row.steps).every((step: { step: string; status: string }) => step.status === ([AgentStep.ModelReasoning, AgentStep.Execution].includes(step.step as AgentStep) ? 'pending' : 'completed')))).toBe(true);
});

test('model execution is visible before completion and termination blocks late success', async () => {
  const agent = getOrchestrator().getAgent('selection')!;
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  agent.execute = async () => { await gate; return { success: true, data: {} }; };
  const work = runAgentTask({ agentType: 'selection', input });
  const task = new TaskLogRepository(db).findAll()[0];
  const row = db.prepare('SELECT steps FROM agent_progress WHERE task_id=?').get(String(task.id)) as { steps: string };
  expect(JSON.parse(row.steps).find((step: { step: string }) => step.step === AgentStep.StrategyGeneration).status).toBe('running');
  terminateTask(String(task.id));
  finish();
  expect((await work).status).toBe('terminated');
  expect(new TaskLogRepository(db).findEvents(task.id)).toEqual(expect.arrayContaining([expect.objectContaining({ from_status: 'running', to_status: 'terminated' })]));
});

test('failure and repeated retry retain each attempt and append status history', async () => {
  const first = await runAgentTask({ agentType: 'selection', input: { products: [] } });
  expect(first.status).toBe('failed');
  const second = await retryTask(first.taskId);
  const third = await retryTask(second.taskId);
  const repo = new TaskLogRepository(db);
  const attempts = repo.findAttempts(Number(first.taskId));
  expect(attempts.map(task => task.attempt_number)).toEqual([1, 2, 3]);
  expect(attempts[2].parent_task_id).toBe(Number(second.taskId));
  expect(third.rootTaskId).toBe(first.taskId);
  for (const task of attempts) {
    expect(task.started_at).toBeTruthy(); expect(task.ended_at).toBeTruthy(); expect(task.error).toBeTruthy();
    expect(repo.findEvents(task.id).map(event => (event as { to_status: string }).to_status)).toEqual(['pending', 'running', 'failed']);
  }
  expect(() => repo.updateStatus(Number(first.taskId), 'completed')).toThrow();
});

test('file-backed SQLite history survives close/reopen and migration is idempotent', async () => {
  db.close();
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-lifecycle-'));
  try {
    const filename = path.join(dir, 'test.sqlite');
    db = initDatabase(filename);
    resetOrchestrator();
    const task = await runAgentTask({ agentType: 'selection', input });
    db.close(); resetOrchestrator(); db = initDatabase(filename);
    migrateTaskLifecycle(db);
    const repo = new TaskLogRepository(db);
    expect(repo.findById(Number(task.taskId))!.status).toBe('completed');
    expect(repo.findEvents(Number(task.taskId))).toHaveLength(3);
    expect(db.prepare('SELECT steps FROM agent_progress WHERE task_id=?').get(task.taskId)).toBeTruthy();
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('concurrent retries allocate unique attempts and repeated states do not duplicate events', async () => {
  const first = await runAgentTask({ agentType: 'selection', input: { products: [] } });
  await Promise.all([retryTask(first.taskId), retryTask(first.taskId)]);
  const repo = new TaskLogRepository(db);
  expect(repo.findAttempts(Number(first.taskId)).map(task => task.attempt_number)).toEqual([1, 2, 3]);
  const before = repo.findEvents(Number(first.taskId)).length;
  repo.updateStatus(Number(first.taskId), 'failed');
  expect(repo.findEvents(Number(first.taskId))).toHaveLength(before);
});
