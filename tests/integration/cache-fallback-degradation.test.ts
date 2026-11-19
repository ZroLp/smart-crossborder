import { initDatabase } from '@/lib/db/init';
import { CacheFallback } from '@/lib/framework/cache-fallback';

describe('Cache Fallback Degradation', () => {
  let db: ReturnType<typeof initDatabase>;
  let cache: CacheFallback;

  beforeEach(() => {
    db = initDatabase(':memory:');
    cache = new CacheFallback(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('set data, get returns it with isStale=false', async () => {
    await cache.set('amazon', 'product-123', { name: 'Shoes', price: 29.99 });
    const result = await cache.get('amazon', 'product-123');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ name: 'Shoes', price: 29.99 });
    expect(result!.isStale).toBe(false);
  });

  test('set data with TTL=1ms, wait 10ms, get returns isStale=true', async () => {
    await cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await cache.get('amazon', 'product-123');
    expect(result).not.toBeNull();
    expect(result!.isStale).toBe(true);
    expect(result!.data).toEqual({ name: 'Shoes' });
  });

  test('get non-existent returns null', async () => {
    const result = await cache.get('amazon', 'nonexistent');
    expect(result).toBeNull();
  });

  test('invalidate removes entry, get returns null', async () => {
    await cache.set('amazon', 'product-123', { name: 'Shoes' });
    expect(await cache.get('amazon', 'product-123')).not.toBeNull();
    await cache.invalidate('amazon', 'product-123');
    const result = await cache.get('amazon', 'product-123');
    expect(result).toBeNull();
  });

  test('cleanExpired removes expired entries', async () => {
    await cache.set('amazon', 'expired', { name: 'Old' }, 1);
    await cache.set('amazon', 'fresh', { name: 'New' }, 3600000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cleaned = await cache.cleanExpired();
    expect(cleaned).toBe(1);
    expect(await cache.get('amazon', 'expired')).toBeNull();
    expect(await cache.get('amazon', 'fresh')).not.toBeNull();
  });

  test('set overrides existing entry (upsert behavior)', async () => {
    await cache.set('amazon', 'product-123', { name: 'Shoes' });
    expect((await cache.get('amazon', 'product-123'))!.data).toEqual({ name: 'Shoes' });
    await cache.set('amazon', 'product-123', { name: 'Boots' });
    const result = await cache.get('amazon', 'product-123');
    expect(result!.data).toEqual({ name: 'Boots' });
  });

  test('cache with complex nested data', async () => {
    const complexData = {
      products: [
        { id: 1, name: 'Item A', metadata: { weight: 1.5, tags: ['sale'] } },
        { id: 2, name: 'Item B', metadata: { weight: 2.0, tags: ['new'] } },
      ],
      pagination: { page: 1, total: 100 },
    };
    await cache.set('shopify', 'products', complexData);
    const result = await cache.get('shopify', 'products');
    expect(result!.data).toEqual(complexData);
  });

  test('get returns fetchedAt timestamp', async () => {
    await cache.set('amazon', 'product-1', { name: 'Test' });
    const result = await cache.get('amazon', 'product-1');
    expect(result!.fetchedAt).toBeDefined();
    expect(typeof result!.fetchedAt).toBe('string');
  });

  test('multiple sources with same key are independent', async () => {
    await cache.set('amazon', 'config', { mode: 'amazon-mode' });
    await cache.set('shopify', 'config', { mode: 'shopify-mode' });
    expect((await cache.get('amazon', 'config'))!.data).toEqual({ mode: 'amazon-mode' });
    expect((await cache.get('shopify', 'config'))!.data).toEqual({ mode: 'shopify-mode' });
    await cache.invalidate('amazon', 'config');
    expect(await cache.get('amazon', 'config')).toBeNull();
    expect(await cache.get('shopify', 'config')).not.toBeNull();
  });
});
