import { AgentConfig, AgentResult, AgentType, MessageHandler } from './types';
import { MessageBus } from './message-bus';
import { SharedContext } from './shared-context';
import { AgentProgressTracker, AgentStep } from './agent-progress';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected messageBus: MessageBus;
  protected sharedContext: SharedContext;
  protected progressTracker: AgentProgressTracker | null;

  constructor(config: AgentConfig, messageBus: MessageBus, sharedContext?: SharedContext, progressTracker?: AgentProgressTracker) {
    this.config = config;
    this.messageBus = messageBus;
    this.sharedContext = sharedContext!;
    this.progressTracker = progressTracker ?? null;
  }

  abstract execute(input: Record<string, unknown>): Promise<AgentResult>;
  abstract validate(input: Record<string, unknown>): boolean;

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
    this.sharedContext.setData(this.config.type, key, data);
  }

  readFromSharedContext(agentType: string, key: string): Record<string, unknown> | null {
    return this.sharedContext.getData(agentType, key);
  }

  trackProgress(taskId: string): void {
    if (this.progressTracker) {
      this.progressTracker.startTask(this.config.type, taskId);
    }
  }

  updateStep(taskId: string, step: AgentStep, status: 'start' | 'complete' | 'fail', data?: Record<string, unknown>): void {
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
