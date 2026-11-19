import type { DbClient } from '@/lib/db/client';
import { initDatabase } from '@/lib/db/init';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { TaskQueueRepository } from '@/lib/db/task-queue-repository';
import { UserRepository } from '@/lib/db/user-repository';
import { TaskQueueWorker } from '@/lib/task-runtime/queue-worker';
import { resetTaskRuntimeForTests } from '@/lib/agents/task-service';
import { applyDbCompat, markReadyHandled, installFreshPgliteEngine, installPgliteWorkerGuard } from '../helpers/db-compat';

const mockExecuteTask = jest.fn();
const mockExecuteChain = jest.fn();

jest.mock('@/lib/api/agent-service', () => {
  const actual = jest.requireActual('@/lib/api/agent-service');
  return {
    ...actual,
    getOrchestrator: jest.fn(() => ({
      executeTask: mockExecuteTask,
      executeChain: mockExecuteChain,
    })),
  };
});

// 与 agent-runtime-lifecycle.test.ts 相同的 pglite 隔离模式：每测试装全新
// 引擎、不 close 池，残留协议流局限在单引擎内；常驻 guard 吞噪音。
installPgliteWorkerGuard();

let db: DbClient;

function taskLogs(): TaskLogRepository {
  return new TaskLogRepository(db);
}

async function createPendingTask(patch: {
  agent_type?: string;
  user_id?: number | null;
  created_at?: string;
  status?: string;
  input?: string;
}): Promise<number> {
  const result = await taskLogs().create({
    agent_type: patch.agent_type ?? 'selection',
    task_name: 'queued',
    status: patch.status ?? 'pending',
    input: patch.input ?? null,
    user_id: patch.user_id ?? null,
    ...(patch.created_at ? { created_at: patch.created_at } : {}),
  });
  return Number(result.lastInsertRowid);
}

beforeEach(() => {
  installFreshPgliteEngine();
  db = applyDbCompat(initDatabase(':memory:'));
  markReadyHandled(db);
  resetTaskRuntimeForTests();
  jest.clearAllMocks();
  mockExecuteTask.mockResolvedValue({ success: true, data: {} });
  mockExecuteChain.mockResolvedValue([{ success: true, data: {} }]);
});

describe('TaskQueueRepository.claimNext (SKIP LOCKED)', () => {
  test('claims the oldest pending task and marks it running with lease fields', async () => {
    const t1 = await createPendingTask({ agent_type: 'selection', created_at: '2026-01-01T00:00:00.000Z' });
    const t2 = await createPendingTask({ agent_type: 'content', created_at: '2026-01-01T00:00:01.000Z' });
    const repo = new TaskQueueRepository(db);

    const claimed = await repo.claimNext('worker-a', 60_000);
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(t1);
    expect(claimed!.agent_type).toBe('selection');

    const row = (await taskLogs().findById(t1))!;
    expect(row.status).toBe('running');
    expect(row.claimed_by).toBe('worker-a');
    expect(row.started_at).toBeTruthy();
    expect(row.heartbeat_at).toBeTruthy();
    expect(row.lease_until).toBeTruthy();
    // 租约必须是未来时间（now + leaseMs）
    expect(Date.parse(row.lease_until!)).toBeGreaterThan(Date.now());
  });

  test('a second worker claims the next task; the third claim is null', async () => {
    await createPendingTask({ agent_type: 'selection', created_at: '2026-01-01T00:00:00.000Z' });
    await createPendingTask({ agent_type: 'content', created_at: '2026-01-01T00:00:01.000Z' });
    const repo = new TaskQueueRepository(db);

    const first = await repo.claimNext('worker-a', 60_000);
    const second = await repo.claimNext('worker-b', 60_000);
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id);
    expect(second!.agent_type).toBe('content');
    expect((await taskLogs().findById(second!.id))!.claimed_by).toBe('worker-b');

    // 两个 pending 都已被领取
    expect(await repo.claimNext('worker-b', 60_000)).toBeNull();
  });

  test('returns null on an empty queue', async () => {
    expect(await new TaskQueueRepository(db).claimNext('worker-a', 60_000)).toBeNull();
  });
});

describe('TaskQueueRepository.heartbeat', () => {
  test('owner extends the lease; non-owner and finished tasks are rejected', async () => {
    const taskId = await createPendingTask({});
    const repo = new TaskQueueRepository(db);
    await repo.claimNext('worker-a', 30_000);
    const before = Date.parse((await taskLogs().findById(taskId))!.lease_until!);

    expect(await repo.heartbeat(taskId, 'worker-b', 120_000)).toBe(false);
    expect(await repo.heartbeat(taskId, 'worker-a', 120_000)).toBe(true);
    const after = (await taskLogs().findById(taskId))!;
    expect(Date.parse(after.lease_until!)).toBeGreaterThan(before);

    // 任务结束后心跳不再适用（status != running）
    await taskLogs().updateStatus(taskId, 'completed');
    expect(await repo.heartbeat(taskId, 'worker-a', 120_000)).toBe(false);
  });
});

