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
    if (!agent.validate(input)) {
      return { success: false, error: `Invalid input for agent: ${agentType}` };
    }
    try {
      return await agent.execute(input);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async executeChain(startAgent: AgentType, input: Record<string, unknown>): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentAgent: AgentType | undefined = startAgent;
    let currentInput = input;

    while (currentAgent) {
      const agent = this.agents.get(currentAgent);
      if (!agent) {
        results.push({ success: false, error: `Agent not found: ${currentAgent}` });
        break;
      }
      if (!agent.validate(currentInput)) {
        results.push({ success: false, error: `Invalid input for agent: ${currentAgent}` });
        break;
      }
      try {
        const result = await agent.execute(currentInput);
        results.push(result);
        if (!result.success || !result.nextAgent) {
          break;
        }
        currentAgent = result.nextAgent;
        currentInput = result.nextAgentInput ?? result.data ?? {};
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }

    return results;
  }

  getRegisteredAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}
