import { taskRuntime } from './task-runtime';
import { AgentStep } from './agent-progress';
import { AgentType, AgentResult } from './types';
import { BaseAgent } from './base-agent';
import { MessageBus } from './message-bus';
import { TaskStateMachine } from './task-state-machine';

export class Orchestrator {
  private agents: Map<AgentType, BaseAgent> = new Map();
  private messageBus: MessageBus;
  private stateMachine: TaskStateMachine;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.stateMachine = new TaskStateMachine();
  }

  registerAgent(agent: BaseAgent): void {
    const config = agent.getStatus();
    this.agents.set(config.type, agent);
  }

  getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  /**
   * Run exactly one agent. Chain traversal is opt-in only via executeChain /
   * `chain: true`; a `nextAgent` field is returned to the caller untouched.
   */
  async executeTask(agentType: AgentType, input: Record<string, unknown>): Promise<AgentResult> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      return { success: false, error: `Agent not found: ${agentType}` };
    }
    const runtime = taskRuntime.getStore();
    if (!runtime) {
      if (!agent.validate(input)) return { success: false, error: 'Invalid input for agent: ' + agentType };
      try { return await agent.execute(input); } catch (error) { return { success: false, error: String(error) }; }
    }
    const { tracker, taskId, signal, context } = runtime;
    let active = AgentStep.DataCollection;
    const check = () => {
      if (!runtime.isActive()) throw new Error('Task aborted');
    };
    const stage = (step: AgentStep, work: () => void) => {
      check(); active = step; tracker.startStep(agentType, taskId, step);
      work(); check(); tracker.completeStep(agentType, taskId, step);
    };
    tracker.startTask(agentType, taskId);
    try {
      stage(AgentStep.DataCollection, () => {
        if (!agent.validate(input)) throw new Error('Invalid input for agent: ' + agentType);
        context.setData(agentType, 'input', input);
      });
      check(); active = AgentStep.ModelReasoning;
      tracker.startStep(agentType, taskId, active);
      const result = await agent.execute(input);
      check();
      if (!result.success) throw new Error(result.error ?? 'Agent failed');
      tracker.completeStep(agentType, taskId, active);
      stage(AgentStep.StrategyGeneration, () => {
        context.setData(agentType, 'handoff', { nextAgent: result.nextAgent ?? null, input: result.nextAgentInput ?? result.data ?? {} });
      });
      stage(AgentStep.Execution, () => { context.setData(agentType, 'result', result.data ?? {}); });
      stage(AgentStep.ResultCallback, () => { this.messageBus.publish(agentType + ':completed', { taskId, result }); });
      return result;
    } catch (error) {
      if (!signal.aborted) tracker.failStep(agentType, taskId, active, error instanceof Error ? error.message : String(error));
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async executeChain(startAgent: AgentType, input: Record<string, unknown>): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentAgent: AgentType | undefined = startAgent;
    let currentInput = input;

    while (currentAgent) {
      const result = await this.executeTask(currentAgent, currentInput);
      results.push(result);
      if (!result.success || !result.nextAgent) break;
      currentAgent = result.nextAgent;
      currentInput = result.nextAgentInput ?? result.data ?? {};
    }

    return results;
  }

  getRegisteredAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}
