import { AsyncLocalStorage } from 'node:async_hooks';
import { SharedContext } from './shared-context';
import { AgentProgressTracker } from './agent-progress';
import { getDb } from '../db/init';
export interface TaskRuntime { taskId: string; context: SharedContext; tracker: AgentProgressTracker; signal: AbortSignal; persistenceError?: Error; isActive: () => boolean }
export const taskRuntime = new AsyncLocalStorage<TaskRuntime>();
export const agentDispatch = new AsyncLocalStorage<string>();
export const standaloneExecution = new AsyncLocalStorage<boolean>();
export function withStandaloneExecution<T>(work: () => T): T {
  if (taskRuntime.getStore()) throw new Error('Standalone execution cannot bypass a task runtime');
  return standaloneExecution.run(true, work);
}
export function withTaskRuntime<T>(taskId: string, signal: AbortSignal, work: () => T): T {
  if (!taskId?.trim()) throw new Error('taskId is required');
  const db = getDb();
  if (!db.prepare('SELECT id FROM task_logs WHERE id=?').get(taskId)) throw new Error('Unknown taskId: ' + taskId);
  const runtime: TaskRuntime = { taskId, signal, context: new SharedContext(db, taskId), tracker: new AgentProgressTracker(db, error => { runtime.persistenceError ??= error; }), isActive: () => {
    const task = db.prepare('SELECT status FROM task_logs WHERE id=?').get(taskId) as { status: string } | undefined;
    return !signal.aborted && !!task && (task.status === 'running' || task.status === 'pending');
  } };
  return taskRuntime.run(runtime, work);
}
