import Database from 'better-sqlite3';
import { SharedContext } from '@/lib/framework/shared-context';
import { SyncService } from '@/lib/framework/sync-service';

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

describe('SyncService', () => {
  let db: Database.Database;
  let sharedContext: SharedContext;
  let syncService: SyncService;

  beforeEach(() => {
    db = createTestDb();
    sharedContext = new SharedContext(db);
    syncService = new SyncService(db, sharedContext);
  });

  afterEach(() => {
    db.close();
  });

  describe('syncWrite and syncRead', () => {
    test('syncWrite stores data via SharedContext', () => {
      syncService.syncWrite('web', 'selection', 'products', { items: ['a', 'b'] });
      const result = sharedContext.getData('selection', 'products');
      expect(result).toEqual({ items: ['a', 'b'] });
    });

    test('syncRead retrieves data via SharedContext', () => {
      syncService.syncWrite('mobile', 'content', 'listings', { count: 5 });
      const result = syncService.syncRead('web', 'content', 'listings');
      expect(result).toEqual({ count: 5 });
    });

    test('syncRead returns null for non-existent key', () => {
      const result = syncService.syncRead('web', 'selection', 'nonexistent');
      expect(result).toBeNull();
    });

    test('web and mobile can write and read same key', () => {
      syncService.syncWrite('web', 'selection', 'config', { mode: 'auto' });
      const result = syncService.syncRead('mobile', 'selection', 'config');
      expect(result).toEqual({ mode: 'auto' });
    });
  });

  describe('sync events logging', () => {
    test('syncWrite logs a write event', () => {
      syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      const events = syncService.getSyncEvents();
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('web');
      expect(events[0].agentType).toBe('selection');
      expect(events[0].key).toBe('products');
      expect(events[0].action).toBe('write');
    });

    test('syncRead logs a read event', () => {
      syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      syncService.syncRead('mobile', 'selection', 'products');
      const events = syncService.getSyncEvents();
      expect(events).toHaveLength(2);
      expect(events[0].source).toBe('mobile');
      expect(events[0].action).toBe('read');
    });

    test('syncDelete logs a delete event', () => {
      syncService.syncWrite('web', 'selection', 'products', { items: ['a'] });
      syncService.syncDelete('mobile', 'selection', 'products');
      const events = syncService.getSyncEvents();
      expect(events[0].action).toBe('delete');
      expect(events[0].source).toBe('mobile');
    });

    test('events have correct structure', () => {
      syncService.syncWrite('web', 'selection', 'test', { value: 1 });
      const events = syncService.getSyncEvents();
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
    test('returns all events without filter', () => {
      syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      syncService.syncWrite('mobile', 'content', 'b', { v: 2 });
      syncService.syncRead('web', 'selection', 'a');

      const events = syncService.getSyncEvents();
      expect(events).toHaveLength(3);
    });

    test('filters by source', () => {
      syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      syncService.syncWrite('mobile', 'content', 'b', { v: 2 });
      syncService.syncRead('web', 'selection', 'a');

      const webEvents = syncService.getSyncEvents('web');
      expect(webEvents).toHaveLength(2);
      expect(webEvents.every((e) => e.source === 'web')).toBe(true);
    });

    test('filters by mobile source', () => {
      syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      syncService.syncWrite('mobile', 'content', 'b', { v: 2 });

      const mobileEvents = syncService.getSyncEvents('mobile');
      expect(mobileEvents).toHaveLength(1);
      expect(mobileEvents[0].source).toBe('mobile');
    });

    test('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        syncService.syncWrite('web', 'selection', `key${i}`, { v: i });
      }

      const events = syncService.getSyncEvents(undefined, 3);
      expect(events).toHaveLength(3);
    });

    test('returns events in descending order by id', () => {
      syncService.syncWrite('web', 'selection', 'a', { v: 1 });
      syncService.syncWrite('web', 'selection', 'b', { v: 2 });

      const events = syncService.getSyncEvents();
      expect(events[0].key).toBe('b');
      expect(events[1].key).toBe('a');
    });

    test('returns empty array when no events exist', () => {
      const events = syncService.getSyncEvents();
      expect(events).toEqual([]);
    });
  });

  describe('mutex locks', () => {
    test('acquireLock succeeds when resource is free', () => {
      const result = syncService.acquireLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('acquireLock fails when resource is already locked', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      const result = syncService.acquireLock('resource-1', 'holder-b');
      expect(result).toBe(false);
    });

    test('different holders cannot acquire same lock', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      expect(syncService.acquireLock('resource-1', 'holder-b')).toBe(false);
      expect(syncService.acquireLock('resource-1', 'holder-c')).toBe(false);
    });

    test('same holder can re-acquire after release', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      syncService.releaseLock('resource-1', 'holder-a');
      const result = syncService.acquireLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('releaseLock returns true when lock exists', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      const result = syncService.releaseLock('resource-1', 'holder-a');
      expect(result).toBe(true);
    });

    test('releaseLock returns false when lock does not exist', () => {
      const result = syncService.releaseLock('resource-1', 'holder-a');
      expect(result).toBe(false);
    });

    test('releaseLock returns false when holder does not match', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      const result = syncService.releaseLock('resource-1', 'holder-b');
      expect(result).toBe(false);
    });

    test('isLocked returns true when resource is locked', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      expect(syncService.isLocked('resource-1')).toBe(true);
    });

    test('isLocked returns false when resource is not locked', () => {
      expect(syncService.isLocked('resource-1')).toBe(false);
    });

    test('isLocked returns false after lock is released', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      syncService.releaseLock('resource-1', 'holder-a');
      expect(syncService.isLocked('resource-1')).toBe(false);
    });

    test('getLockHolder returns holder when resource is locked', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      expect(syncService.getLockHolder('resource-1')).toBe('holder-a');
    });

    test('getLockHolder returns null when resource is not locked', () => {
      expect(syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('getLockHolder returns null after lock is released', () => {
      syncService.acquireLock('resource-1', 'holder-a');
      syncService.releaseLock('resource-1', 'holder-a');
      expect(syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('multiple resources can be locked independently', () => {
      expect(syncService.acquireLock('resource-1', 'holder-a')).toBe(true);
      expect(syncService.acquireLock('resource-2', 'holder-b')).toBe(true);
      expect(syncService.isLocked('resource-1')).toBe(true);
      expect(syncService.isLocked('resource-2')).toBe(true);
      expect(syncService.getLockHolder('resource-1')).toBe('holder-a');
      expect(syncService.getLockHolder('resource-2')).toBe('holder-b');
    });

    test('expired locks are automatically cleaned up', () => {
      syncService.acquireLock('resource-1', 'holder-a');

      db.prepare("UPDATE mutex_locks SET acquired_at = datetime('now', '-60 seconds') WHERE resource = ?").run('resource-1');

      expect(syncService.isLocked('resource-1')).toBe(false);
      expect(syncService.getLockHolder('resource-1')).toBeNull();
    });

    test('expired lock can be re-acquired by different holder', () => {
      syncService.acquireLock('resource-1', 'holder-a');

      db.prepare("UPDATE mutex_locks SET acquired_at = datetime('now', '-60 seconds') WHERE resource = ?").run('resource-1');

      expect(syncService.acquireLock('resource-1', 'holder-b')).toBe(true);
      expect(syncService.getLockHolder('resource-1')).toBe('holder-b');
    });
  });
});
