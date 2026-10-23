import { getOrchestrator, resetOrchestrator, VALID_AGENT_TYPES } from '@/lib/api/agent-service';
import { AgentType } from '@/lib/framework/types';

describe('agent-service', () => {
  afterEach(() => {
    resetOrchestrator();
  });

  test('getOrchestrator returns orchestrator with all 6 agents registered', () => {
    const orchestrator = getOrchestrator();
    const registered = orchestrator.getRegisteredAgents();
    expect(registered).toHaveLength(6);
    expect(registered).toContain('selection');
    expect(registered).toContain('store-builder');
    expect(registered).toContain('content');
    expect(registered).toContain('ad-optimizer');
    expect(registered).toContain('customer-service');
    expect(registered).toContain('fulfillment');
  });

  test('getOrchestrator returns singleton instance', () => {
    const first = getOrchestrator();
    const second = getOrchestrator();
    expect(first).toBe(second);
  });

  test('resetOrchestrator creates new instance on next call', () => {
    const first = getOrchestrator();
    resetOrchestrator();
    const second = getOrchestrator();
    expect(first).not.toBe(second);
  });

  test('executing selection agent through orchestrator', async () => {
    const orchestrator = getOrchestrator();
    const results = await orchestrator.executeChain('selection', {
      products: [
        { name: 'Test Product', category: 'electronics', price: 100, cost: 50, sales: 500 },
      ],
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].success).toBe(true);
    expect(results[0].data).toBeDefined();
    expect(results[0].data!.products).toBeDefined();
  });

  test('executing customer service agent through orchestrator', async () => {
    const orchestrator = getOrchestrator();
    const result = await orchestrator.executeTask('customer-service', {
      message: '我的包裹什么时候到？',
      language: 'zh',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.intent).toBe('shipping');
    expect(result.data!.response).toBeDefined();
  });

  test('invalid agent type handling', async () => {
    const orchestrator = getOrchestrator();
    const result = await orchestrator.executeTask('invalid-type' as AgentType, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Agent not found');
  });

  test('VALID_AGENT_TYPES contains all expected types', () => {
    expect(VALID_AGENT_TYPES).toEqual([
      'selection',
      'store-builder',
      'content',
      'ad-optimizer',
      'customer-service',
      'fulfillment',
    ]);
  });
});
