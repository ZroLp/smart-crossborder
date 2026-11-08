import { taskRuntime } from '../framework/task-runtime';
import { getDb } from './init';
import { TaskLogRepository } from './task-log-repository';
import { AgentProgressTracker } from '../framework/agent-progress';
import { TaskStatus } from '../framework/types';

/** Status, event trigger and progress changes commit or roll back together. */
export function commitTaskState(
  taskId: number,
  status: TaskStatus,
  updateProgress: (tracker: AgentProgressTracker) => void,
  patch: { output?: string; error?: string } = {},
): void {
  const db = getDb();
  try {
    db.transaction(() => {
      const runtime = taskRuntime.getStore();
      updateProgress(runtime?.taskId === String(taskId) ? runtime.tracker : new AgentProgressTracker(db));
      new TaskLogRepository(db).updateStatus(taskId, status, patch.output, patch.error);
    }).immediate();
  } catch (error) {
    const message = 'State/progress transaction rolled back: ' + (error instanceof Error ? error.message : String(error));
    try {
      db.transaction(() => {
        db.prepare("UPDATE task_logs SET error=? WHERE id=? AND status IN ('pending','running','paused')").run(message, taskId);
        db.prepare('INSERT INTO task_events(task_id, from_status, to_status, agent_type, attempt_number, error) SELECT id, status, status, agent_type, attempt_number, ? FROM task_logs WHERE id=?').run(message, taskId);
      }).immediate();
    } catch (auditError) { throw new AggregateError([error, auditError], message); }
    throw error;
  }
}
