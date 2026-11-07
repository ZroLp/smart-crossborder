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
    orchestratorInstance = new Orchestrator(messageBus);

    // Agent 运行时依赖：跨 Agent 共享上下文与五步进度追踪。
    // 数据库不可用时不阻塞 Agent 注册（降级为 null）。
    let sharedContext: SharedContext | undefined;
    let progressTracker: AgentProgressTracker | undefined;
    try {
      const db = getDb();
      sharedContext = new SharedContext(db);
      progressTracker = new AgentProgressTracker(db);
    } catch (error) {
      console.warn('[agent-service] runtime dependencies unavailable:', error);
    }

    orchestratorInstance.registerAgent(new SelectionAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance.registerAgent(new StoreBuilderAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance.registerAgent(new ContentCreatorAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance.registerAgent(new AdOptimizerAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance.registerAgent(new CustomerServiceAgent(messageBus, sharedContext, progressTracker));
    orchestratorInstance.registerAgent(new FulfillmentAgent(messageBus, sharedContext, progressTracker));
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
