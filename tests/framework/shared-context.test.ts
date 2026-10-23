import Database from 'better-sqlite3';
import { SharedContext } from '@/lib/framework/shared-context';
import { MessageBus } from '@/lib/framework/message-bus';
import { BaseAgent } from '@/lib/framework/base-agent';
import { AgentResult, AgentType } from '@/lib/framework/types';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_shared_context_agent_key ON shared_context(agent_type, key);
  `);
  return db;
}

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
  let db: Database.Database;
  let sharedContext: SharedContext;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
  });

  afterEach(() => {
    db.close();
  });

  test('setData and getData basic operations', () => {
    sharedContext.setData('selection', 'products', { items: ['a', 'b'] });
    const result = sharedContext.getData('selection', 'products');
    expect(result).toEqual({ items: ['a', 'b'] });
  });

  test('getData returns null for non-existent key', () => {
    const result = sharedContext.getData('selection', 'nonexistent');
    expect(result).toBeNull();
  });

  test('namespace isolation - different agentTypes with same key', () => {
    sharedContext.setData('selection', 'config', { mode: 'auto' });
    sharedContext.setData('content', 'config', { mode: 'manual' });

    const selectionConfig = sharedContext.getData('selection', 'config');
    const contentConfig = sharedContext.getData('content', 'config');

    expect(selectionConfig).toEqual({ mode: 'auto' });
    expect(contentConfig).toEqual({ mode: 'manual' });
  });

  test('getData returns latest value for same agentType and key', () => {
    sharedContext.setData('selection', 'status', { step: 1 });
    sharedContext.setData('selection', 'status', { step: 2 });

    const result = sharedContext.getData('selection', 'status');
    expect(result).toEqual({ step: 2 });
  });

  test('getHistory returns chronological records for specific key', () => {
    sharedContext.setData('selection', 'status', { step: 1 });
    sharedContext.setData('selection', 'status', { step: 2 });
    sharedContext.setData('selection', 'status', { step: 3 });

    const history = sharedContext.getHistory('selection', 'status');
    expect(history).toHaveLength(3);
    expect(history[0].value).toEqual({ step: 1 });
    expect(history[1].value).toEqual({ step: 2 });
    expect(history[2].value).toEqual({ step: 3 });
  });

  test('getHistory returns all records for agentType when key is omitted', () => {
    sharedContext.setData('selection', 'products', { items: ['a'] });
    sharedContext.setData('selection', 'status', { step: 1 });
    sharedContext.setData('content', 'listings', { items: ['x'] });

    const history = sharedContext.getHistory('selection');
    expect(history).toHaveLength(2);
    expect(history[0].key).toBe('products');
    expect(history[1].key).toBe('status');
  });

  test('getHistory returns empty array for non-existent agentType', () => {
    const history = sharedContext.getHistory('fulfillment');
    expect(history).toEqual([]);
  });

  test('getHistory records have correct structure', () => {
    sharedContext.setData('selection', 'test', { value: 42 });

    const history = sharedContext.getHistory('selection', 'test');
    expect(history).toHaveLength(1);
    expect(history[0]).toHaveProperty('id');
    expect(history[0]).toHaveProperty('agentType', 'selection');
    expect(history[0]).toHaveProperty('key', 'test');
    expect(history[0]).toHaveProperty('value');
    expect(history[0]).toHaveProperty('createdAt');
    expect(typeof history[0].id).toBe('number');
    expect(typeof history[0].createdAt).toBe('string');
  });

  test('clear removes data for specific key', () => {
    sharedContext.setData('selection', 'products', { items: ['a'] });
    sharedContext.setData('selection', 'status', { step: 1 });

    sharedContext.clear('selection', 'products');

    expect(sharedContext.getData('selection', 'products')).toBeNull();
    expect(sharedContext.getData('selection', 'status')).toEqual({ step: 1 });
  });

  test('clear removes all data for agentType when key is omitted', () => {
    sharedContext.setData('selection', 'products', { items: ['a'] });
    sharedContext.setData('selection', 'status', { step: 1 });
    sharedContext.setData('content', 'listings', { items: ['x'] });

    sharedContext.clear('selection');

    expect(sharedContext.getData('selection', 'products')).toBeNull();
    expect(sharedContext.getData('selection', 'status')).toBeNull();
    expect(sharedContext.getData('content', 'listings')).toEqual({ items: ['x'] });
  });

  test('JSON serialization and deserialization preserves complex data', () => {
    const complexData = {
      nested: { deep: { value: 123 } },
      array: [1, 'two', false, null],
      boolean: true,
      number: 3.14,
      string: 'hello',
    };

    sharedContext.setData('selection', 'complex', complexData);
    const result = sharedContext.getData('selection', 'complex');
    expect(result).toEqual(complexData);
  });

  test('JSON serialization handles empty object', () => {
    sharedContext.setData('selection', 'empty', {});
    const result = sharedContext.getData('selection', 'empty');
    expect(result).toEqual({});
  });
});

describe('BaseAgent SharedContext integration', () => {
  let db: Database.Database;
  let sharedContext: SharedContext;
  let messageBus: MessageBus;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
    messageBus = new MessageBus();
  });

  afterEach(() => {
    db.close();
  });

  test('writeToSharedContext writes using agent type', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    agent.writeToSharedContext('products', { items: ['a', 'b'] });

    const result = sharedContext.getData('selection', 'products');
    expect(result).toEqual({ items: ['a', 'b'] });
  });

  test('readFromSharedContext reads data from another agent', () => {
    const selectionAgent = new TestAgent('selection', messageBus, sharedContext);
    const contentAgent = new TestAgent('content', messageBus, sharedContext);

    selectionAgent.writeToSharedContext('products', { items: ['a'] });
    const result = contentAgent.readFromSharedContext('selection', 'products');

    expect(result).toEqual({ items: ['a'] });
  });

  test('readFromSharedContext returns null for non-existent data', () => {
    const agent = new TestAgent('selection', messageBus, sharedContext);
    const result = agent.readFromSharedContext('content', 'nonexistent');
    expect(result).toBeNull();
  });
});
