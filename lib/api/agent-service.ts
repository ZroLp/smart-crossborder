import { MessageBus } from '@/lib/framework/message-bus';
import { Orchestrator } from '@/lib/framework/orchestrator';
import { SelectionAgent } from '@/lib/agents/product-selection';
import { StoreBuilderAgent } from '@/lib/agents/store-builder';
import { ContentCreatorAgent } from '@/lib/agents/content-creator';
import { AdOptimizerAgent } from '@/lib/agents/ad-optimizer';
import { CustomerServiceAgent } from '@/lib/agents/customer-service';
import { FulfillmentAgent } from '@/lib/agents/fulfillment';
import { AgentType } from '@/lib/framework/types';

let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    const messageBus = new MessageBus();
    orchestratorInstance = new Orchestrator(messageBus);
    orchestratorInstance.registerAgent(new SelectionAgent(messageBus));
    orchestratorInstance.registerAgent(new StoreBuilderAgent(messageBus));
    orchestratorInstance.registerAgent(new ContentCreatorAgent(messageBus));
    orchestratorInstance.registerAgent(new AdOptimizerAgent(messageBus));
    orchestratorInstance.registerAgent(new CustomerServiceAgent(messageBus));
    orchestratorInstance.registerAgent(new FulfillmentAgent(messageBus));
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}

export const VALID_AGENT_TYPES: AgentType[] = [
  'selection',
  'store-builder',
  'content',
  'ad-optimizer',
  'customer-service',
  'fulfillment',
];
