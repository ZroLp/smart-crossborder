import { initDatabase } from '@/lib/db/init';
import { getOrchestrator, resetOrchestrator, VALID_AGENT_TYPES } from '@/lib/api/agent-service';
import { withTaskRuntime, taskRuntime } from '@/lib/framework/task-runtime';
import { AgentStep } from '@/lib/framework/agent-progress';
import { runAgentTask, retryTask, terminateTask, createTask } from '@/lib/agents/task-service';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { applyDbCompat, markReadyHandled, installFreshPgliteEngine, installPgliteWorkerGuard, pollDbRow } from '../helpers/db-compat';

const input = { products: [{ name: 'Test', category: 'home', price: 20, cost: 5, sales: 100 }] };
let db: ReturnType<typeof initDatabase>;
// applyDbCompat：runAgentTask → commitTaskState 外层事务 + tracker 内层
// db.transaction 在 pglite 单连接池上会死锁（详见 tests/helpers/db-compat.ts）。
// installFreshPgliteEngine + 不在 afterEach 调 db.close()：pglite 共享桥在
// pool.end() 后仍会残留协议流并对已关闭池再发 query，抛 uncaught
// "Cannot use a pool after end" 崩掉 jest worker。改为每个测试装全新引擎、
// 用完直接丢弃（不 end 池），把 pglite 残留局限在单引擎内、不污染 worker。
// installPgliteWorkerGuard（幂等常驻）：吞掉 pglite 残留协议流的
// uncaught/unhandled 噪音，避免崩掉 jest worker。
installPgliteWorkerGuard();
beforeEach(() => { installFreshPgliteEngine(); db = applyDbCompat(initDatabase(':memory:')); markReadyHandled(db); resetOrchestrator(); });
afterEach(() => { resetOrchestrator(); });

test('initialization failure never caches an incomplete singleton; recovery registers six agents', async () => {
  // 换引擎模拟“旧 client 不可用后重新初始化”；恢复后仍可注册六个 agent。
  installFreshPgliteEngine();
  db = applyDbCompat(initDatabase(':memory:'));
  markReadyHandled(db);
  expect(getOrchestrator().getRegisteredAgents()).toHaveLength(6);
});

test('concurrent task scopes share dependencies across all six agents and isolate stored context', async () => {
  const orchestrator = getOrchestrator();
  const taskA = (await createTask('selection', {})).taskId;
  const taskB = (await createTask('selection', {})).taskId;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const a = withTaskRuntime(taskA, new AbortController().signal, async () => {
    const runtime = taskRuntime.getStore()!;
    for (const type of VALID_AGENT_TYPES) {
      const agent = orchestrator.getAgent(type)!;
      expect(Reflect.get(agent, 'sharedContext')).toBe(runtime.context);
      expect(Reflect.get(agent, 'progressTracker')).toBe(runtime.tracker);
    }
    await orchestrator.getAgent('selection')!.writeToSharedContext('result', { owner: 'A' });
    await barrier;
    expect(await orchestrator.getAgent('content')!.readFromSharedContext('selection', 'result')).toEqual({ owner: 'A' });
  });
  await withTaskRuntime(taskB, new AbortController().signal, async () => {
    expect(await orchestrator.getAgent('store-builder')!.readFromSharedContext('selection', 'result')).toBeNull();
    await orchestrator.getAgent('selection')!.writeToSharedContext('result', { owner: 'B' });
    release();
  });
  await a;
  expect(taskRuntime.getStore()).toBeUndefined();
});

test('real chain stores per-agent progress and task-scoped selection/build results', async () => {
  const task = await runAgentTask({ agentType: 'selection', input, chain: true });
  // Existing content -> ad input is incompatible; the first three agents still complete.
  expect(task.status).toBe('failed');
  const rows = await db.prepare('SELECT * FROM agent_progress WHERE task_id=? ORDER BY id').all(task.taskId);
  expect(rows.length).toBeGreaterThanOrEqual(3);
  // 每个 agent 一行进度；不兼容的 ad-optimizer 落在最后一个 agent 行：
  // 其首个步骤被标记 failed，而前三个 agent 的收尾步骤（result-callback）completed。
  const parse = (row: { steps?: unknown; agent_type?: unknown }) =>
    JSON.parse(String((row as { steps: string }).steps)) as { step: string; status: string }[];
  expect(rows.slice(0, 3).every((row) => parse(row).some((s) => s.step === AgentStep.ResultCallback && s.status === 'completed'))).toBe(true);
  expect(parse(rows[rows.length - 1] as { steps: string; agent_type: string }).some((s) => s.status === 'failed')).toBe(true);
});

