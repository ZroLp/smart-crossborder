import { CacheFallback } from '@/lib/framework/cache-fallback';
import { initDatabase } from '@/lib/db/init';
import { DbClient } from '@/lib/db/client';

describe('CacheFallback', () => {
  let db: DbClient;
  let cache: CacheFallback;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    cache = new CacheFallback(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('set and get basic operations', () => {
    test('stores and retrieves data', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes', price: 29.99 });
      const result = await cache.get('amazon', 'product-123');
      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ name: 'Shoes', price: 29.99 });
    });

    test('returns null for non-existent key', async () => {
      const result = await cache.get('amazon', 'nonexistent');
      expect(result).toBeNull();
    });

    test('returns null for non-existent source', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = await cache.get('shopify', 'product-123');
      expect(result).toBeNull();
    });

    test('overwrites existing entry on set', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      await cache.set('amazon', 'product-123', { name: 'Boots' });
      const result = await cache.get('amazon', 'product-123');
      expect(result!.data).toEqual({ name: 'Boots' });
    });

    test('different sources with same key are independent', async () => {
      await cache.set('amazon', 'product-123', { name: 'Amazon Shoes' });
      await cache.set('shopify', 'product-123', { name: 'Shopify Shoes' });

      const amazonResult = await cache.get('amazon', 'product-123');
      const shopifyResult = await cache.get('shopify', 'product-123');

      expect(amazonResult!.data).toEqual({ name: 'Amazon Shoes' });
      expect(shopifyResult!.data).toEqual({ name: 'Shopify Shoes' });
    });

    test('get returns fetchedAt timestamp', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = await cache.get('amazon', 'product-123');
      expect(result!.fetchedAt).toBeDefined();
      expect(typeof result!.fetchedAt).toBe('string');
    });

    test('handles complex nested data', async () => {
      const complexData = {
        nested: { deep: { value: 123 } },
        array: [1, 'two', false, null],
        boolean: true,
      };
      await cache.set('amazon', 'complex', complexData);
      const result = await cache.get('amazon', 'complex');
      expect(result!.data).toEqual(complexData);
    });
  });

  describe('isStale flag', () => {
    test('fresh data has isStale false', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const result = await cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(false);
    });

    test('expired data has isStale true', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(true);
    });

    test('stale data is still returned', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await cache.get('amazon', 'product-123');
      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ name: 'Shoes' });
      expect(result!.isStale).toBe(true);
    });

    test('data with no TTL is never stale', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = await cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(false);
    });
  });

  describe('invalidate', () => {
    test('removes cache entry', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      await cache.invalidate('amazon', 'product-123');
      const result = await cache.get('amazon', 'product-123');
      expect(result).toBeNull();
    });

    test('does not affect other entries', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      await cache.set('amazon', 'product-456', { name: 'Boots' });
      await cache.invalidate('amazon', 'product-123');
      expect(await cache.get('amazon', 'product-123')).toBeNull();
      expect((await cache.get('amazon', 'product-456'))!.data).toEqual({ name: 'Boots' });
    });

    test('does not affect other sources', async () => {
      await cache.set('amazon', 'product-123', { name: 'Amazon Shoes' });
      await cache.set('shopify', 'product-123', { name: 'Shopify Shoes' });
      await cache.invalidate('amazon', 'product-123');
      expect(await cache.get('amazon', 'product-123')).toBeNull();
      expect((await cache.get('shopify', 'product-123'))!.data).toEqual({ name: 'Shopify Shoes' });
    });

    test('invalidate non-existent entry does not throw', async () => {
      await expect(cache.invalidate('amazon', 'nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cleanExpired', () => {
    test('removes expired entries', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);
      await cache.set('amazon', 'product-456', { name: 'Boots' }, 1);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const cleaned = await cache.cleanExpired();
      expect(cleaned).toBe(2);
      expect(await cache.get('amazon', 'product-123')).toBeNull();
      expect(await cache.get('amazon', 'product-456')).toBeNull();
    });

    test('does not remove non-expired entries', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const cleaned = await cache.cleanExpired();
      expect(cleaned).toBe(0);
      expect(await cache.get('amazon', 'product-123')).not.toBeNull();
    });

    test('removes only expired entries', async () => {
      await cache.set('amazon', 'expired', { name: 'Old' }, 1);
      await cache.set('amazon', 'fresh', { name: 'New' }, 3600000);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const cleaned = await cache.cleanExpired();
      expect(cleaned).toBe(1);
      expect(await cache.get('amazon', 'expired')).toBeNull();
      expect((await cache.get('amazon', 'fresh'))!.data).toEqual({ name: 'New' });
    });

    test('returns 0 when no expired entries', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const cleaned = await cache.cleanExpired();
      expect(cleaned).toBe(0);
    });

    test('does not remove entries with no TTL', async () => {
      await cache.set('amazon', 'permanent', { name: 'Forever' });
      const cleaned = await cache.cleanExpired();
      expect(cleaned).toBe(0);
      expect(await cache.get('amazon', 'permanent')).not.toBeNull();
    });
  });

  describe('TTL behavior', () => {
    test('default TTL is 1 hour', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' });
      const row = (await db.prepare('SELECT expires_at FROM data_cache WHERE source = ? AND key = ?').get('amazon', 'product-123')) as { expires_at: string };
      const expiresAt = new Date(row.expires_at).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      expect(diff).toBeGreaterThan(3500000);
      expect(diff).toBeLessThanOrEqual(3600000);
    });

    test('custom TTL is respected', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 60000);
      const row = (await db.prepare('SELECT expires_at FROM data_cache WHERE source = ? AND key = ?').get('amazon', 'product-123')) as { expires_at: string };
      const expiresAt = new Date(row.expires_at).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      expect(diff).toBeGreaterThan(50000);
      expect(diff).toBeLessThanOrEqual(60000);
    });

    test('updating entry resets TTL', async () => {
      await cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect((await cache.get('amazon', 'product-123'))!.isStale).toBe(true);

      await cache.set('amazon', 'product-123', { name: 'Updated Shoes' }, 3600000);
      const result = await cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(false);
      expect(result!.data).toEqual({ name: 'Updated Shoes' });
    });
  });
});
