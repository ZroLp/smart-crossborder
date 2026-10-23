import { MessageBus } from '@/lib/framework/message-bus';
import { TaskStateMachine } from '@/lib/framework/task-state-machine';
import { Orchestrator } from '@/lib/framework/orchestrator';
import { BaseAgent } from '@/lib/framework/base-agent';
import { AgentResult, AgentType } from '@/lib/framework/types';

class MockAgent extends BaseAgent {
  constructor(
    type: AgentType,
    messageBus: MessageBus,
    private result: AgentResult
  ) {
    super({ name: `Mock ${type}`, type, description: 'Mock' }, messageBus);
  }

  async execute(): Promise<AgentResult> {
    return this.result;
  }

  validate(): boolean {
    return true;
  }
}

class ValidatingMockAgent extends BaseAgent {
  constructor(
    type: AgentType,
    messageBus: MessageBus,
    private result: AgentResult,
    private isValid: boolean
  ) {
    super({ name: `Validating ${type}`, type, description: 'Validating Mock' }, messageBus);
  }

  async execute(): Promise<AgentResult> {
    return this.result;
  }

  validate(): boolean {
    return this.isValid;
  }
}

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  test('subscribe and publish', () => {
    const handler = jest.fn();
    bus.subscribe('test', handler);
    bus.publish('test', { value: 1 });
    expect(handler).toHaveBeenCalledWith('test', { value: 1 });
  });

  test('multiple handlers for same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bus.subscribe('test', handler1);
    bus.subscribe('test', handler2);
    bus.publish('test', 'data');
    expect(handler1).toHaveBeenCalledWith('test', 'data');
    expect(handler2).toHaveBeenCalledWith('test', 'data');
  });

  test('unsubscribe stops receiving events', () => {
    const handler = jest.fn();
    const unsubscribe = bus.subscribe('test', handler);
    unsubscribe();
    bus.publish('test', 'data');
    expect(handler).not.toHaveBeenCalled();
  });

  test('once handler fires only once', () => {
    const handler = jest.fn();
    bus.once('test', handler);
    bus.publish('test', 'first');
    bus.publish('test', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('test', 'first');
  });

  test('clear removes all handlers', () => {
    const handler = jest.fn();
    bus.subscribe('a', handler);
    bus.subscribe('b', handler);
    bus.clear();
    bus.publish('a', 'data');
    bus.publish('b', 'data');
    expect(handler).not.toHaveBeenCalled();
  });

  test('listenerCount returns correct count', () => {
    expect(bus.listenerCount('test')).toBe(0);
    const unsub1 = bus.subscribe('test', jest.fn());
    expect(bus.listenerCount('test')).toBe(1);
    const unsub2 = bus.subscribe('test', jest.fn());
    expect(bus.listenerCount('test')).toBe(2);
    unsub1();
    expect(bus.listenerCount('test')).toBe(1);
    unsub2();
    expect(bus.listenerCount('test')).toBe(0);
  });
});

describe('TaskStateMachine', () => {
  let sm: TaskStateMachine;

  beforeEach(() => {
    sm = new TaskStateMachine();
  });

  test('pending -> running is valid', () => {
    expect(sm.canTransition('pending', 'running')).toBe(true);
    expect(sm.transition('pending', 'running')).toBe('running');
  });

  test('running -> completed is valid', () => {
    expect(sm.canTransition('running', 'completed')).toBe(true);
    expect(sm.transition('running', 'completed')).toBe('completed');
  });

  test('running -> failed is valid', () => {
    expect(sm.canTransition('running', 'failed')).toBe(true);
    expect(sm.transition('running', 'failed')).toBe('failed');
  });

  test('failed -> pending is valid (retry)', () => {
    expect(sm.canTransition('failed', 'pending')).toBe(true);
    expect(sm.transition('failed', 'pending')).toBe('pending');
  });

  test('pending -> completed is invalid', () => {
    expect(sm.canTransition('pending', 'completed')).toBe(false);
    expect(() => sm.transition('pending', 'completed')).toThrow('Invalid transition: pending -> completed');
  });

  test('completed -> running is invalid', () => {
    expect(sm.canTransition('completed', 'running')).toBe(false);
    expect(() => sm.transition('completed', 'running')).toThrow('Invalid transition: completed -> running');
  });

  test('isTerminal returns true for completed', () => {
    expect(sm.isTerminal('completed')).toBe(true);
  });

  test('isTerminal returns false for non-completed states', () => {
    expect(sm.isTerminal('pending')).toBe(false);
    expect(sm.isTerminal('running')).toBe(false);
    expect(sm.isTerminal('failed')).toBe(false);
  });
});

describe('Orchestrator', () => {
  let bus: MessageBus;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    bus = new MessageBus();
    orchestrator = new Orchestrator(bus);
  });

  test('registerAgent and getAgent', () => {
    const agent = new MockAgent('selection', bus, { success: true, data: {} });
    orchestrator.registerAgent(agent);
    expect(orchestrator.getAgent('selection')).toBe(agent);
  });

  test('getAgent returns undefined for unregistered type', () => {
    expect(orchestrator.getAgent('selection')).toBeUndefined();
  });

  test('executeTask with mock agent', async () => {
    const agent = new MockAgent('selection', bus, { success: true, data: { products: ['a', 'b'] } });
    orchestrator.registerAgent(agent);
    const result = await orchestrator.executeTask('selection', { query: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ products: ['a', 'b'] });
  });

  test('executeTask with unregistered agent', async () => {
    const result = await orchestrator.executeTask('selection', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent not found: selection');
  });

  test('executeTask with invalid input', async () => {
    const agent = new ValidatingMockAgent('selection', bus, { success: true, data: {} }, false);
    orchestrator.registerAgent(agent);
    const result = await orchestrator.executeTask('selection', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input for agent: selection');
  });

  test('executeChain with linked agents', async () => {
    const selectionAgent = new MockAgent('selection', bus, {
      success: true,
      data: { products: ['a'] },
      nextAgent: 'content',
      nextAgentInput: { products: ['a'] },
    });
    const contentAgent = new MockAgent('content', bus, {
      success: true,
      data: { listings: ['listing-a'] },
    });
    orchestrator.registerAgent(selectionAgent);
    orchestrator.registerAgent(contentAgent);
    const results = await orchestrator.executeChain('selection', { query: 'test' });
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].data).toEqual({ products: ['a'] });
    expect(results[0].nextAgent).toBe('content');
    expect(results[1].success).toBe(true);
    expect(results[1].data).toEqual({ listings: ['listing-a'] });
  });

  test('executeChain stops on failure', async () => {
    const selectionAgent = new MockAgent('selection', bus, {
      success: false,
      error: 'Selection failed',
    });
    orchestrator.registerAgent(selectionAgent);
    const results = await orchestrator.executeChain('selection', {});
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Selection failed');
  });

  test('getRegisteredAgents returns all registered types', () => {
    orchestrator.registerAgent(new MockAgent('selection', bus, { success: true }));
    orchestrator.registerAgent(new MockAgent('content', bus, { success: true }));
    const types = orchestrator.getRegisteredAgents();
    expect(types).toContain('selection');
    expect(types).toContain('content');
    expect(types).toHaveLength(2);
  });
});
