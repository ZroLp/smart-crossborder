﻿﻿﻿import { initDatabase } from '@/lib/db/init';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';

// taskId 用数字字符串：AgentProgressTracker.isStopped 以 task_logs.id
// (BIGINT) 查询，非数字 taskId 在 Postgres 下会使所有进度写操作抛错
// （lib 层迁移残留缺陷，见任务报告；见 tests/framework/agent-progress.test.ts 说明）。

describe('Agent Chain: Product Selection → Store Builder → Content Creator', () => {
  let db: ReturnType<typeof initDatabase>;
  let sharedContext: SharedContext;
  let progressTracker: AgentProgressTracker;

  beforeEach(() => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
    progressTracker = new AgentProgressTracker(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('product-selection writes data that store-builder can read', async () => {
    const productData = {
      category: 'electronics',
      products: [
        { id: 1, name: 'Wireless Mouse', price: 29.99 },
        { id: 2, name: 'Keyboard', price: 49.99 },
      ],
    };
    await sharedContext.setData('selection', 'product-data', productData);
    const result = await sharedContext.getData('selection', 'product-data');
    expect(result).not.toBeNull();
    expect((result as typeof productData)!.category).toBe('electronics');
    expect((result as typeof productData)!.products).toHaveLength(2);
    expect((result as typeof productData)!.products[0].name).toBe('Wireless Mouse');
  });

  test('store-builder reads product-data and writes store-data', async () => {
    await sharedContext.setData('selection', 'product-data', {
      category: 'home',
      products: [{ id: 1, name: 'Desk Lamp' }],
    });
    const productData = await sharedContext.getData('selection', 'product-data');
    expect(productData).not.toBeNull();
    await sharedContext.setData('store-builder', 'store-data', {
      theme: 'modern',
      products: productData,
    });
    const storeData = await sharedContext.getData('store-builder', 'store-data');
    expect(storeData).not.toBeNull();
    expect((storeData as { theme: string; products: unknown })!.theme).toBe('modern');
    expect((storeData as { theme: string; products: unknown })!.products).toEqual({
      category: 'home',
      products: [{ id: 1, name: 'Desk Lamp' }],
    });
  });

  test('content-creator can read store-data from store-builder', async () => {
    await sharedContext.setData('selection', 'product-data', {
      category: 'sports',
      products: [{ id: 1, name: 'Yoga Mat' }],
    });
    const productData = await sharedContext.getData('selection', 'product-data');
    await sharedContext.setData('store-builder', 'store-data', {
      storeName: 'SportZone',
      products: productData,
    });
    const storeData = await sharedContext.getData('store-builder', 'store-data');
    await sharedContext.setData('content', 'content-data', {
      listings: (storeData as { products: unknown })!.products,
      storeName: (storeData as { storeName: string })!.storeName,
    });
    const contentData = await sharedContext.getData('content', 'content-data');
    expect(contentData).not.toBeNull();
    expect((contentData as { storeName: string; listings: unknown })!.storeName).toBe('SportZone');
    expect((contentData as { storeName: string; listings: unknown })!.listings).toEqual({
      category: 'sports',
      products: [{ id: 1, name: 'Yoga Mat' }],
    });
  });

  test('full chain: product-data → store-data → content-data with progress tracking', async () => {
    await progressTracker.startTask('selection', '1');
    await progressTracker.startStep('selection', '1', AgentStep.DataCollection);
    await sharedContext.setData('selection', 'product-data', {
      category: 'fashion',
      products: [{ id: 1, name: 'T-Shirt', price: 19.99 }],
    });
    await progressTracker.completeStep('selection', '1', AgentStep.DataCollection);
    const productData = await sharedContext.getData('selection', 'product-data');
    expect((productData as { category: string })!.category).toBe('fashion');
    await progressTracker.startTask('store-builder', '2');
    await progressTracker.startStep('store-builder', '2', AgentStep.Execution);
    await sharedContext.setData('store-builder', 'store-data', {
      storeUrl: 'https://example.store',
      products: productData,
    });
    await progressTracker.completeStep('store-builder', '2', AgentStep.Execution);
    const storeData = await sharedContext.getData('store-builder', 'store-data');
    expect((storeData as { storeUrl: string })!.storeUrl).toBe('https://example.store');
    await progressTracker.startTask('content', '3');
    await progressTracker.startStep('content', '3', AgentStep.StrategyGeneration);
    await sharedContext.setData('content', 'content-data', {
      description: 'Fashion items',
      store: storeData,
    });
    await progressTracker.completeStep('content', '3', AgentStep.StrategyGeneration);
    const contentData = await sharedContext.getData('content', 'content-data');
    expect((contentData as { description: string; store: { storeUrl: string } })!.description).toBe('Fashion items');
    expect((contentData as { description: string; store: { storeUrl: string } })!.store!.storeUrl).toBe('https://example.store');
    const selProgress = await progressTracker.getProgress('selection', '1');
    expect(selProgress!.steps[0].status).toBe('completed');
    const storeProgress = await progressTracker.getProgress('store-builder', '2');
    expect(storeProgress!.steps[3].status).toBe('completed');
  });

  test('getHistory shows all records in correct order for an agent', async () => {
    await sharedContext.setData('selection', 'product-data', { category: 'electronics', products: [] });
    await sharedContext.setData('selection', 'filter-rules', { minPrice: 10 });
    await sharedContext.setData('selection', 'product-data', { category: 'electronics', products: [{ id: 1 }] });
    const history = await sharedContext.getHistory('selection');
    expect(history).toHaveLength(3);
    expect(history[0].key).toBe('product-data');
    expect(history[1].key).toBe('filter-rules');
    expect(history[2].key).toBe('product-data');
    expect(history[0].id).toBeLessThan(history[1].id);
    expect(history[1].id).toBeLessThan(history[2].id);
  });

  test('getHistory for specific key shows chronological order', async () => {
    await sharedContext.setData('selection', 'product-data', { version: 1 });
    await sharedContext.setData('selection', 'product-data', { version: 2 });
    await sharedContext.setData('selection', 'product-data', { version: 3 });
    const history = await sharedContext.getHistory('selection', 'product-data');
    expect(history).toHaveLength(3);
    expect(history[0].value).toEqual({ version: 1 });
    expect(history[1].value).toEqual({ version: 2 });
    expect(history[2].value).toEqual({ version: 3 });
  });

  test('getData returns the latest value when multiple entries exist', async () => {
    await sharedContext.setData('selection', 'product-data', { version: 1 });
    await sharedContext.setData('selection', 'product-data', { version: 2 });
    await sharedContext.setData('selection', 'product-data', { version: 3 });
    const result = await sharedContext.getData('selection', 'product-data');
    expect(result).toEqual({ version: 3 });
  });
});
