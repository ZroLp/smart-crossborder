import { AsyncLocalStorage } from 'node:async_hooks';
import { SharedContext } from './shared-context';
import { AgentProgressTracker } from './agent-progress';
import { getDb } from '../db/init';
export interface TaskRuntime { taskId: string; context: SharedContext; tracker: AgentProgressTracker; signal: AbortSignal; isActive: () => boolean }
export const taskRuntime = new AsyncLocalStorage<TaskRuntime>();
export function withTaskRuntime<T>(taskId: string, signal: AbortSignal, work: () => T): T {
  const db = getDb();
  return taskRuntime.run({ taskId, signal, context: new SharedContext(db, taskId), tracker: new AgentProgressTracker(db), isActive: () => {
    const task = db.prepare('SELECT status FROM task_logs WHERE id=?').get(taskId) as { status: string } | undefined;
    return !signal.aborted && (!task || task.status === 'running' || task.status === 'pending');
  } }, work);
}
