import { initDatabase } from '@/lib/db/init';
import { createTask, runAgentTask, transitionTask } from '@/lib/agents/task-service';
import { getOrchestrator, resetOrchestrator } from '@/lib/api/agent-service';
import { taskRuntime, withTaskRuntime } from '@/lib/framework/task-runtime';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { AgentStep } from '@/lib/framework/agent-progress';
import * as ai from '@/lib/ai/openai-client';

let db: ReturnType<typeof initDatabase>;
const input = { products: [{ name: 'A', category: 'home', sales: 20, price: 10, cost: 2 }] };
beforeEach(() => { db = initDatabase(':memory:'); resetOrchestrator(); });
afterEach(() => { jest.restoreAllMocks(); resetOrchestrator(); db.close(); });

test('task entry rejects missing/unknown taskId and explicit standalone cannot bypass a task', async () => {
  const orchestrator = getOrchestrator();
  await expect(orchestrator.executeTask('selection', input)).rejects.toThrow('runtime');
  await expect(orchestrator.getAgent('selection')!.execute(input)).rejects.toThrow('runtime');
  expect(() => withTaskRuntime('', new AbortController().signal, () => undefined)).toThrow('taskId');
  expect(() => withTaskRuntime('99999', new AbortController().signal, () => undefined)).toThrow('Unknown');
  const task = createTask('selection', input);
  await withTaskRuntime(task.taskId, new AbortController().signal, async () => {
    await expect(orchestrator.getAgent('selection')!.execute(input)).rejects.toThrow('dispatched');
    expect(() => orchestrator.getAgent('selection')!.executeStandalone(input)).toThrow('bypass');
  });
  expect((await orchestrator.executeStandalone('selection', input)).success).toBe(true);
});

test('direct Orchestrator with an existing task uses its context and records only actual stages', async () => {
  const task = createTask('selection', input);
  transitionTask(task.taskId, 'running');
  await withTaskRuntime(task.taskId, new AbortController().signal, async () => {
    const result = await getOrchestrator().executeTask('selection', input);
    expect(result.success).toBe(true);
    const runtime = taskRuntime.getStore()!;
    expect(runtime.context.getData('selection', 'result')).toEqual(result.data);
    const steps = runtime.tracker.getProgress('selection', task.taskId)!.steps;
    expect(steps.map(step => [step.step, step.status])).toEqual([
      [AgentStep.DataCollection, 'completed'], [AgentStep.ModelReasoning, 'pending'],
      [AgentStep.StrategyGeneration, 'completed'], [AgentStep.Execution, 'pending'], [AgentStep.ResultCallback, 'completed'],
    ]);
  });
});

test('actual model request boundary is running while the simulated transport is unresolved', async () => {
  jest.spyOn(ai, 'isOpenAIAvailable').mockReturnValue(true);
  let finish!: (value: object) => void;
  jest.spyOn(ai, 'callOpenAIJSON').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = runAgentTask({ agentType: 'selection', input });
  const row = db.prepare('SELECT steps FROM agent_progress').get() as { steps: string };
  expect(JSON.parse(row.steps).find((step: { step: string }) => step.step === AgentStep.ModelReasoning).status).toBe('running');
  finish({ products: [] });
  expect((await pending).status).toBe('completed');
});

test('a real progress database failure swallowed by model fallback cannot produce task success', async () => {
  jest.spyOn(ai, 'isOpenAIAvailable').mockReturnValue(true);
  db.exec(`CREATE TRIGGER reject_model_progress BEFORE UPDATE ON agent_progress
    WHEN NEW.steps LIKE '%"step":"model-reasoning","status":"running"%'
    BEGIN SELECT RAISE(ABORT, 'injected model progress failure'); END`);
  const task = await runAgentTask({ agentType: 'selection', input });
  expect(task.status).toBe('failed');
  expect(task.error).toContain('injected model progress failure');
  expect(new TaskLogRepository(db).findById(Number(task.taskId))!.status).toBe('failed');
});