describe('TaskQueueRepository.reapZombies', () => {
  test('re-queues an expired running task but leaves a healthy lease alone', async () => {
    const zombie = await createPendingTask({});
    const healthy = await createPendingTask({});
    const repo = new TaskQueueRepository(db);
    await repo.claimNext('crashed-worker', 5_000);
    await repo.claimNext('alive-worker', 5_000);

    // 把 zombie 的租约拨到过去（模拟 worker 崩溃后心跳停止）
    await db.prepare('UPDATE task_logs SET lease_until = ? WHERE id = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      zombie
    );

    const reaped = await repo.reapZombies(5_000);
    expect(reaped).toBe(1);

    const zombieRow = (await taskLogs().findById(zombie))!;
    expect(zombieRow.status).toBe('pending');
    expect(zombieRow.claimed_by).toBeNull();
    expect(zombieRow.lease_until).toBeNull();
    expect(zombieRow.started_at).toBeNull();
    expect(zombieRow.requeue_count).toBe(1);

    const healthyRow = (await taskLogs().findById(healthy))!;
    expect(healthyRow.status).toBe('running');
    expect(healthyRow.requeue_count).toBe(0);
  });

  test('reaped tasks are claimable again and the counter keeps incrementing', async () => {
    const taskId = await createPendingTask({});
    const repo = new TaskQueueRepository(db);
    await repo.claimNext('crashed-worker', 5_000);
    await db.prepare('UPDATE task_logs SET lease_until = ? WHERE id = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      taskId
    );

    expect(await repo.reapZombies(5_000)).toBe(1);
    const reclaimed = await repo.claimNext('worker-retry', 5_000);
    expect(reclaimed?.id).toBe(taskId);
    expect((await taskLogs().findById(taskId))!.claimed_by).toBe('worker-retry');

    await db.prepare('UPDATE task_logs SET lease_until = ? WHERE id = ?').run(
      new Date(Date.now() - 1_000).toISOString(),
      taskId
    );
    expect(await repo.reapZombies(5_000)).toBe(1);
    expect((await taskLogs().findById(taskId))!.requeue_count).toBe(2);
  });
});

describe('TaskQueueRepository.countActiveForUser', () => {
  test('counts pending + running per user only', async () => {
    const users = new UserRepository(db);
    const alice = Number((await users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' })).lastInsertRowid);
    const bob = Number((await users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' })).lastInsertRowid);

    await createPendingTask({ user_id: alice });
    await createPendingTask({ user_id: alice, status: 'running' });
    await createPendingTask({ user_id: alice, status: 'completed' });
    await createPendingTask({ user_id: bob });

    const repo = new TaskQueueRepository(db);
    expect(await repo.countActiveForUser(alice)).toBe(2);
    expect(await repo.countActiveForUser(bob)).toBe(1);
    expect(await repo.countActiveForUser(999_999)).toBe(0);
  });
});

describe('TaskQueueWorker.claimAndRunOnce (claim → run → completed)', () => {
  test('runs a claimed task through the orchestrator and ends it completed', async () => {
    const input = { products: [{ name: 'A' }] };
    const taskId = await createPendingTask({
      agent_type: 'selection',
      input: JSON.stringify(input),
      user_id: null,
    });
    mockExecuteTask.mockResolvedValue({ success: true, data: { ok: true } });

    const worker = new TaskQueueWorker({ workerId: 'test-worker', leaseMs: 60_000, heartbeatMs: 10_000 });
    const ran = await worker.claimAndRunOnce();

    expect(ran).toBe(taskId);
    expect(mockExecuteTask).toHaveBeenCalledWith('selection', input);
    const row = (await taskLogs().findById(taskId))!;
    expect(row.status).toBe('completed');
    expect(row.claimed_by).toBe('test-worker');
    expect(row.ended_at).toBeTruthy();

    // 队列已空
    expect(await worker.claimAndRunOnce()).toBeNull();
  });

  test('a failing orchestrator marks the task failed instead of crashing the worker', async () => {
    const taskId = await createPendingTask({ agent_type: 'selection', input: '{}' });
    mockExecuteTask.mockResolvedValue({ success: false, error: 'upstream timeout' });

    const worker = new TaskQueueWorker({ workerId: 'test-worker', leaseMs: 60_000, heartbeatMs: 10_000 });
    const ran = await worker.claimAndRunOnce();
    expect(ran).toBe(taskId);

    const row = (await taskLogs().findById(taskId))!;
    expect(row.status).toBe('failed');
    expect(row.error).toBe('upstream timeout');
  });

  test('start/stop are idempotent and stop clears all timers', async () => {
    const worker = new TaskQueueWorker({ workerId: 'timer-test', pollMs: 100, reaperMs: 100 });
    worker.start();
    worker.start(); // 幂等
    const pollTimer = (worker as unknown as { pollTimer: unknown }).pollTimer;
    const reaperTimer = (worker as unknown as { reaperTimer: unknown }).reaperTimer;
    expect(pollTimer).toBeTruthy();
    expect(reaperTimer).toBeTruthy();
    worker.stop();
    worker.stop();
    expect((worker as unknown as { pollTimer: unknown }).pollTimer).toBeNull();
    expect((worker as unknown as { reaperTimer: unknown }).reaperTimer).toBeNull();
  });
});
