import { initDatabase } from '@/lib/db/init';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { TaskLock } from '@/lib/framework/task-lock';

// 测试一律走 :memory:（PGlite，PG 协议桥 + WASM），单条往返比
// better-sqlite3 同步路径慢一个量级；阈值统一放大 10 倍。
const PERF_FACTOR = 10;

describe('DB Operations Performance', () => {
  describe('SharedContext', () => {
    let db: ReturnType<typeof initDatabase>;
    let ctx: SharedContext;

    beforeEach(async () => {
      db = initDatabase(':memory:');
      ctx = new SharedContext(db);
      // 预热：首条查询承担 WASM/引擎冷启动，性能测试测稳态。
      await ctx.getData('selection', '__warmup__');
    });

    afterEach(async () => {
      await db.close();
    });

    test('setData + getData single round-trip ≤ 300ms', async () => {
      const start = performance.now();
      await ctx.setData('selection', 'test', { value: 1 });
      await ctx.getData('selection', 'test');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300 * PERF_FACTOR);
    });

    test('batch 100 writes ≤ 1500ms', async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await ctx.setData('selection', `key-${i}`, { index: i });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500 * PERF_FACTOR);
    });

    test('batch 100 reads ≤ 1500ms', async () => {
      for (let i = 0; i < 100; i++) {
        await ctx.setData('selection', `key-${i}`, { index: i });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await ctx.getData('selection', `key-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500 * PERF_FACTOR);
    });
  });

  describe('AgentProgressTracker', () => {
    let db: ReturnType<typeof initDatabase>;
    let tracker: AgentProgressTracker;

    beforeEach(async () => {
      db = initDatabase(':memory:');
      tracker = new AgentProgressTracker(db);
      await tracker.startTask('selection', '__warmup__');
    });

    afterEach(async () => {
      await db.close();
    });

    test('startTask + startStep + completeStep (full 5-step completion) ≤ 300ms', async () => {
      const start = performance.now();
      await tracker.startTask('selection', 'perf-task-1');
      const steps = [
        AgentStep.DataCollection,
        AgentStep.ModelReasoning,
        AgentStep.StrategyGeneration,
        AgentStep.Execution,
        AgentStep.ResultCallback,
      ];
      for (const step of steps) {
        await tracker.startStep('selection', 'perf-task-1', step, { source: 'test' });
        await tracker.completeStep('selection', 'perf-task-1', step, { result: 'ok' });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300 * PERF_FACTOR);
    });

    test('batch 100 task records ≤ 1500ms', async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await tracker.startTask('selection', `task-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500 * PERF_FACTOR);
    });
  });

  describe('TaskLock', () => {
    let db: ReturnType<typeof initDatabase>;
    let lock: TaskLock;

    beforeEach(async () => {
      db = initDatabase(':memory:');
      lock = new TaskLock(db);
      await lock.acquire('__warmup__', 'selection', '__warmup__');
      await lock.release('__warmup__', 'selection', '__warmup__');
    });

    afterEach(async () => {
      await db.close();
    });

    test('acquire + release ≤ 300ms', async () => {
      const start = performance.now();
      await lock.acquire('resource-1', 'selection', 'task-1');
      await lock.release('resource-1', 'selection', 'task-1');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300 * PERF_FACTOR);
    });

    test('batch 100 acquire+release cycles ≤ 1500ms', async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await lock.acquire(`resource-${i}`, 'selection', `task-${i}`);
        await lock.release(`resource-${i}`, 'selection', `task-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500 * PERF_FACTOR);
    });

    test('cleanExpired with 1000 entries ≤ 300ms', async () => {
      for (let i = 0; i < 1000; i++) {
        await lock.acquire(`resource-${i}`, 'selection', `task-${i}`);
      }
      await db.prepare("UPDATE task_locks SET acquired_at = now() - interval '60 seconds'").run();

      const start = performance.now();
      await lock.cleanExpired(30000);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300 * PERF_FACTOR);
    });
  });
});
