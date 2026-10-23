import Database from 'better-sqlite3';
import { CacheFallback } from '@/lib/framework/cache-fallback';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('CacheFallback', () => {
  let db: Database.Database;
  let cache: CacheFallback;

  beforeEach(() => {
    db = createTestDb();
    cache = new CacheFallback(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('set and get basic operations', () => {
    test('stores and retrieves data', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes', price: 29.99 });
      const result = cache.get('amazon', 'product-123');
      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ name: 'Shoes', price: 29.99 });
    });

    test('returns null for non-existent key', () => {
      const result = cache.get('amazon', 'nonexistent');
      expect(result).toBeNull();
    });

    test('returns null for non-existent source', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = cache.get('shopify', 'product-123');
      expect(result).toBeNull();
    });

    test('overwrites existing entry on set', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      cache.set('amazon', 'product-123', { name: 'Boots' });
      const result = cache.get('amazon', 'product-123');
      expect(result!.data).toEqual({ name: 'Boots' });
    });

    test('different sources with same key are independent', () => {
      cache.set('amazon', 'product-123', { name: 'Amazon Shoes' });
      cache.set('shopify', 'product-123', { name: 'Shopify Shoes' });

      const amazonResult = cache.get('amazon', 'product-123');
      const shopifyResult = cache.get('shopify', 'product-123');

      expect(amazonResult!.data).toEqual({ name: 'Amazon Shoes' });
      expect(shopifyResult!.data).toEqual({ name: 'Shopify Shoes' });
    });

    test('get returns fetchedAt timestamp', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = cache.get('amazon', 'product-123');
      expect(result!.fetchedAt).toBeDefined();
      expect(typeof result!.fetchedAt).toBe('string');
    });

    test('handles complex nested data', () => {
      const complexData = {
        nested: { deep: { value: 123 } },
        array: [1, 'two', false, null],
        boolean: true,
      };
      cache.set('amazon', 'complex', complexData);
      const result = cache.get('amazon', 'complex');
      expect(result!.data).toEqual(complexData);
    });
  });

  describe('isStale flag', () => {
    test('fresh data has isStale false', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const result = cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(false);
    });

    test('expired data has isStale true', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = cache.get('amazon', 'product-123');
          expect(result!.isStale).toBe(true);
          resolve();
        }, 10);
      });
    });

    test('stale data is still returned', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = cache.get('amazon', 'product-123');
          expect(result).not.toBeNull();
          expect(result!.data).toEqual({ name: 'Shoes' });
          expect(result!.isStale).toBe(true);
          resolve();
        }, 10);
      });
    });

    test('data with no TTL is never stale', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      const result = cache.get('amazon', 'product-123');
      expect(result!.isStale).toBe(false);
    });
  });

  describe('invalidate', () => {
    test('removes cache entry', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      cache.invalidate('amazon', 'product-123');
      const result = cache.get('amazon', 'product-123');
      expect(result).toBeNull();
    });

    test('does not affect other entries', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      cache.set('amazon', 'product-456', { name: 'Boots' });
      cache.invalidate('amazon', 'product-123');
      expect(cache.get('amazon', 'product-123')).toBeNull();
      expect(cache.get('amazon', 'product-456')!.data).toEqual({ name: 'Boots' });
    });

    test('does not affect other sources', () => {
      cache.set('amazon', 'product-123', { name: 'Amazon Shoes' });
      cache.set('shopify', 'product-123', { name: 'Shopify Shoes' });
      cache.invalidate('amazon', 'product-123');
      expect(cache.get('amazon', 'product-123')).toBeNull();
      expect(cache.get('shopify', 'product-123')!.data).toEqual({ name: 'Shopify Shoes' });
    });

    test('invalidate non-existent entry does not throw', () => {
      expect(() => cache.invalidate('amazon', 'nonexistent')).not.toThrow();
    });
  });

  describe('cleanExpired', () => {
    test('removes expired entries', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);
      cache.set('amazon', 'product-456', { name: 'Boots' }, 1);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = cache.cleanExpired();
          expect(cleaned).toBe(2);
          expect(cache.get('amazon', 'product-123')).toBeNull();
          expect(cache.get('amazon', 'product-456')).toBeNull();
          resolve();
        }, 10);
      });
    });

    test('does not remove non-expired entries', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const cleaned = cache.cleanExpired();
      expect(cleaned).toBe(0);
      expect(cache.get('amazon', 'product-123')).not.toBeNull();
    });

    test('removes only expired entries', () => {
      cache.set('amazon', 'expired', { name: 'Old' }, 1);
      cache.set('amazon', 'fresh', { name: 'New' }, 3600000);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = cache.cleanExpired();
          expect(cleaned).toBe(1);
          expect(cache.get('amazon', 'expired')).toBeNull();
          expect(cache.get('amazon', 'fresh')!.data).toEqual({ name: 'New' });
          resolve();
        }, 10);
      });
    });

    test('returns 0 when no expired entries', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 3600000);
      const cleaned = cache.cleanExpired();
      expect(cleaned).toBe(0);
    });

    test('does not remove entries with no TTL', () => {
      cache.set('amazon', 'permanent', { name: 'Forever' });
      const cleaned = cache.cleanExpired();
      expect(cleaned).toBe(0);
      expect(cache.get('amazon', 'permanent')).not.toBeNull();
    });
  });

  describe('TTL behavior', () => {
    test('default TTL is 1 hour', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' });
      const row = db.prepare('SELECT expires_at FROM data_cache WHERE source = ? AND key = ?').get('amazon', 'product-123') as { expires_at: string };
      const expiresAt = new Date(row.expires_at).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      expect(diff).toBeGreaterThan(3500000);
      expect(diff).toBeLessThanOrEqual(3600000);
    });

    test('custom TTL is respected', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 60000);
      const row = db.prepare('SELECT expires_at FROM data_cache WHERE source = ? AND key = ?').get('amazon', 'product-123') as { expires_at: string };
      const expiresAt = new Date(row.expires_at).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      expect(diff).toBeGreaterThan(50000);
      expect(diff).toBeLessThanOrEqual(60000);
    });

    test('updating entry resets TTL', () => {
      cache.set('amazon', 'product-123', { name: 'Shoes' }, 1);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('amazon', 'product-123')!.isStale).toBe(true);

          cache.set('amazon', 'product-123', { name: 'Updated Shoes' }, 3600000);
          const result = cache.get('amazon', 'product-123');
          expect(result!.isStale).toBe(false);
          expect(result!.data).toEqual({ name: 'Updated Shoes' });
          resolve();
        }, 10);
      });
    });
  });
});
