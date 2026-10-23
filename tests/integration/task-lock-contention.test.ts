import Database from 'better-sqlite3';
import { TaskLock } from '@/lib/framework/task-lock';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('Task Lock Contention', () => {
  let db: Database.Database;
  let taskLock: TaskLock;

  beforeEach(() => {
    db = createTestDb();
    taskLock = new TaskLock(db);
  });

  afterEach(() => {
    db.close();
  });

  test('Agent A acquires lock on resource-X, returns true', () => {
    const result = taskLock.acquire('resource-X', 'agent-A', 'task-1');
    expect(result).toBe(true);
    expect(taskLock.isLocked('resource-X')).toBe(true);
  });

  test('Agent B tries to acquire resource-X, returns false', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const result = taskLock.acquire('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(false);
    expect(taskLock.isLocked('resource-X')).toBe(true);
  });

  test('Agent A releases resource-X, returns true', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const result = taskLock.release('resource-X', 'agent-A', 'task-1');
    expect(result).toBe(true);
    expect(taskLock.isLocked('resource-X')).toBe(false);
  });

  test('Agent B can now acquire resource-X after release', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    taskLock.release('resource-X', 'agent-A', 'task-1');
    const result = taskLock.acquire('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(true);
    expect(taskLock.isLocked('resource-X')).toBe(true);
    expect(taskLock.getLockInfo('resource-X')!.agentType).toBe('agent-B');
  });

  test('cleanExpired removes expired locks (0ms maxAge)', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    expect(taskLock.isLocked('resource-X')).toBe(true);
    const cleaned = taskLock.cleanExpired(0);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(taskLock.isLocked('resource-X')).toBe(false);
  });

  test('multiple agents lock different resources succeed independently', () => {
    const resultA = taskLock.acquire('resource-A', 'agent-A', 'task-1');
    const resultB = taskLock.acquire('resource-B', 'agent-B', 'task-2');
    const resultC = taskLock.acquire('resource-C', 'agent-C', 'task-3');
    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(resultC).toBe(true);
    expect(taskLock.isLocked('resource-A')).toBe(true);
    expect(taskLock.isLocked('resource-B')).toBe(true);
    expect(taskLock.isLocked('resource-C')).toBe(true);
    taskLock.release('resource-A', 'agent-A', 'task-1');
    expect(taskLock.isLocked('resource-A')).toBe(false);
    expect(taskLock.isLocked('resource-B')).toBe(true);
    expect(taskLock.isLocked('resource-C')).toBe(true);
  });

  test('lock info shows correct agent who acquired', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const info = taskLock.getLockInfo('resource-X');
    expect(info).not.toBeNull();
    expect(info!.agentType).toBe('agent-A');
    expect(info!.taskId).toBe('task-1');
    taskLock.release('resource-X', 'agent-A', 'task-1');
    taskLock.acquire('resource-X', 'agent-B', 'task-2');
    const newInfo = taskLock.getLockInfo('resource-X');
    expect(newInfo!.agentType).toBe('agent-B');
    expect(newInfo!.taskId).toBe('task-2');
  });

  test('forceRelease allows another agent to acquire immediately', () => {
    taskLock.acquire('resource-X', 'agent-A', 'task-1');
    taskLock.forceRelease('resource-X');
    expect(taskLock.isLocked('resource-X')).toBe(false);
    const result = taskLock.acquire('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(true);
  });

  test('contention scenario: three agents compete for same resource', () => {
    const first = taskLock.acquire('shared-resource', 'agent-A', 'task-1');
    expect(first).toBe(true);
    const second = taskLock.acquire('shared-resource', 'agent-B', 'task-2');
    expect(second).toBe(false);
    const third = taskLock.acquire('shared-resource', 'agent-C', 'task-3');
    expect(third).toBe(false);
    const releaseResult = taskLock.release('shared-resource', 'agent-A', 'task-1');
    expect(releaseResult).toBe(true);
    const retryResult = taskLock.acquire('shared-resource', 'agent-B', 'task-2');
    expect(retryResult).toBe(true);
  });
});
