import Database from 'better-sqlite3';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';

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
    CREATE TABLE IF NOT EXISTS agent_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      task_id TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_agent_progress_task ON agent_progress(agent_type, task_id);
  `);
  return db;
}

describe('Agent Chain: Product Selection → Store Builder → Content Creator', () => {
  let db: Database.Database;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  test('product-selection writes data that store-builder can read', () => {
    const productData = {
      category: 'electronics',
      products: [
        { id: 1, name: 'Wireless Mouse', price: 29.99 },
        { id: 2, name: 'Keyboard', price: 49.99 },
      ],
    };
    sharedContext.setData('selection', 'product-data', productData);
    const result = sharedContext.getData('selection', 'product-data') as typeof productData;
    expect(result).not.toBeNull();
    expect(result!.category).toBe('electronics');
    expect(result!.products).toHaveLength(2);
    expect(result!.products[0].name).toBe('Wireless Mouse');
  });

  test('store-builder reads product-data and writes store-data', () => {
    sharedContext.setData('selection', 'product-data', {
      category: 'home',
      products: [{ id: 1, name: 'Desk Lamp' }],
    });
    const productData = sharedContext.getData('selection', 'product-data');
    expect(productData).not.toBeNull();
    sharedContext.setData('store-builder', 'store-data', {
      theme: 'modern',
      products: productData,
    });
    const storeData = sharedContext.getData('store-builder', 'store-data') as { theme: string; products: unknown };
    expect(storeData).not.toBeNull();
    expect(storeData!.theme).toBe('modern');
    expect(storeData!.products).toEqual({
      category: 'home',
      products: [{ id: 1, name: 'Desk Lamp' }],
    });
  });

  test('content-creator can read store-data from store-builder', () => {
    sharedContext.setData('selection', 'product-data', {
      category: 'sports',
      products: [{ id: 1, name: 'Yoga Mat' }],
    });
    const productData = sharedContext.getData('selection', 'product-data');
    sharedContext.setData('store-builder', 'store-data', {
      storeName: 'SportZone',
      products: productData,
    });
    const storeData = sharedContext.getData('store-builder', 'store-data');
    sharedContext.setData('content', 'content-data', {
      listings: storeData!.products,
      storeName: storeData!.storeName,
    });
    const contentData = sharedContext.getData('content', 'content-data') as { storeName: string; listings: unknown };
    expect(contentData).not.toBeNull();
    expect(contentData!.storeName).toBe('SportZone');
    expect(contentData!.listings).toEqual({
      category: 'sports',
      products: [{ id: 1, name: 'Yoga Mat' }],
    });
  });

  test('full chain: product-data → store-data → content-data with progress tracking', () => {
    progressTracker.startTask('selection', 'task-chain-1');
    progressTracker.startStep('selection', 'task-chain-1', AgentStep.DataCollection);
    sharedContext.setData('selection', 'product-data', {
      category: 'fashion',
      products: [{ id: 1, name: 'T-Shirt', price: 19.99 }],
    });
    progressTracker.completeStep('selection', 'task-chain-1', AgentStep.DataCollection);
    const productData = sharedContext.getData('selection', 'product-data') as { category: string };
    expect(productData!.category).toBe('fashion');
    progressTracker.startTask('store-builder', 'task-chain-2');
    progressTracker.startStep('store-builder', 'task-chain-2', AgentStep.Execution);
    sharedContext.setData('store-builder', 'store-data', {
      storeUrl: 'https://example.store',
      products: productData,
    });
    progressTracker.completeStep('store-builder', 'task-chain-2', AgentStep.Execution);
    const storeData = sharedContext.getData('store-builder', 'store-data') as { storeUrl: string };
    expect(storeData!.storeUrl).toBe('https://example.store');
    progressTracker.startTask('content', 'task-chain-3');
    progressTracker.startStep('content', 'task-chain-3', AgentStep.StrategyGeneration);
    sharedContext.setData('content', 'content-data', {
      description: 'Fashion items',
      store: storeData,
    });
    progressTracker.completeStep('content', 'task-chain-3', AgentStep.StrategyGeneration);
    const contentData = sharedContext.getData('content', 'content-data') as { description: string; store: { storeUrl: string } };
    expect(contentData!.description).toBe('Fashion items');
    expect(contentData!.store!.storeUrl).toBe('https://example.store');
    const selProgress = progressTracker.getProgress('selection', 'task-chain-1');
    expect(selProgress!.steps[0].status).toBe('completed');
    const storeProgress = progressTracker.getProgress('store-builder', 'task-chain-2');
    expect(storeProgress!.steps[3].status).toBe('completed');
  });

  test('getHistory shows all records in correct order for an agent', () => {
    sharedContext.setData('selection', 'product-data', { category: 'electronics', products: [] });
    sharedContext.setData('selection', 'filter-rules', { minPrice: 10 });
    sharedContext.setData('selection', 'product-data', { category: 'electronics', products: [{ id: 1 }] });
    const history = sharedContext.getHistory('selection');
    expect(history).toHaveLength(3);
    expect(history[0].key).toBe('product-data');
    expect(history[1].key).toBe('filter-rules');
    expect(history[2].key).toBe('product-data');
    expect(history[0].id).toBeLessThan(history[1].id);
    expect(history[1].id).toBeLessThan(history[2].id);
  });

  test('getHistory for specific key shows chronological order', () => {
    sharedContext.setData('selection', 'product-data', { version: 1 });
    sharedContext.setData('selection', 'product-data', { version: 2 });
    sharedContext.setData('selection', 'product-data', { version: 3 });
    const history = sharedContext.getHistory('selection', 'product-data');
    expect(history).toHaveLength(3);
    expect(history[0].value).toEqual({ version: 1 });
    expect(history[1].value).toEqual({ version: 2 });
    expect(history[2].value).toEqual({ version: 3 });
  });

  test('getData returns the latest value when multiple entries exist', () => {
    sharedContext.setData('selection', 'product-data', { version: 1 });
    sharedContext.setData('selection', 'product-data', { version: 2 });
    sharedContext.setData('selection', 'product-data', { version: 3 });
    const result = sharedContext.getData('selection', 'product-data');
    expect(result).toEqual({ version: 3 });
  });
});
