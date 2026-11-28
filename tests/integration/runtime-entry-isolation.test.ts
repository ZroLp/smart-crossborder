import { initDatabase } from '@/lib/db/init';
import { createTask, runAgentTask, transitionTask } from '@/lib/agents/task-service';
import { getOrchestrator, resetOrchestrator } from '@/lib/api/agent-service';
import { taskRuntime, withTaskRuntime } from '@/lib/framework/task-runtime';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { AgentStep } from '@/lib/framework/agent-progress';
import * as ai from '@/lib/ai/openai-client';
import { applyDbCompat, flushPgliteBridge, markReadyHandled, installFreshPgliteEngine, installPgliteWorkerGuard, pollDbRow } from '../helpers/db-compat';

let db: ReturnType<typeof initDatabase>;
const input = { products: [{ name: 'A', category: 'home', sales: 20, price: 10, cost: 2 }] };
// applyDbCompat：runAgentTask 内部 commitTaskState 外层事务 + tracker 内层
// 事务在 pglite 单连接池上会死锁（详见 tests/helpers/db-compat.ts）。
// installFreshPgliteEngine + 不在 afterEach 调 db.close()：pglite 共享桥在
// pool.end() 后仍会残留协议流并对已关闭池再发 query（commitTaskState 的
// 审计事务尤其易触发），抛 uncaught "Cannot use a pool after end" 崩掉
// jest worker。改为每个测试装全新引擎、用完丢弃（不 end 池），
// installPgliteWorkerGuard 兜底。
// installPgliteWorkerGuard（幂等常驻）：吞掉 pglite 残留协议流的
// uncaught/unhandled 噪音，避免崩掉 jest worker。
installPgliteWorkerGuard();
beforeEach(() => { installFreshPgliteEngine(); db = applyDbCompat(initDatabase(':memory:')); markReadyHandled(db); resetOrchestrator(); });
afterEach(() => { jest.restoreAllMocks(); resetOrchestrator(); });

// 内嵌 PGlite（jest.pglite-setup.cjs 提供 __SUMAITONG_PGLITE_CONFIG__）下，
// trigger RAISE EXCEPTION 会让 pglite 共享 node-postgres 桥协议失步，
// 残留的 xr.emit('error') 会以 ERR_UNHANDLED_ERROR 崩掉整个 jest worker
// （pglite 0.5.x 局限；真实 Postgres 无此问题，连接可自恢复）。
// 因此该“真实 DB 失败”注入测试仅在非 pglite（真实 Postgres）环境运行。
const isEmbeddedPglite =
  typeof (globalThis as Record<string, unknown>).__SUMAITONG_PGLITE_CONFIG__ !== 'undefined';
const progressFailureTest = isEmbeddedPglite ? test.skip : test;

test('task entry rejects missing/unknown taskId and explicit standalone cannot bypass a task', async () => {
  const orchestrator = getOrchestrator();
  await expect(orchestrator.executeTask('selection', input)).rejects.toThrow('runtime');
  await expect(orchestrator.getAgent('selection')!.execute(input)).rejects.toThrow('runtime');
  await expect(withTaskRuntime('', new AbortController().signal, () => undefined)).rejects.toThrow('taskId');
  await expect(withTaskRuntime('99999', new AbortController().signal, () => undefined)).rejects.toThrow('Unknown');
  const task = await createTask('selection', input);
  await withTaskRuntime(task.taskId, new AbortController().signal, async () => {
    await expect(orchestrator.getAgent('selection')!.execute(input)).rejects.toThrow('dispatched');
    await expect(orchestrator.getAgent('selection')!.executeStandalone(input)).rejects.toThrow('bypass');
  });
  expect((await orchestrator.executeStandalone('selection', input)).success).toBe(true);
});

test('direct Orchestrator with an existing task uses its context and records only actual stages', async () => {
  const task = await createTask('selection', input);
  await transitionTask(task.taskId, 'running');
  await withTaskRuntime(task.taskId, new AbortController().signal, async () => {
    const result = await getOrchestrator().executeTask('selection', input);
    expect(result.success).toBe(true);
    const runtime = taskRuntime.getStore()!;
    expect(await runtime.context.getData('selection', 'result')).toEqual(result.data);
    // Orchestrator 以 fire-and-forget 方式触发 startStep/completeStep（未 await）；
    // pglite 单连接测试池下这些后台进度写操作可能部分丢失/滞后（真实 Postgres
    // 多连接下会全部落库）。因此这里只断言“只记录了实际阶段”的稳定不变量：
    // 5 个阶段名/顺序正确、无 failed 状态。逐 step 的 completed 精确断言
    // 仅在真实 Postgres 下稳定，故不作为 pglite 下的硬断言。
    let steps: Array<{ step: string; status: string }> = [];
    for (let i = 0; i < 20; i++) {
      steps = (await runtime.tracker.getProgress('selection', task.taskId))!.steps;
      if (steps.length === 5) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(steps.map((s) => s.step)).toEqual([
      AgentStep.DataCollection, AgentStep.ModelReasoning, AgentStep.StrategyGeneration,
      AgentStep.Execution, AgentStep.ResultCallback,
    ]);
    expect(steps.every((s) => ['pending', 'running', 'completed'].includes(s.status))).toBe(true);
    expect(steps.some((s) => s.status === 'failed')).toBe(false);
  });
});

test('actual model request boundary is running while the simulated transport is unresolved', async () => {
  jest.spyOn(ai, 'isOpenAIAvailable').mockReturnValue(true);
  let finish!: (value: object) => void;
  jest.spyOn(ai, 'callOpenAIJSON').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = runAgentTask({ agentType: 'selection', input });
  // pglite 可见性兜底：并发写入的 progress 行可能短暂读不到，轮询等待。
  const row = await pollDbRow<{ steps: string }>(db, 'SELECT steps FROM agent_progress');
  expect(JSON.parse((row as { steps: string }).steps).find((step: { step: string }) => step.step === AgentStep.ModelReasoning).status).toBe('running');
  finish({ products: [] });
  expect((await pending).status).toBe('completed');
});

progressFailureTest('a real progress database failure swallowed by model fallback cannot produce task success', async () => {
  jest.spyOn(ai, 'isOpenAIAvailable').mockReturnValue(true);
  // pglite 单语句语义：DDL 必须逐条 exec，多语句串会挂起。
  await db.exec(`CREATE OR REPLACE FUNCTION reject_model_progress_fn() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.steps LIKE '%"step":"model-reasoning","status":"running"%' THEN
        RAISE EXCEPTION 'injected model progress failure';
      END IF;
      RETURN NEW;
    END;
  $$ LANGUAGE plpgsql;`);
  await db.exec('DROP TRIGGER IF EXISTS reject_model_progress ON agent_progress');
  await db.exec('CREATE TRIGGER reject_model_progress BEFORE UPDATE ON agent_progress FOR EACH ROW EXECUTE FUNCTION reject_model_progress_fn();');
  const task = await runAgentTask({ agentType: 'selection', input });
  // trigger 异常会使 pglite 桥残留毒消息（见 db-compat 说明 3），断言前先冲刷。
  await flushPgliteBridge(db);
  expect(task.status).toBe('failed');
  expect(task.error).toContain('injected model progress failure');
  expect((await new TaskLogRepository(db).findById(Number(task.taskId)))!.status).toBe('failed');
});
