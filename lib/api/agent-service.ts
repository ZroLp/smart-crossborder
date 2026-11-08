import { MessageBus } from '@/lib/framework/message-bus';
import { Orchestrator } from '@/lib/framework/orchestrator';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker } from '@/lib/framework/agent-progress';
import { SelectionAgent } from '@/lib/agents/product-selection';
import { StoreBuilderAgent } from '@/lib/agents/store-builder';
import { ContentCreatorAgent } from '@/lib/agents/content-creator';
import { AdOptimizerAgent } from '@/lib/agents/ad-optimizer';
import { CustomerServiceAgent } from '@/lib/agents/customer-service';
import { FulfillmentAgent } from '@/lib/agents/fulfillment';
import { AgentType } from '@/lib/framework/types';
import { getDb } from '@/lib/db/init';

let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    const messageBus = new MessageBus();

    const db = getDb();
    db.prepare('SELECT 1').get();
    const sharedContext = new SharedContext(db);
    const progressTracker = new AgentProgressTracker(db);
    const orchestrator = new Orchestrator(messageBus);

    orchestrator.registerAgent(new SelectionAgent(messageBus, sharedContext, progressTracker));
    orchestrator.registerAgent(new StoreBuilderAgent(messageBus, sharedContext, progressTracker));
    orchestrator.registerAgent(new ContentCreatorAgent(messageBus, sharedContext, progressTracker));
    orchestrator.registerAgent(new AdOptimizerAgent(messageBus, sharedContext, progressTracker));
    orchestrator.registerAgent(new CustomerServiceAgent(messageBus, sharedContext, progressTracker));
    orchestrator.registerAgent(new FulfillmentAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance = orchestrator;
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
