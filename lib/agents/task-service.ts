import { withTaskRuntime, taskRuntime } from '@/lib/framework/task-runtime';
import { getDb } from '@/lib/db/init';
import { TaskLogRepository, TaskLog } from '@/lib/db/task-log-repository';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { TaskStateMachine } from '@/lib/framework/task-state-machine';
import { AgentResult, AgentType, TaskStatus } from '@/lib/framework/types';
import { getOrchestrator } from '@/lib/api/agent-service';

export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'terminated',
];

const RETRYABLE_STATUSES: TaskStatus[] = ['completed', 'failed', 'paused', 'terminated'];

const stateMachine = new TaskStateMachine();

/** In-flight abort controllers, keyed by numeric taskId string. */
const abortControllers = new Map<string, AbortController>();

const ABORTED = Symbol('task-aborted');

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class InvalidTaskStateError extends Error {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Invalid task state transition: ${from} -> ${to}`);
    this.name = 'InvalidTaskStateError';
  }
}

export interface TaskView {
  taskId: string;
  displayId: string;
  agentType: AgentType;
  status: TaskStatus;
  userId: number | null;
  input: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  rootTaskId?: string;
  parentTaskId?: string;
  attemptNumber?: number;
}

export interface AgentTaskResponse extends TaskView {
  result?: AgentResult | AgentResult[];
}

export function formatDisplayId(task: Pick<TaskLog, 'id' | 'created_at'>): string {
  const datePart = (task.created_at || '').slice(0, 10).replace(/-/g, '');
  const safeDatePart = datePart || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TSK-${safeDatePart}${String(task.id).padStart(2, '0')}`;
}

function parseInput(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toView(task: TaskLog): TaskView {
  return {
    taskId: String(task.id),
    displayId: formatDisplayId(task),
    agentType: task.agent_type as AgentType,
    status: task.status as TaskStatus,
    userId: task.user_id ?? null,
    input: parseInput(task.input),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    error: task.error,
    rootTaskId: String(task.root_task_id ?? task.id),
    parentTaskId: task.parent_task_id ? String(task.parent_task_id) : undefined,
    attemptNumber: task.attempt_number ?? 1,
  };
}

function taskRepo(): TaskLogRepository {
  return new TaskLogRepository(getDb());
}

/** Resolve a task by numeric id string or by display id (TSK-YYYYMMDD##). */
export function findTask(taskId: string): TaskLog | null {
  const repo = taskRepo();
  const numeric = Number(taskId);
  if (Number.isInteger(numeric) && numeric > 0 && String(numeric) === taskId) {
    return repo.findById(numeric) ?? null;
  }

  const all = repo.findAll(1000, 0);
  return all.find((task) => formatDisplayId(task) === taskId) ?? null;
}

export function requireTask(taskId: string): TaskLog {
  const task = findTask(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}

/** Resolve a task only when it belongs to the given user (404 otherwise). */
export function findOwnedTask(taskId: string, userId: number): TaskLog | null {
  const task = findTask(taskId);
  if (!task || task.user_id !== userId) return null;
  return task;
}

export function getTask(taskId: string): TaskView | null {
  const task = findTask(taskId);
  return task ? toView(task) : null;
}

export function createTask(
  agentType: AgentType,
  input: Record<string, unknown>,
  userId: number | null = null
): TaskView {
  const repo = taskRepo();
  const result = repo.create({
    agent_type: agentType,
    task_name: `${agentType} 任务`,
    status: 'pending',
    input: JSON.stringify(input ?? {}),
    user_id: userId,
  });
  const created = repo.findById(Number(result.lastInsertRowid));
  if (!created) throw new Error('Failed to create task');
  return toView(created);
}

export function transitionTask(
  taskId: string,
  to: TaskStatus,
  patch: { output?: string; error?: string } = {}
): TaskView {
  const task = requireTask(taskId);
  const current = task.status as TaskStatus;
  if (!stateMachine.canTransition(current, to)) {
    throw new InvalidTaskStateError(current, to);
  }

  const repo = taskRepo();
  repo.updateStatus(task.id, to, patch.output, patch.error);
  return toView(repo.findById(task.id)!);
}

function waitForAbort(signal: AbortSignal): Promise<typeof ABORTED> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(ABORTED);
      return;
    }
    signal.addEventListener('abort', () => resolve(ABORTED), { once: true });
  });
}

