import type Database from 'better-sqlite3'
import { initDatabase } from '@/lib/db/init'
import { TaskLogRepository } from '@/lib/db/task-log-repository'
import { AgentProgressTracker } from '@/lib/framework/agent-progress'
import {
  InvalidTaskStateError,
  TaskNotFoundError,
  createTask,
  findTask,
  formatDisplayId,
  getTask,
  getTaskProgress,
  pauseTask,
  resetTaskRuntimeForTests,
  retryTask,
  runAgentTask,
  terminateTask,
  transitionTask,
} from '@/lib/agents/task-service'

const mockExecuteTask = jest.fn()
const mockExecuteChain = jest.fn()

jest.mock('@/lib/api/agent-service', () => ({
  getOrchestrator: jest.fn(() => ({
    executeTask: mockExecuteTask,
    executeChain: mockExecuteChain,
  })),
}))

let db: Database.Database

beforeEach(() => {
  db = initDatabase(':memory:')
  jest.clearAllMocks()
  resetTaskRuntimeForTests()
  mockExecuteTask.mockResolvedValue({ success: true, data: { products: [] } })
  mockExecuteChain.mockResolvedValue([{ success: true, data: {} }])
})

afterEach(() => {
  db.close()
})

function repo(): TaskLogRepository {
  return new TaskLogRepository(db)
}

async function waitForRunning(taskId: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const task = repo().findById(Number(taskId))
    if (task && task.status === 'running') return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`task ${taskId} never reached running`)
}

describe('task-service lifecycle', () => {
  test('createTask persists a pending task with numeric taskId and displayId', () => {
    const task = createTask('selection', { category: 'electronics' }, 7)
    expect(task.taskId).toMatch(/^\d+$/)
    expect(task.displayId).toMatch(/^TSK-\d{8}\d+$/)
    expect(task.status).toBe('pending')
    expect(task.userId).toBe(7)

    const row = repo().findById(Number(task.taskId))!
    expect(row.status).toBe('pending')
    expect(row.user_id).toBe(7)
    expect(formatDisplayId(row)).toBe(task.displayId)
  })

  test('runAgentTask completes, stores output and writes five progress steps', async () => {
    const task = await runAgentTask({
      agentType: 'selection',
      input: { category: 'home' },
    })

    expect(task.status).toBe('completed')
    expect(task.result).toEqual({ success: true, data: { products: [] } })

    const row = repo().findById(Number(task.taskId))!
    expect(row.status).toBe('completed')
    expect(JSON.parse(row.output!).products).toEqual([])

    const tracker = new AgentProgressTracker(db)
    const progress = tracker.getProgress('selection', task.taskId)!
    expect(progress.steps).toHaveLength(5)
    expect(progress.steps.every((step) => step.status === 'pending')).toBe(true)
  })

  test('runAgentTask records a failure with the error message', async () => {
    mockExecuteTask.mockResolvedValue({ success: false, error: '模型调用失败' })

    const task = await runAgentTask({ agentType: 'selection', input: {} })

    expect(task.status).toBe('failed')
    expect(task.error).toBe('模型调用失败')
    const row = repo().findById(Number(task.taskId))!
    expect(row.status).toBe('failed')
    expect(row.error).toBe('模型调用失败')
  })

  test('chain execution completes when every step succeeds', async () => {
    mockExecuteChain.mockResolvedValue([
      { success: true, data: { a: 1 } },
      { success: true, data: { b: 2 } },
    ])

    const task = await runAgentTask({ agentType: 'selection', input: {}, chain: true })
    expect(task.status).toBe('completed')
    expect(Array.isArray(task.result)).toBe(true)
  })

  test('getTask and getTaskProgress resolve numeric and display ids', async () => {
    const task = await runAgentTask({ agentType: 'selection', input: {} })

    expect(getTask(task.taskId)!.taskId).toBe(task.taskId)
    expect(getTask(task.displayId)!.taskId).toBe(task.taskId)
    expect(findTask(task.displayId)!.id).toBe(Number(task.taskId))

    const progress = getTaskProgress(task.displayId)!
    expect(progress.taskStatus).toBe('completed')
    expect(progress.steps).toHaveLength(5)
    expect(getTaskProgress('9999')).toBeNull()
  })

  test('pauseTask moves a running task to paused', async () => {
    const created = createTask('selection', {})
    transitionTask(created.taskId, 'running')

    const paused = pauseTask(created.taskId)
    expect(paused.status).toBe('paused')
  })

  test('pauseTask rejects pending tasks and unknown ids', () => {
    const created = createTask('selection', {})
    expect(() => pauseTask(created.taskId)).toThrow(InvalidTaskStateError)
    expect(() => pauseTask('9999')).toThrow(TaskNotFoundError)
  })

  test('terminateTask moves a running task to terminated', async () => {
    const created = createTask('selection', {})
    transitionTask(created.taskId, 'running')

    const terminated = terminateTask(created.taskId)
    expect(terminated.status).toBe('terminated')
  })

  test('retryTask creates a new task from the original input', async () => {
    const created = createTask('selection', { category: 'beauty' })
    transitionTask(created.taskId, 'running')
    transitionTask(created.taskId, 'failed')

    const retried = await retryTask(created.taskId)

    expect(retried.taskId).not.toBe(created.taskId)
    expect(retried.status).toBe('completed')
    expect(retried.input).toEqual({ category: 'beauty' })
    const old = repo().findById(Number(created.taskId))!
    expect(old.status).toBe('failed')
  })

  test('retryTask rejects a running task', async () => {
    const created = createTask('selection', {})
    transitionTask(created.taskId, 'running')
    await expect(retryTask(created.taskId)).rejects.toThrow(InvalidTaskStateError)
  })

  test('terminate wins over an in-flight execution result', async () => {
    let resolveWork: (value: unknown) => void = () => undefined
    mockExecuteTask.mockImplementation(
      () => new Promise((resolve) => { resolveWork = resolve })
    )

    const pending = runAgentTask({ agentType: 'selection', input: {} })
    const created = repo().findAll(1, 0)[0]
    await waitForRunning(String(created.id))

    terminateTask(String(created.id))
    resolveWork({ success: true, data: {} })
    const result = await pending

    expect(result.status).toBe('terminated')
    expect(repo().findById(created.id)!.status).toBe('terminated')
  })
})
