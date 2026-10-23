import Database from 'better-sqlite3';
import { CacheFallback } from '@/lib/framework/cache-fallback';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('Cache Fallback Degradation', () => {
  let db: Database.Database;
  let cache: CacheFallback;

  beforeEach(() => {
    db = createTestDb();
    cache = new CacheFallback(db);
  });

  afterEach(() => {
    db.close();
  });

  test('set data, get returns it with isStale=false', () => {
    cache.set('amazon', 'product-123', { name: 'Shoes', price: 29.99 });
    const result = cache.get('amazon', 'product-123');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ name: 'Shoes', price: 29.99 });
    expect(result!.isStale).toBe(false);
  });

  test('set data with TTL=1ms, wait 10ms, get returns isStale=true', () => {
    cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = cache.get('amazon', 'product-123');
        expect(result).not.toBeNull();
        expect(result!.isStale).toBe(true);
        expect(result!.data).toEqual({ name: 'Shoes' });
        resolve();
      }, 10);
    });
  });

  test('get non-existent returns null', () => {
    const result = cache.get('amazon', 'nonexistent');
    expect(result).toBeNull();
  });

  test('invalidate removes entry, get returns null', () => {
    cache.set('amazon', 'product-123', { name: 'Shoes' });
    expect(cache.get('amazon', 'product-123')).not.toBeNull();
    cache.invalidate('amazon', 'product-123');
    const result = cache.get('amazon', 'product-123');
    expect(result).toBeNull();
  });

  test('cleanExpired removes expired entries', () => {
    cache.set('amazon', 'expired', { name: 'Old' }, 1);
    cache.set('amazon', 'fresh', { name: 'New' }, 3600000);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const cleaned = cache.cleanExpired();
        expect(cleaned).toBe(1);
        expect(cache.get('amazon', 'expired')).toBeNull();
        expect(cache.get('amazon', 'fresh')).not.toBeNull();
        resolve();
      }, 10);
    });
  });

  test('set overrides existing entry (upsert behavior)', () => {
    cache.set('amazon', 'product-123', { name: 'Shoes' });
    expect(cache.get('amazon', 'product-123')!.data).toEqual({ name: 'Shoes' });
    cache.set('amazon', 'product-123', { name: 'Boots' });
    const result = cache.get('amazon', 'product-123');
    expect(result!.data).toEqual({ name: 'Boots' });
  });

  test('cache with complex nested data', () => {
    const complexData = {
      products: [
        { id: 1, name: 'Item A', metadata: { weight: 1.5, tags: ['sale'] } },
        { id: 2, name: 'Item B', metadata: { weight: 2.0, tags: ['new'] } },
      ],
      pagination: { page: 1, total: 100 },
    };
    cache.set('shopify', 'products', complexData);
    const result = cache.get('shopify', 'products');
    expect(result!.data).toEqual(complexData);
  });

  test('get returns fetchedAt timestamp', () => {
    cache.set('amazon', 'product-1', { name: 'Test' });
    const result = cache.get('amazon', 'product-1');
    expect(result!.fetchedAt).toBeDefined();
    expect(typeof result!.fetchedAt).toBe('string');
  });

  test('multiple sources with same key are independent', () => {
    cache.set('amazon', 'config', { mode: 'amazon-mode' });
    cache.set('shopify', 'config', { mode: 'shopify-mode' });
    expect(cache.get('amazon', 'config')!.data).toEqual({ mode: 'amazon-mode' });
    expect(cache.get('shopify', 'config')!.data).toEqual({ mode: 'shopify-mode' });
    cache.invalidate('amazon', 'config');
    expect(cache.get('amazon', 'config')).toBeNull();
    expect(cache.get('shopify', 'config')).not.toBeNull();
  });
});