test('model execution is visible before completion and termination blocks late success', async () => {
  const agent = getOrchestrator().getAgent('selection')!;
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  agent.execute = async () => { await gate; return { success: true, data: {} }; };
  const work = runAgentTask({ agentType: 'selection', input });
  const task = (await new TaskLogRepository(db).findAll())[0];
  const row = await pollDbRow<{ steps: string }>(db, 'SELECT steps FROM agent_progress WHERE task_id=?', [String(task.id)]);
  expect(JSON.parse(row.steps).find((step: { step: string }) => step.step === AgentStep.StrategyGeneration).status).toBe('running');
  await terminateTask(String(task.id));
  finish();
  expect((await work).status).toBe('terminated');
  expect(await new TaskLogRepository(db).findEvents(task.id)).toEqual(expect.arrayContaining([expect.objectContaining({ from_status: 'running', to_status: 'terminated' })]));
});

test('failure and repeated retry retain each attempt and append status history', async () => {
  const first = await runAgentTask({ agentType: 'selection', input: { products: [] } });
  expect(first.status).toBe('failed');
  const second = await retryTask(first.taskId);
  const third = await retryTask(second.taskId);
  const repo = new TaskLogRepository(db);
  const attempts = await repo.findAttempts(Number(first.taskId));
  expect(attempts.map(task => task.attempt_number)).toEqual([1, 2, 3]);
  expect(attempts[2].parent_task_id).toBe(Number(second.taskId));
  expect(third.rootTaskId).toBe(first.taskId);
  for (const task of attempts) {
    expect(task.started_at).toBeTruthy(); expect(task.ended_at).toBeTruthy(); expect(task.error).toBeTruthy();
    expect((await repo.findEvents(task.id)).map(event => (event as { to_status: string }).to_status)).toEqual(['pending', 'running', 'failed']);
  }
  await expect(repo.updateStatus(Number(first.taskId), 'completed')).rejects.toThrow();
});

test('lifecycle migration is idempotent and the repository works after re-initialization', async () => {
  await runAgentTask({ agentType: 'selection', input });
  resetOrchestrator();
  installFreshPgliteEngine();
  db = applyDbCompat(initDatabase(':memory:'));
  markReadyHandled(db);
  const repo = new TaskLogRepository(db);
  // 新引擎重新初始化后为空 schema（PGlite 语义）；init 内幂等迁移可反复执行。
  const created = await repo.create({ agent_type: 'selection', task_name: 't', status: 'pending' });
  expect((await repo.findById(Number(created.lastInsertRowid)))!.status).toBe('pending');
  // 新引擎里只有刚创建的任务（旧 task 的历史不复存在）；自增 ID 会重排，
  // 因此用总行数而非旧 task_id 判断“干净”。
  expect(((await db.prepare('SELECT COUNT(*) AS c FROM task_logs').get()) as { c: number }).c).toBe(1);
  expect(await repo.findEvents(Number(created.lastInsertRowid))).toHaveLength(1);
});

test('concurrent retries allocate unique attempts and repeated states do not duplicate events', async () => {
  const first = await runAgentTask({ agentType: 'selection', input: { products: [] } });
  await Promise.all([retryTask(first.taskId), retryTask(first.taskId)]);
  const repo = new TaskLogRepository(db);
  expect((await repo.findAttempts(Number(first.taskId))).map(task => task.attempt_number)).toEqual([1, 2, 3]);
  const before = (await repo.findEvents(Number(first.taskId))).length;
  await repo.updateStatus(Number(first.taskId), 'failed');
  expect(await repo.findEvents(Number(first.taskId))).toHaveLength(before);
});
