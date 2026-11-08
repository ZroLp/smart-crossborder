import { taskRuntime, agentDispatch, standaloneExecution, withStandaloneExecution } from './task-runtime';
import { AgentConfig, AgentResult, AgentType, MessageHandler } from './types';
import { MessageBus } from './message-bus';
import { SharedContext } from './shared-context';
import { AgentProgressTracker, AgentStep } from './agent-progress';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected messageBus: MessageBus;
  private defaultContext: SharedContext | null;
  protected get sharedContext(): SharedContext | null { return taskRuntime.getStore()?.context ?? this.defaultContext; }
  private defaultTracker: AgentProgressTracker | null;
  protected get progressTracker(): AgentProgressTracker | null { return taskRuntime.getStore()?.tracker ?? this.defaultTracker; }

  constructor(config: AgentConfig, messageBus: MessageBus, sharedContext?: SharedContext, progressTracker?: AgentProgressTracker) {
    this.config = config;
    this.messageBus = messageBus;
    this.defaultContext = sharedContext ?? null;
    this.defaultTracker = progressTracker ?? null;
  }

  abstract execute(input: Record<string, unknown>): Promise<AgentResult>;
  abstract validate(input: Record<string, unknown>): boolean;

  /** Records only an actual model request; rule fallback never starts this step. */
  protected async reason<T>(work: () => Promise<T>): Promise<T> {
    const runtime = taskRuntime.getStore();
    if (!runtime) return work();
    const { tracker, taskId } = runtime;
    if (!runtime.isActive()) throw new Error('Task is not active');
    tracker.startStep(this.config.type, taskId, AgentStep.ModelReasoning);
    try {
      const result = await work();
      if (!runtime.isActive()) throw new Error('Task is not active');
      tracker.completeStep(this.config.type, taskId, AgentStep.ModelReasoning);
      return result;
    } catch (error) {
      if (runtime.isActive()) tracker.failStep(this.config.type, taskId, AgentStep.ModelReasoning, String(error));
      throw error;
    }
  }

  protected assertExecutionContext(): void {
    if (taskRuntime.getStore() && agentDispatch.getStore() !== this.config.type) throw new Error('Task Agent execution must be dispatched by Orchestrator');
    if (!taskRuntime.getStore() && !standaloneExecution.getStore()) throw new Error('Task runtime and taskId are required; use executeStandalone for explicit non-task execution');
  }

  executeStandalone(input: Record<string, unknown>): Promise<AgentResult> {
    return withStandaloneExecution(() => this.execute(input));
  }

  getStatus(): AgentConfig {
    return this.config;
  }

  protected emit(event: string, data: unknown): void {
    this.messageBus.publish(`${this.config.type}:${event}`, data);
  }

  protected success(
    data: Record<string, unknown>,
    nextAgent?: AgentType,
    nextAgentInput?: Record<string, unknown>
  ): AgentResult {
    return { success: true, data, nextAgent, nextAgentInput };
  }

  protected fail(error: string): AgentResult {
    return { success: false, error };
  }

  writeToSharedContext(key: string, data: Record<string, unknown>): void {
    const runtime = taskRuntime.getStore();
    if (runtime && !runtime.isActive()) return;
    if (!this.sharedContext) return;
    try {
      this.sharedContext.setData(this.config.type, key, data);
    } catch (error) {
      if (taskRuntime.getStore()) throw error;
      console.warn(`[${this.config.type}] shared context write failed:`, error);
    }
  }

  readFromSharedContext(agentType: string, key: string): Record<string, unknown> | null {
    if (!this.sharedContext) return null;
    try {
      return this.sharedContext.getData(agentType, key);
    } catch (error) {
      console.warn(`[${this.config.type}] shared context read failed:`, error);
      return null;
    }
  }

  trackProgress(taskId: string): void {
    if (taskRuntime.getStore() && taskRuntime.getStore()!.taskId !== taskId) throw new Error('Progress taskId does not match runtime');
    if (this.progressTracker) {
      this.progressTracker.startTask(this.config.type, taskId);
    }
  }

  updateStep(taskId: string, step: AgentStep, status: 'start' | 'complete' | 'fail', data?: Record<string, unknown>): void {
    if (taskRuntime.getStore() && taskRuntime.getStore()!.taskId !== taskId) throw new Error('Progress taskId does not match runtime');
    if (!this.progressTracker) return;

    switch (status) {
      case 'start':
        this.progressTracker.startStep(this.config.type, taskId, step, data);
        break;
      case 'complete':
        this.progressTracker.completeStep(this.config.type, taskId, step, data);
        break;
      case 'fail':
        this.progressTracker.failStep(this.config.type, taskId, step, (data?.error as string) ?? 'Unknown error');
        break;
    }
  }
}
