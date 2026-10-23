import Database from 'better-sqlite3';
import { TaskLock } from '@/lib/framework/task-lock';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('TaskLock', () => {
  let db: Database.Database;
  let taskLock: TaskLock;

  beforeEach(() => {
    db = createTestDb();
    taskLock = new TaskLock(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('acquire and release', () => {
    test('acquire succeeds when resource is free', () => {
      const result = taskLock.acquire('product-123', 'selection', 'task-1');
      expect(result).toBe(true);
    });

    test('release succeeds when lock exists and matches', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const result = taskLock.release('product-123', 'selection', 'task-1');
      expect(result).toBe(true);
    });

    test('release returns false when lock does not exist', () => {
      const result = taskLock.release('product-123', 'selection', 'task-1');
      expect(result).toBe(false);
    });

    test('release returns false when agentType does not match', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const result = taskLock.release('product-123', 'content', 'task-1');
      expect(result).toBe(false);
    });

    test('release returns false when taskId does not match', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const result = taskLock.release('product-123', 'selection', 'task-2');
      expect(result).toBe(false);
    });

    test('can re-acquire after release', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.release('product-123', 'selection', 'task-1');
      const result = taskLock.acquire('product-123', 'content', 'task-2');
      expect(result).toBe(true);
    });
  });

  describe('isLocked and getLockInfo', () => {
    test('isLocked returns true when resource is locked', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      expect(taskLock.isLocked('product-123')).toBe(true);
    });

    test('isLocked returns false when resource is not locked', () => {
      expect(taskLock.isLocked('product-123')).toBe(false);
    });

    test('isLocked returns false after release', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.release('product-123', 'selection', 'task-1');
      expect(taskLock.isLocked('product-123')).toBe(false);
    });

    test('getLockInfo returns lock details', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const info = taskLock.getLockInfo('product-123');
      expect(info).not.toBeNull();
      expect(info!.resource).toBe('product-123');
      expect(info!.agentType).toBe('selection');
      expect(info!.taskId).toBe('task-1');
      expect(info!.id).toBeDefined();
      expect(info!.acquiredAt).toBeDefined();
    });

    test('getLockInfo returns null when resource is not locked', () => {
      const info = taskLock.getLockInfo('product-123');
      expect(info).toBeNull();
    });

    test('getLockInfo returns null after release', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.release('product-123', 'selection', 'task-1');
      expect(taskLock.getLockInfo('product-123')).toBeNull();
    });
  });

  describe('duplicate acquire fails', () => {
    test('acquire fails when resource is already locked by same agent', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const result = taskLock.acquire('product-123', 'selection', 'task-2');
      expect(result).toBe(false);
    });

    test('acquire fails when resource is already locked by different agent', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const result = taskLock.acquire('product-123', 'content', 'task-2');
      expect(result).toBe(false);
    });

    test('multiple failed acquires do not create duplicate entries', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.acquire('product-123', 'content', 'task-2');
      taskLock.acquire('product-123', 'fulfillment', 'task-3');

      const count = db.prepare('SELECT COUNT(*) as count FROM task_locks WHERE resource = ?').get('product-123') as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe('forceRelease', () => {
    test('forceRelease removes lock regardless of owner', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.forceRelease('product-123');
      expect(taskLock.isLocked('product-123')).toBe(false);
    });

    test('forceRelease on non-existent resource does not throw', () => {
      expect(() => taskLock.forceRelease('nonexistent')).not.toThrow();
    });

    test('resource can be re-acquired after forceRelease', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      taskLock.forceRelease('product-123');
      const result = taskLock.acquire('product-123', 'content', 'task-2');
      expect(result).toBe(true);
    });
  });

  describe('cleanExpired', () => {
    test('removes locks older than maxAgeMs', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');

      db.prepare("UPDATE task_locks SET acquired_at = datetime('now', '-60 seconds') WHERE resource = ?").run('product-123');

      const cleaned = taskLock.cleanExpired(30000);
      expect(cleaned).toBe(1);
      expect(taskLock.isLocked('product-123')).toBe(false);
    });

    test('does not remove recent locks', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');
      const cleaned = taskLock.cleanExpired(30000);
      expect(cleaned).toBe(0);
      expect(taskLock.isLocked('product-123')).toBe(true);
    });

    test('returns count of cleaned locks', () => {
      taskLock.acquire('product-1', 'selection', 'task-1');
      taskLock.acquire('product-2', 'content', 'task-2');
      taskLock.acquire('product-3', 'fulfillment', 'task-3');

      db.prepare("UPDATE task_locks SET acquired_at = datetime('now', '-60 seconds')").run();

      const cleaned = taskLock.cleanExpired(30000);
      expect(cleaned).toBe(3);
    });

    test('uses default maxAgeMs of 30000', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');

      db.prepare("UPDATE task_locks SET acquired_at = datetime('now', '-20 seconds') WHERE resource = ?").run('product-123');

      const cleaned = taskLock.cleanExpired();
      expect(cleaned).toBe(0);
    });

    test('removes locks exactly at boundary', () => {
      taskLock.acquire('product-123', 'selection', 'task-1');

      db.prepare("UPDATE task_locks SET acquired_at = datetime('now', '-31 seconds') WHERE resource = ?").run('product-123');

      const cleaned = taskLock.cleanExpired(30000);
      expect(cleaned).toBe(1);
    });
  });

  describe('different agents can lock different resources', () => {
    test('multiple agents lock different resources independently', () => {
      expect(taskLock.acquire('product-1', 'selection', 'task-1')).toBe(true);
      expect(taskLock.acquire('product-2', 'content', 'task-2')).toBe(true);
      expect(taskLock.acquire('product-3', 'fulfillment', 'task-3')).toBe(true);

      expect(taskLock.isLocked('product-1')).toBe(true);
      expect(taskLock.isLocked('product-2')).toBe(true);
      expect(taskLock.isLocked('product-3')).toBe(true);

      expect(taskLock.getLockInfo('product-1')!.agentType).toBe('selection');
      expect(taskLock.getLockInfo('product-2')!.agentType).toBe('content');
      expect(taskLock.getLockInfo('product-3')!.agentType).toBe('fulfillment');
    });

    test('releasing one lock does not affect others', () => {
      taskLock.acquire('product-1', 'selection', 'task-1');
      taskLock.acquire('product-2', 'content', 'task-2');

      taskLock.release('product-1', 'selection', 'task-1');

      expect(taskLock.isLocked('product-1')).toBe(false);
      expect(taskLock.isLocked('product-2')).toBe(true);
    });

    test('same agent can lock multiple resources', () => {
      expect(taskLock.acquire('product-1', 'selection', 'task-1')).toBe(true);
      expect(taskLock.acquire('product-2', 'selection', 'task-2')).toBe(true);

      expect(taskLock.isLocked('product-1')).toBe(true);
      expect(taskLock.isLocked('product-2')).toBe(true);
    });
  });
});
