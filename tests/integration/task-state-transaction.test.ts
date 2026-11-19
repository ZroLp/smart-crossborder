import { initDatabase } from '@/lib/db/init';
import { commitTaskState } from '@/lib/db/task-state-transaction';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { createTask, transitionTask, terminateTask } from '@/lib/agents/task-service';
import { applyDbCompat } from '../helpers/db-compat';

let db: ReturnType<typeof initDatabase>;
// applyDbCompat 让嵌套 db.transaction 并入外层事务（pglite 测试池只有 1 个
// 连接，commitTaskState 外层事务 + tracker.protected 内层事务会死锁）。
beforeEach(() => { db = applyDbCompat(initDatabase(':memory:')); });
afterEach(async () => { await db.close(); });

test('status and trigger history roll back when a later real database progress insert fails', async () => {
  const task = await createTask('selection', {});
  const repo = new TaskLogRepository(db);
  // pglite 单语句语义：DDL 必须逐条 exec，多语句串会挂起。
  await db.exec(`CREATE OR REPLACE FUNCTION reject_progress_fn() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'injected progress failure'; END $$ LANGUAGE plpgsql;`);
  await db.exec('CREATE TRIGGER reject_progress BEFORE INSERT ON agent_progress FOR EACH ROW EXECUTE FUNCTION reject_progress_fn();');
  await expect(commitTaskState(Number(task.taskId), 'running', async tracker => {
    await repo.updateStatus(Number(task.taskId), 'running');
    await tracker.startTask('selection', task.taskId);
  })).rejects.toThrow('injected progress failure');
  expect((await repo.findById(Number(task.taskId)))!.status).toBe('pending');
  const events = await repo.findEvents(Number(task.taskId));
  expect(events).toHaveLength(2);
  expect(events[1]).toEqual(expect.objectContaining({ from_status: 'pending', to_status: 'pending', error: expect.stringContaining('rolled back') }));
  expect(await db.prepare('SELECT * FROM agent_progress').all()).toHaveLength(0);
});

test('termination progress failure rolls back task state and history and is visible to caller', async () => {
  const task = await createTask('selection', {});
  await transitionTask(task.taskId, 'running');
  const tracker = new AgentProgressTracker(db);
  await tracker.startTask('selection', task.taskId);
  await tracker.startStep('selection', task.taskId, AgentStep.StrategyGeneration);
  // pglite 单语句语义：DDL 必须逐条 exec，多语句串会挂起。
  await db.exec(`CREATE OR REPLACE FUNCTION reject_progress_update_fn() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'injected termination failure'; END $$ LANGUAGE plpgsql;`);
  await db.exec('CREATE TRIGGER reject_progress_update BEFORE UPDATE ON agent_progress FOR EACH ROW EXECUTE FUNCTION reject_progress_update_fn();');
  await expect(terminateTask(task.taskId)).rejects.toThrow('injected termination failure');
  const repo = new TaskLogRepository(db);
  expect((await repo.findById(Number(task.taskId)))!.status).toBe('running');
  expect(await repo.findEvents(Number(task.taskId))).toHaveLength(3);
  expect((await repo.findById(Number(task.taskId)))!.error).toContain('rolled back');
  expect((await tracker.getProgress('selection', task.taskId))!.steps.find(step => step.step === AgentStep.StrategyGeneration)!.status).toBe('running');
});

test('successful termination commits progress and event, and rejects a late success transition', async () => {
  const task = await createTask('selection', {});
  await transitionTask(task.taskId, 'running');
  const tracker = new AgentProgressTracker(db);
  await tracker.startTask('selection', task.taskId);
  await tracker.startStep('selection', task.taskId, AgentStep.StrategyGeneration);
  await terminateTask(task.taskId);
  await expect(commitTaskState(Number(task.taskId), 'completed', async current => {
    await current.completeStep('selection', task.taskId, AgentStep.StrategyGeneration);
  })).rejects.toThrow();
  expect((await new TaskLogRepository(db).findById(Number(task.taskId)))!.status).toBe('terminated');
  expect((await tracker.getProgress('selection', task.taskId))!.steps.find(step => step.step === AgentStep.StrategyGeneration)!.status).toBe('failed');
});
