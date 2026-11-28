import { SharedContext } from '@/lib/framework/shared-context';
import { MessageBus } from '@/lib/framework/message-bus';
import { BaseAgent } from '@/lib/framework/base-agent';
import { AgentResult, AgentType } from '@/lib/framework/types';
import { initDatabase } from '@/lib/db/init';
import { DbClient } from '@/lib/db/client';

class TestAgent extends BaseAgent {
  constructor(type: AgentType, messageBus: MessageBus, sharedContext: SharedContext) {
    super({ name: `Test ${type}`, type, description: 'Test' }, messageBus, sharedContext);
  }

  async execute(): Promise<AgentResult> {
    return { success: true, data: {} };
  }

  validate(): boolean {
    return true;
  }
}

describe('SharedContext', () => {
  let db: DbClient;
  let sharedContext: SharedContext;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('setData and getData basic operations', async () => {
    await sharedContext.setData('selection', 'products', { items: ['a', 'b'] });
    const result = await sharedContext.getData('selection', 'products');
    expect(result).toEqual({ items: ['a', 'b'] });
  });

  test('getData returns null for non-existent key', async () => {
    const result = await sharedContext.getData('selection', 'nonexistent');
    expect(result).toBeNull();
  });

  test('namespace isolation - different agentTypes with same key', async () => {
    await sharedContext.setData('selection', 'config', { mode: 'auto' });
    await sharedContext.setData('content', 'config', { mode: 'manual' });

    const selectionConfig = await sharedContext.getData('selection', 'config');
    const contentConfig = await sharedContext.getData('content', 'config');

    expect(selectionConfig).toEqual({ mode: 'auto' });
    expect(contentConfig).toEqual({ mode: 'manual' });
  });

  test('getData returns latest value for same agentType and key', async () => {
    await sharedContext.setData('selection', 'status', { step: 1 });
    await sharedContext.setData('selection', 'status', { step: 2 });

    const result = await sharedContext.getData('selection', 'status');
    expect(result).toEqual({ step: 2 });
  });

  test('getHistory returns chronological records for specific key', async () => {
    await sharedContext.setData('selection', 'status', { step: 1 });
    await sharedContext.setData('selection', 'status', { step: 2 });
    await sharedContext.setData('selection', 'status', { step: 3 });

    const history = await sharedContext.getHistory('selection', 'status');
    expect(history).toHaveLength(3);
    expect(history[0].value).toEqual({ step: 1 });
    expect(history[1].value).toEqual({ step: 2 });
    expect(history[2].value).toEqual({ step: 3 });
  });

  test('getHistory returns all records for agentType when key is omitted', async () => {
    await sharedContext.setData('selection', 'products', { items: ['a'] });
    await sharedContext.setData('selection', 'status', { step: 1 });
    await sharedContext.setData('content', 'listings', { items: ['x'] });

    const history = await sharedContext.getHistory('selection');
    expect(history).toHaveLength(2);
    expect(history[0].key).toBe('products');
    expect(history[1].key).toBe('status');
  });

  test('getHistory returns empty array for non-existent agentType', async () => {
    const history = await sharedContext.getHistory('fulfillment');
    expect(history).toEqual([]);
  });

  test('getHistory records have correct structure', async () => {
    await sharedContext.setData('selection', 'test', { value: 42 });

    const history = await sharedContext.getHistory('selection', 'test');
    expect(history).toHaveLength(1);
    expect(history[0]).toHaveProperty('id');
    expect(history[0]).toHaveProperty('agentType', 'selection');
    expect(history[0]).toHaveProperty('key', 'test');
    expect(history[0]).toHaveProperty('value');
    expect(history[0]).toHaveProperty('createdAt');
    expect(typeof history[0].id).toBe('number');
    expect(typeof history[0].createdAt).toBe('string');
  });

  test('clear removes data for specific key', async () => {
    await sharedContext.setData('selection', 'products', { items: ['a'] });
    await sharedContext.setData('selection', 'status', { step: 1 });

    await sharedContext.clear('selection', 'products');

    expect(await sharedContext.getData('selection', 'products')).toBeNull();
    expect(await sharedContext.getData('selection', 'status')).toEqual({ step: 1 });
  });

  test('clear removes all data for agentType when key is omitted', async () => {
    await sharedContext.setData('selection', 'products', { items: ['a'] });
    await sharedContext.setData('selection', 'status', { step: 1 });
    await sharedContext.setData('content', 'listings', { items: ['x'] });

    await sharedContext.clear('selection');

    expect(await sharedContext.getData('selection', 'products')).toBeNull();
    expect(await sharedContext.getData('selection', 'status')).toBeNull();
    expect(await sharedContext.getData('content', 'listings')).toEqual({ items: ['x'] });
  });

  test('JSON serialization and deserialization preserves complex data', async () => {
    const complexData = {
      nested: { deep: { value: 123 } },
      array: [1, 'two', false, null],
      boolean: true,
      number: 3.14,
      string: 'hello',
    };

    await sharedContext.setData('selection', 'complex', complexData);
    const result = await sharedContext.getData('selection', 'complex');
    expect(result).toEqual(complexData);
  });

  test('JSON serialization handles empty object', async () => {
    await sharedContext.setData('selection', 'empty', {});
    const result = await sharedContext.getData('selection', 'empty');
    expect(result).toEqual({});
  });
});

describe('BaseAgent SharedContext integration', () => {
  let db: DbClient;
  let sharedContext: SharedContext;
  let messageBus: MessageBus;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
    messageBus = new MessageBus();
  });

  afterEach(async () => {
    await db.close();
  });

  test('writeToSharedContext writes using agent type', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    await agent.writeToSharedContext('products', { items: ['a', 'b'] });

    const result = await sharedContext.getData('selection', 'products');
    expect(result).toEqual({ items: ['a', 'b'] });
  });

  test('readFromSharedContext reads data from another agent', async () => {
    const selectionAgent = new TestAgent('selection', messageBus, sharedContext);
    const contentAgent = new TestAgent('content', messageBus, sharedContext);

    await selectionAgent.writeToSharedContext('products', { items: ['a'] });
    const result = await contentAgent.readFromSharedContext('selection', 'products');

    expect(result).toEqual({ items: ['a'] });
  });

  test('readFromSharedContext returns null for non-existent data', async () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    const result = await agent.readFromSharedContext('content', 'nonexistent');
    expect(result).toBeNull();
  });
});
