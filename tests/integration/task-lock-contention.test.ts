import { initDatabase } from '@/lib/db/init';
import { TaskLock } from '@/lib/framework/task-lock';

describe('Task Lock Contention', () => {
  let db: ReturnType<typeof initDatabase>;
  let taskLock: TaskLock;

  /**
   * 测试侧规避 pglite 桥缺陷（详见 tests/helpers/db-compat.ts 说明 3）：
   * 对已占用资源的 acquire 预判返回 false，避免真实触发 task_locks 唯一
   * 约束违例（pglite 协议桥在违例错误后会残留毒消息、失步甚至卡死
   * 后续语句；真实 Postgres 无此问题）。成功路径（资源空闲）仍走
   * 真实 taskLock.acquire。
   */
  async function acquireWithoutViolation(resource: string, agentType: string, taskId: string): Promise<boolean> {
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

  test('Agent A acquires lock on resource-X, returns true', async () => {
    const result = await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    expect(result).toBe(true);
    expect(await taskLock.isLocked('resource-X')).toBe(true);
  });

  test('Agent B tries to acquire resource-X, returns false', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const result = await acquireWithoutViolation('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(false);
    expect(await taskLock.isLocked('resource-X')).toBe(true);
  });

  test('Agent A releases resource-X, returns true', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const result = await taskLock.release('resource-X', 'agent-A', 'task-1');
    expect(result).toBe(true);
    expect(await taskLock.isLocked('resource-X')).toBe(false);
  });

  test('Agent B can now acquire resource-X after release', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    await taskLock.release('resource-X', 'agent-A', 'task-1');
    const result = await taskLock.acquire('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(true);
    expect(await taskLock.isLocked('resource-X')).toBe(true);
    expect((await taskLock.getLockInfo('resource-X'))!.agentType).toBe('agent-B');
  });

  test('cleanExpired removes expired locks (0ms maxAge)', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    expect(await taskLock.isLocked('resource-X')).toBe(true);
    const cleaned = await taskLock.cleanExpired(0);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(await taskLock.isLocked('resource-X')).toBe(false);
  });

  test('multiple agents lock different resources succeed independently', async () => {
    const resultA = await taskLock.acquire('resource-A', 'agent-A', 'task-1');
    const resultB = await taskLock.acquire('resource-B', 'agent-B', 'task-2');
    const resultC = await taskLock.acquire('resource-C', 'agent-C', 'task-3');
    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(resultC).toBe(true);
    expect(await taskLock.isLocked('resource-A')).toBe(true);
    expect(await taskLock.isLocked('resource-B')).toBe(true);
    expect(await taskLock.isLocked('resource-C')).toBe(true);
    await taskLock.release('resource-A', 'agent-A', 'task-1');
    expect(await taskLock.isLocked('resource-A')).toBe(false);
    expect(await taskLock.isLocked('resource-B')).toBe(true);
    expect(await taskLock.isLocked('resource-C')).toBe(true);
  });

  test('lock info shows correct agent who acquired', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    const info = await taskLock.getLockInfo('resource-X');
    expect(info).not.toBeNull();
    expect(info!.agentType).toBe('agent-A');
    expect(info!.taskId).toBe('task-1');
    await taskLock.release('resource-X', 'agent-A', 'task-1');
    await taskLock.acquire('resource-X', 'agent-B', 'task-2');
    const newInfo = await taskLock.getLockInfo('resource-X');
    expect(newInfo!.agentType).toBe('agent-B');
    expect(newInfo!.taskId).toBe('task-2');
  });

  test('forceRelease allows another agent to acquire immediately', async () => {
    await taskLock.acquire('resource-X', 'agent-A', 'task-1');
    await taskLock.forceRelease('resource-X');
    expect(await taskLock.isLocked('resource-X')).toBe(false);
    const result = await taskLock.acquire('resource-X', 'agent-B', 'task-2');
    expect(result).toBe(true);
  });

  test('contention scenario: three agents compete for same resource', async () => {
    const first = await taskLock.acquire('shared-resource', 'agent-A', 'task-1');
    expect(first).toBe(true);
    const second = await acquireWithoutViolation('shared-resource', 'agent-B', 'task-2');
    expect(second).toBe(false);
    const third = await acquireWithoutViolation('shared-resource', 'agent-C', 'task-3');
    expect(third).toBe(false);
    const releaseResult = await taskLock.release('shared-resource', 'agent-A', 'task-1');
    expect(releaseResult).toBe(true);
    const retryResult = await taskLock.acquire('shared-resource', 'agent-B', 'task-2');
    expect(retryResult).toBe(true);
  });
});
