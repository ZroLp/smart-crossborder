import { DbClient } from '../db/client';

export enum AgentStep {
  DataCollection = 'data-collection',
  ModelReasoning = 'model-reasoning',
  StrategyGeneration = 'strategy-generation',
  Execution = 'execution',
  ResultCallback = 'result-callback',
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface StepRecord {
  step: AgentStep;
  status: StepStatus;
  timestamp: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  duration: number | null;
}

export interface ProgressRecord {
  id: number;
  agentType: string;
  taskId: string;
  steps: StepRecord[];
  createdAt: string;
  updatedAt: string;
}

interface AgentProgressRow {
  id: number;
  agent_type: string;
  task_id: string;
  steps: string;
  created_at: string;
  updated_at: string;
}

const ALL_STEPS: AgentStep[] = [
  AgentStep.DataCollection,
  AgentStep.ModelReasoning,
  AgentStep.StrategyGeneration,
  AgentStep.Execution,
  AgentStep.ResultCallback,
];

export class AgentProgressTracker {
  private db: DbClient;
  private onError?: (error: Error) => void;

  constructor(db: DbClient, onError?: (error: Error) => void) {
    this.db = db;
    this.onError = onError;
  }

  /** 写操作包在事务里（Postgres 单连接内 BEGIN/COMMIT），失败仅上报不中断 Agent 主流程。 */
  private async protected<T>(work: () => Promise<T> | T): Promise<T> {
    try {
      return await this.db.transaction(async () => work()).immediate();
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  startTask(agentType: string, taskId: string): Promise<void> {
    return this.protected(async () => {
      if (await this.getProgress(agentType, taskId)) return;
      const steps: StepRecord[] = ALL_STEPS.map((step) => ({
        step,
        status: 'pending' as StepStatus,
        timestamp: new Date().toISOString(),
        input: null,
        output: null,
        duration: null,
      }));

      await this.db
        .prepare(
          'INSERT INTO agent_progress (agent_type, task_id, steps, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        )
        .run(agentType, taskId, JSON.stringify(steps));
    });
  }

  startStep(agentType: string, taskId: string, step: AgentStep, input?: Record<string, unknown>): Promise<void> {
    return this.protected(async () => {
      if (await this.isStopped(taskId)) return;
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.step === step) {
          return { ...s, status: 'running' as StepStatus, timestamp: new Date().toISOString(), input: input ?? null };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  private async isStopped(taskId: string): Promise<boolean> {
    // task_logs.id 为 BIGINT：非数字 task_id（如自定义字符串）直接跳过查询，
    // 避免 Postgres 参数类型错误（SQLite 时代无感）。
    if (!/^\d+$/.test(String(taskId))) return false;
    const task = await this.db
      .prepare('SELECT status FROM task_logs WHERE id = ?')
      .get(taskId) as { status: string } | undefined;
    return !!task && ['terminated', 'paused', 'completed', 'failed'].includes(task.status);
  }

  completeStep(agentType: string, taskId: string, step: AgentStep, output?: Record<string, unknown>): Promise<void> {
    return this.protected(async () => {
      if (await this.isStopped(taskId)) return;
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.step === step) {
          const start = new Date(s.timestamp).getTime();
          const duration = Date.now() - start;
          return { ...s, status: 'completed' as StepStatus, output: output ?? null, duration };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  failStep(agentType: string, taskId: string, step: AgentStep, error: string): Promise<void> {
    return this.protected(async () => {
      if (await this.isStopped(taskId)) return;
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.step === step) {
          const start = new Date(s.timestamp).getTime();
          const duration = Date.now() - start;
          return { ...s, status: 'failed' as StepStatus, output: { error }, duration };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  pauseTask(agentType: string, taskId: string): Promise<void> {
    return this.protected(async () => {
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.status === 'running') {
          return { ...s, status: 'paused' as StepStatus };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  resumeTask(agentType: string, taskId: string): Promise<void> {
    return this.protected(async () => {
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.status === 'paused') {
          return { ...s, status: 'running' as StepStatus, timestamp: new Date().toISOString() };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  terminateTask(agentType: string, taskId: string): Promise<void> {
    return this.protected(async () => {
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.status === 'running' || s.status === 'paused') {
          return { ...s, status: 'failed' as StepStatus, output: { error: 'Task terminated' } };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  retryTask(agentType: string, taskId: string): Promise<void> {
    return this.protected(async () => {
      const record = await this.getProgress(agentType, taskId);
      if (!record) return;

      const steps = record.steps.map((s) => {
        if (s.status === 'failed') {
          return { ...s, status: 'pending' as StepStatus, input: null, output: null, duration: null, timestamp: new Date().toISOString() };
        }
        return s;
      });

      await this.db
        .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
        .run(JSON.stringify(steps), agentType, taskId);
    });
  }

  async getProgress(agentType: string, taskId: string): Promise<ProgressRecord | null> {
    const row = await this.db
      .prepare('SELECT * FROM agent_progress WHERE agent_type = ? AND task_id = ?')
      .get(agentType, taskId) as AgentProgressRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      agentType: row.agent_type,
      taskId: row.task_id,
      steps: JSON.parse(row.steps) as StepRecord[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
