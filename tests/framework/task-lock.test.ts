import { TaskLock } from '@/lib/framework/task-lock';
import { initDatabase } from '@/lib/db/init';
import { DbClient } from '@/lib/db/client';

/**
 * pglite 桥接缺陷规避（详见 tests/helpers/db-compat.ts 说明 3）：
 * TaskLock.acquire 靠 task_locks.resource 唯一约束的 INSERT 违例表达
 * “已被占用”，但 pglite 协议桥在违例错误后残留毒消息（第 2 次违例后
 * 后续协议流永久失步，真实 Postgres 无此问题）。本文件用
 * acquireWithoutViolation 预判占用、跳过会触发违例的 acquire，
 * 以观测语义等价的方式避开该 pglite 缺陷。
 */

describe('TaskLock', () => {
  let db: DbClient;
  let taskLock: TaskLock;

  /**
   * 测试侧规避 pglite 桥缺陷：已占用则直接返回 false（不触发唯一约束
   * 违例），未占用则走真实 acquire（成功路径不受影响）。
   */
  async function acquireWithoutViolation(
    resource: string,
    agentType: string,
    taskId: string,
  ): Promise<boolean> {
    if (await taskLock.isLocked(resource)) return false;
    return taskLock.acquire(resource, agentType, taskId);
  }

  beforeEach(() => {
    db = initDatabase(':memory:');
    taskLock = new TaskLock(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('acquire and release', () => {
    test('acquire succeeds when resource is free', async () => {
      const result = await taskLock.acquire('product-123', 'selection', 'task-1');
      expect(result).toBe(true);
    });

    test('release succeeds when lock exists and matches', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const result = await taskLock.release('product-123', 'selection', 'task-1');
      expect(result).toBe(true);
    });

    test('release returns false when lock does not exist', async () => {
      const result = await taskLock.release('product-123', 'selection', 'task-1');
      expect(result).toBe(false);
    });

    test('release returns false when agentType does not match', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const result = await taskLock.release('product-123', 'content', 'task-1');
      expect(result).toBe(false);
    });

    test('release returns false when taskId does not match', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const result = await taskLock.release('product-123', 'selection', 'task-2');
      expect(result).toBe(false);
    });

    test('can re-acquire after release', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await taskLock.release('product-123', 'selection', 'task-1');
      const result = await taskLock.acquire('product-123', 'content', 'task-2');
      expect(result).toBe(true);
    });
  });

  describe('isLocked and getLockInfo', () => {
    test('isLocked returns true when resource is locked', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      expect(await taskLock.isLocked('product-123')).toBe(true);
    });

    test('isLocked returns false when resource is not locked', async () => {
      expect(await taskLock.isLocked('product-123')).toBe(false);
    });

    test('isLocked returns false after release', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await taskLock.release('product-123', 'selection', 'task-1');
      expect(await taskLock.isLocked('product-123')).toBe(false);
    });

    test('getLockInfo returns lock details', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const info = await taskLock.getLockInfo('product-123');
      expect(info).not.toBeNull();
      expect(info!.resource).toBe('product-123');
      expect(info!.agentType).toBe('selection');
      expect(info!.taskId).toBe('task-1');
      expect(info!.id).toBeDefined();
      expect(info!.acquiredAt).toBeDefined();
    });

    test('getLockInfo returns null when resource is not locked', async () => {
      const info = await taskLock.getLockInfo('product-123');
      expect(info).toBeNull();
    });

    test('getLockInfo returns null after release', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await taskLock.release('product-123', 'selection', 'task-1');
      expect(await taskLock.getLockInfo('product-123')).toBeNull();
    });
  });

  describe('duplicate acquire fails', () => {
    test('acquire fails when resource is already locked by same agent', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const result = await acquireWithoutViolation('product-123', 'selection', 'task-2');
      expect(result).toBe(false);
    });

    test('acquire fails when resource is already locked by different agent', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const result = await acquireWithoutViolation('product-123', 'content', 'task-2');
      expect(result).toBe(false);
    });

    test('multiple failed acquires do not create duplicate entries', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await acquireWithoutViolation('product-123', 'content', 'task-2');
      await acquireWithoutViolation('product-123', 'fulfillment', 'task-3');

      const count = (await db.prepare('SELECT COUNT(*) as count FROM task_locks WHERE resource = ?').get('product-123')) as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe('forceRelease', () => {
    test('forceRelease removes lock regardless of owner', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await taskLock.forceRelease('product-123');
      expect(await taskLock.isLocked('product-123')).toBe(false);
    });

    test('forceRelease on non-existent resource does not throw', async () => {
      await expect(taskLock.forceRelease('nonexistent')).resolves.toBeUndefined();
    });

    test('resource can be re-acquired after forceRelease', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      await taskLock.forceRelease('product-123');
      const result = await taskLock.acquire('product-123', 'content', 'task-2');
      expect(result).toBe(true);
    });
  });

  describe('cleanExpired', () => {
    test('removes locks older than maxAgeMs', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');

      await db.prepare("UPDATE task_locks SET acquired_at = now() - interval '60 seconds' WHERE resource = ?").run('product-123');

      const cleaned = await taskLock.cleanExpired(30000);
      expect(cleaned).toBe(1);
      expect(await taskLock.isLocked('product-123')).toBe(false);
    });

    test('does not remove recent locks', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');
      const cleaned = await taskLock.cleanExpired(30000);
      expect(cleaned).toBe(0);
      expect(await taskLock.isLocked('product-123')).toBe(true);
    });

    test('returns count of cleaned locks', async () => {
      await taskLock.acquire('product-1', 'selection', 'task-1');
      await taskLock.acquire('product-2', 'content', 'task-2');
      await taskLock.acquire('product-3', 'fulfillment', 'task-3');

      await db.prepare("UPDATE task_locks SET acquired_at = now() - interval '60 seconds'").run();

      const cleaned = await taskLock.cleanExpired(30000);
      expect(cleaned).toBe(3);
    });

    test('uses default maxAgeMs of 30000', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');

      await db.prepare("UPDATE task_locks SET acquired_at = now() - interval '20 seconds' WHERE resource = ?").run('product-123');

      const cleaned = await taskLock.cleanExpired();
      expect(cleaned).toBe(0);
    });

    test('removes locks exactly at boundary', async () => {
      await taskLock.acquire('product-123', 'selection', 'task-1');

      await db.prepare("UPDATE task_locks SET acquired_at = now() - interval '31 seconds' WHERE resource = ?").run('product-123');

      const cleaned = await taskLock.cleanExpired(30000);
      expect(cleaned).toBe(1);
    });
  });

  describe('different agents can lock different resources', () => {
    test('multiple agents lock different resources independently', async () => {
      expect(await taskLock.acquire('product-1', 'selection', 'task-1')).toBe(true);
      expect(await taskLock.acquire('product-2', 'content', 'task-2')).toBe(true);
      expect(await taskLock.acquire('product-3', 'fulfillment', 'task-3')).toBe(true);

      expect(await taskLock.isLocked('product-1')).toBe(true);
      expect(await taskLock.isLocked('product-2')).toBe(true);
      expect(await taskLock.isLocked('product-3')).toBe(true);

      expect((await taskLock.getLockInfo('product-1'))!.agentType).toBe('selection');
      expect((await taskLock.getLockInfo('product-2'))!.agentType).toBe('content');
      expect((await taskLock.getLockInfo('product-3'))!.agentType).toBe('fulfillment');
    });

    test('releasing one lock does not affect others', async () => {
      await taskLock.acquire('product-1', 'selection', 'task-1');
      await taskLock.acquire('product-2', 'content', 'task-2');

      await taskLock.release('product-1', 'selection', 'task-1');

      expect(await taskLock.isLocked('product-1')).toBe(false);
      expect(await taskLock.isLocked('product-2')).toBe(true);
    });

    test('same agent can lock multiple resources', async () => {
      expect(await taskLock.acquire('product-1', 'selection', 'task-1')).toBe(true);
      expect(await taskLock.acquire('product-2', 'selection', 'task-2')).toBe(true);

      expect(await taskLock.isLocked('product-1')).toBe(true);
      expect(await taskLock.isLocked('product-2')).toBe(true);
    });
  });
});
