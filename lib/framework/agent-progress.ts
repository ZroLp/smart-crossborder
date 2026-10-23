import Database from 'better-sqlite3';

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
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  startTask(agentType: string, taskId: string): void {
    const steps: StepRecord[] = ALL_STEPS.map((step) => ({
      step,
      status: 'pending' as StepStatus,
      timestamp: new Date().toISOString(),
      input: null,
      output: null,
      duration: null,
    }));

    this.db
      .prepare(
        'INSERT INTO agent_progress (agent_type, task_id, steps, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      )
      .run(agentType, taskId, JSON.stringify(steps));
  }

  startStep(agentType: string, taskId: string, step: AgentStep, input?: Record<string, unknown>): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.step === step) {
        return { ...s, status: 'running' as StepStatus, timestamp: new Date().toISOString(), input: input ?? null };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  completeStep(agentType: string, taskId: string, step: AgentStep, output?: Record<string, unknown>): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.step === step) {
        const start = new Date(s.timestamp).getTime();
        const duration = Date.now() - start;
        return { ...s, status: 'completed' as StepStatus, output: output ?? null, duration };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  failStep(agentType: string, taskId: string, step: AgentStep, error: string): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.step === step) {
        const start = new Date(s.timestamp).getTime();
        const duration = Date.now() - start;
        return { ...s, status: 'failed' as StepStatus, output: { error }, duration };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  pauseTask(agentType: string, taskId: string): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.status === 'running') {
        return { ...s, status: 'paused' as StepStatus };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  resumeTask(agentType: string, taskId: string): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.status === 'paused') {
        return { ...s, status: 'running' as StepStatus, timestamp: new Date().toISOString() };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  terminateTask(agentType: string, taskId: string): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.status === 'running' || s.status === 'paused') {
        return { ...s, status: 'failed' as StepStatus };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  retryTask(agentType: string, taskId: string): void {
    const record = this.getProgress(agentType, taskId);
    if (!record) return;

    const steps = record.steps.map((s) => {
      if (s.status === 'failed') {
        return { ...s, status: 'pending' as StepStatus, input: null, output: null, duration: null, timestamp: new Date().toISOString() };
      }
      return s;
    });

    this.db
      .prepare('UPDATE agent_progress SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_type = ? AND task_id = ?')
      .run(JSON.stringify(steps), agentType, taskId);
  }

  getProgress(agentType: string, taskId: string): ProgressRecord | null {
    const row = this.db
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
