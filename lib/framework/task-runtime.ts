import { AsyncLocalStorage } from 'node:async_hooks';
import { SharedContext } from './shared-context';
import { AgentProgressTracker } from './agent-progress';
import { getDb } from '../db/init';
import { DbClient } from '../db/client';
export interface TaskRuntime { taskId: string; context: SharedContext; tracker: AgentProgressTracker; signal: AbortSignal; persistenceError?: Error; isActive: () => boolean }
export const taskRuntime = new AsyncLocalStorage<TaskRuntime>();
export const agentDispatch = new AsyncLocalStorage<string>();
export const standaloneExecution = new AsyncLocalStorage<boolean>();
export async function withStandaloneExecution<T>(work: () => T | Promise<T>): Promise<T> {
  if (taskRuntime.getStore()) throw new Error('Standalone execution cannot bypass a task runtime');
  return standaloneExecution.run(true, async () => work());
}
export async function withTaskRuntime<T>(taskId: string, signal: AbortSignal, work: () => T | Promise<T>): Promise<T> {
  if (!taskId?.trim()) throw new Error('taskId is required');
  const db = getDb();
  const exists = await db.prepare('SELECT id FROM task_logs WHERE id=?').get(taskId);
  if (!exists) throw new Error('Unknown taskId: ' + taskId);
  const runtime: TaskRuntime = { taskId, signal, context: new SharedContext(db, taskId), tracker: new AgentProgressTracker(db, error => { runtime.persistenceError ??= error; }), isActive: () => {
    return taskStatusCheck(db, taskId, signal);
  } };
  return taskRuntime.run(runtime, async () => work());
}

/** 状态检查是异步的；isActive 保持同步签名，读最近一次已知状态需要异步场景请 await `taskStatus` 助手。 */
function taskStatusCheck(db: DbClient, taskId: string, signal: AbortSignal): boolean {
  // 同步近似：仅检查本地中止信号；DB 状态由调用方在异步边界处 await isTaskActive 校验。
  return !signal.aborted;
}

export async function isTaskActive(db: DbClient, taskId: string, signal: AbortSignal): Promise<boolean> {
  const task = await db.prepare('SELECT status FROM task_logs WHERE id=?').get(taskId) as { status: string } | undefined;
  return !signal.aborted && !!task && (task.status === 'running' || task.status === 'pending');
}
