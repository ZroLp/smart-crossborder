import { SharedContext } from '@/lib/framework/shared-context';
import { SyncService } from '@/lib/framework/sync-service';
import { initDatabase } from '@/lib/db/init';
import { DbClient } from '@/lib/db/client';

describe('SyncService', () => {
  let db: DbClient;
  let sharedContext: SharedContext;
  let syncService: SyncService;

  beforeEach(async () => {
    db = initDatabase(':memory:');
    sharedContext = new SharedContext(db);
    syncService = new SyncService(db, sharedContext);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('syncWrite and syncRead', () => {
    test('syncWrite stores data via SharedContext', async () => {
      await syncService.syncWrite('web', 'selection', 'products', { items: ['a', 'b'] });
      const result = await sharedContext.getData('selection', 'products');
      expect(result).toEqual({ items: ['a', 'b'] });
    });

    test('syncRead retrieves data via SharedContext', async () => {
      await syncService.syncWrite('mobile', 'content', 'listings', { count: 5 });
      const result = await syncService.syncRead('web', 'content', 'listings');
      expect(result).toEqual({ count: 5 });
    });

    test('syncRead returns null for non-existent key', async () => {
      const result = await syncService.syncRead('web', 'selection', 'nonexistent');
      expect(result).toBeNull();
    });

    test('web and mobile can write and read same key', async () => {
      await syncService.syncWrite('web', 'selection', 'config', { mode: 'auto' });
      const result = await syncService.syncRead('mobile', 'selection', 'config');
      expect(result).toEqual({ mode: 'auto' });
    });
  });

  describe('sync events logging', () => {
    test('syncWrite logs a write event', async () => {
      await syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      const events = await syncService.getSyncEvents();
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('web');
      expect(events[0].agentType).toBe('selection');
      expect(events[0].key).toBe('products');
      expect(events[0].action).toBe('write');
    });

    test('syncRead logs a read event', async () => {
      await syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      await syncService.syncRead('mobile', 'selection', 'products');
      const events = await syncService.getSyncEvents();
      expect(events).toHaveLength(2);
      expect(events[0].source).toBe('mobile');
      expect(events[0].action).toBe('read');
    });

    test('syncDelete logs a delete event', async () => {
      await syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      await syncService.syncDelete('mobile', 'selection', 'products');
      const events = await syncService.getSyncEvents();
      expect(events[0].action).toBe('delete');
      expect(events[0].source).toBe('mobile');
    });

    test('events have correct structure', async () => {
      await syncService.syncWrite('web', 'selection', 'test', { value: 1 });
      const events = await syncService.getSyncEvents();
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('source', 'web');
      expect(events[0]).toHaveProperty('agentType', 'selection');
      expect(events[0]).toHaveProperty('key', 'test');
      expect(events[0]).toHaveProperty('action', 'write');
      expect(events[0]).toHaveProperty('timestamp');
      expect(typeof events[0].id).toBe('number');
      expect(typeof events[0].timestamp).toBe('string');
    });
  });

  describe('getSyncEvents', () => {
    test('returns all events without filter', async () => {
      await syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      await syncService.syncWrite('mobile', 'content', 'b', { v: 2 });
      await syncService.syncRead('web', 'selection', 'a');

      const events = await syncService.getSyncEvents();
      expect(events).toHaveLength(3);
    });

    test('filters by source', async () => {
      await syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      await syncService.syncWrite('mobile', 'content', 'b', { v: 2 });
      await syncService.syncRead('web', 'selection', 'a');

      const webEvents = await syncService.getSyncEvents('web');
      expect(webEvents).toHaveLength(2);
      expect(webEvents.every((e) => e.source === 'web')).toBe(true);
    });

    test('filters by mobile source', async () => {
      await syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      await syncService.syncWrite('mobile', 'content', 'b', { v: 2 });

      const mobileEvents = await syncService.getSyncEvents('mobile');
      expect(mobileEvents).toHaveLength(1);
      expect(mobileEvents[0].source).toBe('mobile');
    });

    test('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await syncService.syncWrite('web', 'selection', `key${i}`, { v: i });
      }

      const events = await syncService.getSyncEvents(undefined, 3);
      expect(events).toHaveLength(3);
    });

    test('returns events in descending order by id', async () => {
      await syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      await syncService.syncWrite('web', 'selection', 'b', { v: 2 });

      const events = await syncService.getSyncEvents();
      expect(events[0].key).toBe('b');
      expect(events[1].key).toBe('a');
    });

    test('returns empty array when no events exist', async () => {
      const events = await syncService.getSyncEvents();
      expect(events).toEqual([]);
    });
  });

  describe('mutex locks', () => {
    test('acquireLock succeeds when resource is free', async () => {
      const result = await syncService.acquireLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('acquireLock fails when resource is already locked', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      const result = await syncService.acquireLock('resource-1', 'holder-b');
      expect(result).toBe(false);
    });

    test('different holders cannot acquire same lock', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      expect(await syncService.acquireLock('resource-1', 'holder-b')).toBe(false);
      expect(await syncService.acquireLock('resource-1', 'holder-c')).toBe(false);
    });

    test('same holder can re-acquire after release', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      await syncService.releaseLock('resource-1', 'holder-a');
      const result = await syncService.acquireLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('releaseLock returns true when lock exists', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      const result = await syncService.releaseLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('releaseLock returns false when lock does not exist', async () => {
      const result = await syncService.releaseLock('resource-1', 'holder-a');
      expect(result).toBe(false);
    });

    test('releaseLock returns false when holder does not match', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      const result = await syncService.releaseLock('resource-1', 'holder-b');
      expect(result).toBe(false);
    });

    test('isLocked returns true when resource is locked', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      expect(await syncService.isLocked('resource-1')).toBe(true);
    });

    test('isLocked returns false when resource is not locked', async () => {
      expect(await syncService.isLocked('resource-1')).toBe(false);
    });

    test('isLocked returns false after lock is released', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      await syncService.releaseLock('resource-1', 'holder-a');
      expect(await syncService.isLocked('resource-1')).toBe(false);
    });

    test('getLockHolder returns holder when resource is locked', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      expect(await syncService.getLockHolder('resource-1')).toBe('holder-a');
    });

    test('getLockHolder returns null when resource is not locked', async () => {
      expect(await syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('getLockHolder returns null after lock is released', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');
      await syncService.releaseLock('resource-1', 'holder-a');
      expect(await syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('multiple resources can be locked independently', async () => {
      expect(await syncService.acquireLock('resource-1', 'holder-a')).toBe(true);
      expect(await syncService.acquireLock('resource-2', 'holder-b')).toBe(true);
      expect(await syncService.isLocked('resource-1')).toBe(true);
      expect(await syncService.isLocked('resource-2')).toBe(true);
      expect(await syncService.getLockHolder('resource-1')).toBe('holder-a');
      expect(await syncService.getLockHolder('resource-2')).toBe('holder-b');
    });

    test('expired locks are automatically cleaned up', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');

      await db.prepare("UPDATE mutex_locks SET acquired_at = now() - interval '60 seconds' WHERE resource = ?").run('resource-1');

      expect(await syncService.isLocked('resource-1')).toBe(false);
      expect(await syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('expired lock can be re-acquired by different holder', async () => {
      await syncService.acquireLock('resource-1', 'holder-a');

      await db.prepare("UPDATE mutex_locks SET acquired_at = now() - interval '60 seconds' WHERE resource = ?").run('resource-1');

      expect(await syncService.acquireLock('resource-1', 'holder-b')).toBe(true);
      expect(await syncService.getLockHolder('resource-1')).toBe('holder-b');
    });
  });
});