export interface RunAgentTaskOptions {
  agentType: AgentType;
  input: Record<string, unknown>;
  userId?: number | null;
  chain?: boolean;
  parentTaskId?: number;
}

/** Create a task row and execute the agent, persisting lifecycle + progress. */
export async function runAgentTask(options: RunAgentTaskOptions): Promise<AgentTaskResponse> {
  const task = getDb().transaction(() => {
    const repo = taskRepo();
    let parent: TaskLog | undefined;
    let root: number | undefined;
    let attempt = 1;
    if (options.parentTaskId) {
      parent = repo.findById(options.parentTaskId);
      if (!parent || !RETRYABLE_STATUSES.includes(parent.status as TaskStatus)) throw new Error('Invalid retry parent');
      root = parent.root_task_id ?? parent.id;
      const row = getDb().prepare('SELECT MAX(attempt_number) AS n FROM task_logs WHERE id=? OR root_task_id=?').get(root, root) as { n: number };
      attempt = row.n + 1;
    }
    const result = repo.create({ agent_type: options.agentType, task_name: options.agentType + ' 任务', status: 'pending', input: JSON.stringify(options.input ?? {}), user_id: options.userId ?? null, root_task_id: root ?? null, parent_task_id: parent?.id ?? null, attempt_number: attempt, chain: options.chain ? 1 : 0 });
    return toView(repo.findById(Number(result.lastInsertRowid))!);
  }).immediate();
  const controller = new AbortController();
  return withTaskRuntime(task.taskId, controller.signal, () => executeCreatedTask(task, Boolean(options.chain), controller));
}

