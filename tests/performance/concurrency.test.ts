import { initDatabase } from '@/lib/db/init';
import { SharedContext } from '@/lib/framework/shared-context';
import { TaskLock } from '@/lib/framework/task-lock';

describe('Concurrency Simulation', () => {
  describe('SharedContext concurrent writes', () => {
    let db: ReturnType<typeof initDatabase>;
    let ctx: SharedContext;

    beforeEach(() => {
      db = initDatabase(':memory:');
      ctx = new SharedContext(db);
    });

    afterEach(async () => {
      await db.close();
    });

    test('100 concurrent writes all succeed without data corruption', async () => {
      const results: Array<{ success: boolean; error?: unknown }> = [];

      const writePromises = Array.from({ length: 100 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await ctx.setData('selection', 'shared-key', { index: i, data: `value-${i}` });
              results.push({ success: true });
            } catch (error) {
              results.push({ success: false, error });
            }
            resolve();
          }, 0);
        })
      );

      await Promise.all(writePromises);

      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(100);

      const finalValue = await ctx.getData('selection', 'shared-key');
      expect(finalValue).not.toBeNull();
      expect(typeof (finalValue as { index: number })!.index).toBe('number');
      expect(typeof (finalValue as { data: string })!.data).toBe('string');
    });
  });

  describe('TaskLock concurrent acquire on same resource', () => {
    let db: ReturnType<typeof initDatabase>;
    let lock: TaskLock;

    beforeEach(() => {
      db = initDatabase(':memory:');
      lock = new TaskLock(db);
    });

    afterEach(async () => {
      await db.close();
    });

    test('only 1 succeeds, 99 fail, no exceptions', async () => {
      const results: boolean[] = [];

      const acquirePromises = Array.from({ length: 100 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              const result = await lock.acquire('shared-resource', `agent-${i}`, `task-${i}`);
              results.push(result);
            } catch {
              results.push(false);
            }
            resolve();
          }, 0);
        })
      );

      await Promise.all(acquirePromises);

      const successCount = results.filter((r) => r).length;
      const failCount = results.filter((r) => !r).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(99);
      expect(await lock.isLocked('shared-resource')).toBe(true);
    });
  });

  describe('TaskLock concurrent acquire on different resources', () => {
    let db: ReturnType<typeof initDatabase>;
    let lock: TaskLock;

    beforeEach(() => {
      db = initDatabase(':memory:');
      lock = new TaskLock(db);
    });

    afterEach(async () => {
      await db.close();
    });

    test('all 100 succeed with unique resources', async () => {
      const results: boolean[] = [];

      const acquirePromises = Array.from({ length: 100 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              const result = await lock.acquire(`resource-${i}`, `agent-${i}`, `task-${i}`);
              results.push(result);
            } catch {
              results.push(false);
            }
            resolve();
          }, 0);
        })
      );

      await Promise.all(acquirePromises);

      const successCount = results.filter((r) => r).length;
      expect(successCount).toBe(100);

      for (let i = 0; i < 100; i++) {
        expect(await lock.isLocked(`resource-${i}`)).toBe(true);
      }
    });
  });

  describe('Mixed concurrent operations', () => {
    let db: ReturnType<typeof initDatabase>;
    let ctx: SharedContext;
    let lock: TaskLock;

    beforeEach(() => {
      db = initDatabase(':memory:');
      ctx = new SharedContext(db);
      lock = new TaskLock(db);
    });

    afterEach(async () => {
      await db.close();
    });

    test('mixed read/write/lock operations complete without deadlock', async () => {
      await ctx.setData('selection', 'initial', { ready: true });

      const operations: Array<{ type: string; success: boolean }> = [];

      const readPromises = Array.from({ length: 25 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await ctx.getData('selection', 'initial');
              operations.push({ type: 'read', success: true });
            } catch {
              operations.push({ type: 'read', success: false });
            }
            resolve();
          }, 0);
        })
      );

      const writePromises = Array.from({ length: 25 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await ctx.setData('selection', `concurrent-key-${i}`, { value: i });
              operations.push({ type: 'write', success: true });
            } catch {
              operations.push({ type: 'write', success: false });
            }
            resolve();
          }, 0);
        })
      );

      const lockPromises = Array.from({ length: 25 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await lock.acquire(`mixed-resource-${i}`, `agent-${i}`, `task-${i}`);
              operations.push({ type: 'lock', success: true });
            } catch {
              operations.push({ type: 'lock', success: false });
            }
            resolve();
          }, 0);
        })
      );

      await Promise.all([...readPromises, ...writePromises, ...lockPromises]);

      const successCount = operations.filter((o) => o.success).length;
      expect(successCount).toBe(75);

      const finalValue = await ctx.getData('selection', 'initial');
      expect(finalValue).toEqual({ ready: true });

      for (let i = 0; i < 25; i++) {
        const writtenValue = await ctx.getData('selection', `concurrent-key-${i}`);
        expect(writtenValue).toEqual({ value: i });
        expect(await lock.isLocked(`mixed-resource-${i}`)).toBe(true);
      }
    });
  });
});
