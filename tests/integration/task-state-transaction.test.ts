import { initDatabase } from '@/lib/db/init';
import { commitTaskState } from '@/lib/db/task-state-transaction';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { createTask, transitionTask, terminateTask } from '@/lib/agents/task-service';

let db: ReturnType<typeof initDatabase>;
beforeEach(() => { db = initDatabase(':memory:'); });
afterEach(() => { db.close(); });

test('status and trigger history roll back when a later real SQLite progress insert fails', () => {
  const task = createTask('selection', {});
  const repo = new TaskLogRepository(db);
  db.exec("CREATE TRIGGER reject_progress BEFORE INSERT ON agent_progress BEGIN SELECT RAISE(ABORT, 'injected progress failure'); END");
  expect(() => commitTaskState(Number(task.taskId), 'running', tracker => {
    repo.updateStatus(Number(task.taskId), 'running');
    tracker.startTask('selection', task.taskId);
  })).toThrow('injected progress failure');
  expect(repo.findById(Number(task.taskId))!.status).toBe('pending');
  expect(repo.findEvents(Number(task.taskId))).toHaveLength(2);
  expect(repo.findEvents(Number(task.taskId))[1]).toEqual(expect.objectContaining({ from_status: 'pending', to_status: 'pending', error: expect.stringContaining('rolled back') }));
  expect(db.prepare('SELECT * FROM agent_progress').all()).toHaveLength(0);
});

test('termination progress failure rolls back task state and history and is visible to caller', () => {
  const task = createTask('selection', {});
  transitionTask(task.taskId, 'running');
  const tracker = new AgentProgressTracker(db);
  tracker.startTask('selection', task.taskId);
  tracker.startStep('selection', task.taskId, AgentStep.StrategyGeneration);
  db.exec("CREATE TRIGGER reject_progress_update BEFORE UPDATE ON agent_progress BEGIN SELECT RAISE(ABORT, 'injected termination failure'); END");
  expect(() => terminateTask(task.taskId)).toThrow('injected termination failure');
  const repo = new TaskLogRepository(db);
  expect(repo.findById(Number(task.taskId))!.status).toBe('running');
  expect(repo.findEvents(Number(task.taskId))).toHaveLength(3);
  expect(repo.findById(Number(task.taskId))!.error).toContain('rolled back');
  expect(tracker.getProgress('selection', task.taskId)!.steps.find(step => step.step === AgentStep.StrategyGeneration)!.status).toBe('running');
});

test('successful termination commits progress and event, and rejects a late success transition', () => {
  const task = createTask('selection', {});
  transitionTask(task.taskId, 'running');
  const tracker = new AgentProgressTracker(db);
  tracker.startTask('selection', task.taskId);
  tracker.startStep('selection', task.taskId, AgentStep.StrategyGeneration);
  terminateTask(task.taskId);
  expect(() => commitTaskState(Number(task.taskId), 'completed', current => current.completeStep('selection', task.taskId, AgentStep.StrategyGeneration))).toThrow();
  expect(new TaskLogRepository(db).findById(Number(task.taskId))!.status).toBe('terminated');
  expect(tracker.getProgress('selection', task.taskId)!.steps.find(step => step.step === AgentStep.StrategyGeneration)!.status).toBe('failed');
});