async function executeCreatedTask(task: TaskView, chain: boolean, controller: AbortController): Promise<AgentTaskResponse> {
  const taskId = task.taskId;
  const numericId = Number(taskId);
  const repo = taskRepo();
  const tracker = taskRuntime.getStore()!.tracker;
  abortControllers.set(taskId, controller);

  try {
    repo.updateStatus(numericId, 'running');
    tracker.startTask(task.agentType, taskId);

    let result: AgentResult | AgentResult[];
    let aborted = false;

    try {
      const orchestrator = getOrchestrator();
      const work = chain
        ? orchestrator.executeChain(task.agentType, task.input)
        : orchestrator.executeTask(task.agentType, task.input);
      // Never let a late rejection become unhandled when abort wins the race.
      work.catch(() => undefined);

      const raced = await Promise.race([work, waitForAbort(controller.signal)]);
      if (raced === ABORTED) {
        aborted = true;
        result = { success: false, error: 'Task aborted' };
      } else {
        result = raced;
      }
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    const latest = repo.findById(numericId);
    const latestStatus = (latest?.status ?? 'running') as TaskStatus;

    // A concurrent pause/terminate request wins over the execution result.
    if (latestStatus === 'paused' || latestStatus === 'terminated') {
      try {
        if (latestStatus === 'paused') tracker.pauseTask(task.agentType, taskId);
        else tracker.terminateTask(task.agentType, taskId);
      } catch {
        // progress rows are best-effort
      }
      return buildResponse(repo.findById(numericId)!, result);
    }

    if (aborted) {
      repo.updateStatus(numericId, 'terminated', undefined, 'Task terminated by user');
      try {
        tracker.terminateTask(task.agentType, taskId);
      } catch {
        // ignore
      }
      return buildResponse(repo.findById(numericId)!, undefined);
    }

    const success = Array.isArray(result) ? result.every((item) => item.success) : result.success;
    const error = Array.isArray(result)
      ? result.find((item) => !item.success)?.error
      : result.error;

    if (success) {
      const output = Array.isArray(result) ? { results: result } : (result.data ?? {});
      repo.updateStatus(numericId, 'completed', JSON.stringify(output));
    } else {
      try {
        const record = tracker.getProgress(task.agentType, taskId);
        if (record && !record.steps.some(step => step.status === 'failed')) {
          const active = record.steps.find(step => step.status === 'running' || step.status === 'pending');
          if (active) tracker.failStep(task.agentType, taskId, active.step, error ?? 'Unknown error');
        }
      } catch {
        // ignore
      }
      repo.updateStatus(numericId, 'failed', JSON.stringify(result), error);
    }

    return buildResponse(repo.findById(numericId)!, result);
  } finally {
    controller.abort();
    abortControllers.delete(taskId);
  }
}

function buildResponse(task: TaskLog, result?: AgentResult | AgentResult[]): AgentTaskResponse {
  const view = toView(task);
  return {
    ...view,
    result,
    error: task.error ?? null,
  };
}

/** Pause a running task; throws InvalidTaskStateError for illegal states. */
export function pauseTask(taskId: string): TaskView {
  const task = requireTask(taskId);
  const current = task.status as TaskStatus;
  if (!stateMachine.canTransition(current, 'paused')) {
    throw new InvalidTaskStateError(current, 'paused');
  }

  const repo = taskRepo();
  repo.updateStatus(task.id, 'paused');
  abortControllers.get(String(task.id))?.abort();
  try {
    (taskRuntime.getStore()?.tracker ?? new AgentProgressTracker(getDb())).pauseTask(task.agent_type, String(task.id));
  } catch {
    // progress update is best-effort
  }
  return toView(repo.findById(task.id)!);
}

/** Terminate an in-flight task and try to abort the running work. */
export function terminateTask(taskId: string): TaskView {
  const task = requireTask(taskId);
  const current = task.status as TaskStatus;
  if (!stateMachine.canTransition(current, 'terminated')) {
    throw new InvalidTaskStateError(current, 'terminated');
  }

  const repo = taskRepo();
  repo.updateStatus(task.id, 'terminated', undefined, 'Terminated by user');
  abortControllers.get(String(task.id))?.abort();
  try {
    const tracker = taskRuntime.getStore()?.tracker ?? new AgentProgressTracker(getDb());
    const agents = getDb().prepare('SELECT DISTINCT agent_type FROM agent_progress WHERE task_id=?').all(String(task.id)) as { agent_type: string }[];
    for (const agent of agents) tracker.terminateTask(agent.agent_type, String(task.id));
  } catch {
    // progress update is best-effort
  }
  return toView(repo.findById(task.id)!);
}

/** Retry creates a brand-new task from the original input and runs it. */
export async function retryTask(taskId: string): Promise<AgentTaskResponse> {
  const task = requireTask(taskId);
  const current = task.status as TaskStatus;
  if (!RETRYABLE_STATUSES.includes(current)) {
    throw new InvalidTaskStateError(current, 'pending');
  }

  return runAgentTask({
    agentType: task.agent_type as AgentType,
    input: parseInput(task.input),
    userId: task.user_id ?? null,
    chain: Boolean(task.chain),
    parentTaskId: task.id,
  });
}

export interface TaskStepView {
  step: string;
  label: string;
  status: string;
  duration: number | null;
  input?: string;
  output?: string;
}

export interface TaskProgressView {
  taskId: string;
  displayId: string;
  agentType: AgentType;
  taskStatus: TaskStatus;
  status: TaskStatus;
  steps: TaskStepView[];
  createdAt: string;
  updatedAt: string;
}

const STEP_LABELS: Record<AgentStep, string> = {
  [AgentStep.DataCollection]: '数据采集',
  [AgentStep.ModelReasoning]: '模型推理',
  [AgentStep.StrategyGeneration]: '策略生成',
  [AgentStep.Execution]: '执行落地',
  [AgentStep.ResultCallback]: '结果回传',
};

/** Read task status + five-step progress (progress only exists after execution starts). */
export function getTaskProgress(taskId: string): TaskProgressView | null {
  const task = findTask(taskId);
  if (!task) return null;

  const tracker = new AgentProgressTracker(getDb());
  const record = tracker.getProgress(task.agent_type, String(task.id));

  const steps: TaskStepView[] = record
    ? record.steps.map((step) => ({
        step: step.step,
        label: STEP_LABELS[step.step as AgentStep] || step.step,
        status: step.status,
        duration: step.duration,
        input: step.input ? JSON.stringify(step.input) : undefined,
        output: step.output ? JSON.stringify(step.output) : undefined,
      }))
    : [];

  return {
    taskId: String(task.id),
    displayId: formatDisplayId(task),
    agentType: task.agent_type as AgentType,
    taskStatus: task.status as TaskStatus,
    status: task.status as TaskStatus,
    steps,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

/** Test helper: forget in-flight abort controllers. */
export function resetTaskRuntimeForTests(): void {
  abortControllers.clear();
}
