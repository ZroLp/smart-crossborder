import Database from 'better-sqlite3';
import { SharedContext } from '@/lib/framework/shared-context';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';
import { TaskLock } from '@/lib/framework/task-lock';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS agent_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_type TEXT NOT NULL,
      task_id TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('DB Operations Performance', () => {
  describe('SharedContext', () => {
    let db: Database.Database;
    let ctx: SharedContext;

    beforeEach(() => {
      db = createTestDb();
      ctx = new SharedContext(db);
    });

    afterEach(() => {
      db.close();
    });

    test('setData + getData single round-trip ≤ 300ms', () => {
      const start = performance.now();
      ctx.setData('selection', 'test', { value: 1 });
      ctx.getData('selection', 'test');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });

    test('batch 100 writes ≤ 1500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ctx.setData('selection', `key-${i}`, { index: i });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500);
    });

    test('batch 100 reads ≤ 1500ms', () => {
      for (let i = 0; i < 100; i++) {
        ctx.setData('selection', `key-${i}`, { index: i });
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ctx.getData('selection', `key-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('AgentProgressTracker', () => {
    let db: Database.Database;
    let tracker: AgentProgressTracker;

    beforeEach(() => {
      db = createTestDb();
      tracker = new AgentProgressTracker(db);
    });

    afterEach(() => {
      db.close();
    });

    test('startTask + startStep + completeStep (full 5-step completion) ≤ 300ms', () => {
      const start = performance.now();
      tracker.startTask('selection', 'perf-task-1');
      const steps = [
        AgentStep.DataCollection,
        AgentStep.ModelReasoning,
        AgentStep.StrategyGeneration,
        AgentStep.Execution,
        AgentStep.ResultCallback,
      ];
      for (const step of steps) {
        tracker.startStep('selection', 'perf-task-1', step, { source: 'test' });
        tracker.completeStep('selection', 'perf-task-1', step, { result: 'ok' });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });

    test('batch 100 task records ≤ 1500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tracker.startTask('selection', `task-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('TaskLock', () => {
    let db: Database.Database;
    let lock: TaskLock;

    beforeEach(() => {
      db = new Database(':memory:');
      lock = new TaskLock(db);
    });

    afterEach(() => {
      db.close();
    });

    test('acquire + release ≤ 300ms', () => {
      const start = performance.now();
      lock.acquire('resource-1', 'selection', 'task-1');
      lock.release('resource-1', 'selection', 'task-1');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });

    test('batch 100 acquire+release cycles ≤ 1500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        lock.acquire(`resource-${i}`, 'selection', `task-${i}`);
        lock.release(`resource-${i}`, 'selection', `task-${i}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500);
    });

    test('cleanExpired with 1000 entries ≤ 300ms', () => {
      for (let i = 0; i < 1000; i++) {
        lock.acquire(`resource-${i}`, 'selection', `task-${i}`);
      }
      db.prepare("UPDATE task_locks SET acquired_at = datetime('now', '-60 seconds')").run();

      const start = performance.now();
      lock.cleanExpired(30000);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });
  });
});
