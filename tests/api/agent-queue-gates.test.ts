import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { TaskLogRepository } from '@/lib/db/task-log-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import {
  createTask,
  resetTaskRuntimeForTests,
} from '@/lib/agents/task-service'
import { TaskQueueWorker } from '@/lib/task-runtime/queue-worker'

const mockExecuteTask = jest.fn()
const mockExecuteChain = jest.fn()

jest.mock('@/lib/api/agent-service', () => {
  const actual = jest.requireActual('@/lib/api/agent-service')
  return {
    ...actual,
    getOrchestrator: jest.fn(() => ({
      executeTask: mockExecuteTask,
      executeChain: mockExecuteChain,
    })),
  }
})

import { POST as postAgent } from '@/app/api/agent/route'

let db: DbClient
let token: string
let userId: number

const originalQueueFlag = process.env.TASK_QUEUE_ENABLED

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  jest.clearAllMocks()
  resetTaskRuntimeForTests()
  // Keep the default inline path for the gate tests unless a test opts in.
  delete process.env.TASK_QUEUE_ENABLED
  userId = Number(
    (
      await new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' })
    ).lastInsertRowid
  )
  token = await createSession(userId, db)
  mockExecuteTask.mockResolvedValue({ success: true, data: { products: [{ name: 'A' }] } })
  mockExecuteChain.mockResolvedValue([{ success: true, data: {} }])
})

afterEach(async () => {
  process.env.TASK_QUEUE_ENABLED = originalQueueFlag
  await db.close()
})

function agentRequest(
  body: unknown,
  extraHeaders: Record<string, string> = {}
): NextRequest {
  return new NextRequest('http://localhost/api/agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
}

function repo(): TaskLogRepository {
  return new TaskLogRepository(db)
}

describe('P2-04 quota gate (402)', () => {
  test('returns 402 QUOTA_EXCEEDED with usage when AI call limit is reached', async () => {
    // Cap this user at 2 AI calls.
    await db.prepare('UPDATE users SET subscription_ai_calls = ? WHERE id = ?').run(2, userId)
    // Two tasks in a counted status bring usage to the limit.
    await createTask('selection', {}, userId)
    await createTask('content', {}, userId)

    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const data = await response.json()

    expect(response.status).toBe(402)
    expect(data.success).toBe(false)
    expect(data.code).toBe('QUOTA_EXCEEDED')
    expect(data.usage).toEqual({ used: 2, limit: 2 })
  })

  test('allows the request when a new user has no subscription columns set', async () => {
    // No subscription columns → unlimited → allowed (no 402).
    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    expect(response.status).toBe(200)
    expect((await response.json()).success).toBe(true)
  })
})

describe('P2-03b concurrency cap (429)', () => {
  test('returns 429 CONCURRENCY_LIMIT when a 4th active task is submitted', async () => {
    await createTask('selection', {}, userId)
    await createTask('selection', {}, userId)
    await createTask('selection', {}, userId) // 3 active (pending)

    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.success).toBe(false)
    expect(data.code).toBe('CONCURRENCY_LIMIT')
  })

  test('allows a submit while under the cap', async () => {
    await createTask('selection', {}, userId)
    await createTask('selection', {}, userId) // 2 active < 3

    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    expect(response.status).toBe(200)
  })
})

describe('P2-03a idempotency', () => {
  test('two submits with the same Idempotency-Key share one task row', async () => {
    const key = 'idem-key-123'
    const first = await postAgent(
      agentRequest({ agentType: 'selection', input: {} }, { 'Idempotency-Key': key })
    )
    const firstData = await first.json()
    const second = await postAgent(
      agentRequest({ agentType: 'selection', input: {} }, { 'Idempotency-Key': key })
    )
    const secondData = await second.json()

    expect(firstData.data.taskId).toBe(secondData.data.taskId)
    const rows = await db
      .prepare('SELECT * FROM task_logs WHERE idempotency_key = ?')
      .all(key)
    expect(rows).toHaveLength(1)
  })
})

describe('P2-01 enqueue mode (202 + worker pickup)', () => {
  test('returns 202 pending without running inline, then the worker completes it', async () => {
    process.env.TASK_QUEUE_ENABLED = '1'

    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const data = await response.json()

    expect(response.status).toBe(202)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('pending')
    expect(data.data.queued).toBe(true)
    // No synchronous execution in enqueue mode.
    expect(mockExecuteTask).not.toHaveBeenCalled()
    expect(mockExecuteChain).not.toHaveBeenCalled()

    // The queue worker claims and completes the pending task.
    const worker = new TaskQueueWorker({ workerId: 'test-worker' })
    const claimedId = await worker.claimAndRunOnce()
    expect(claimedId).toBe(Number(data.data.taskId))
    expect(mockExecuteTask).toHaveBeenCalledTimes(1)

    const row = await repo().findById(Number(data.data.taskId))
    expect(row!.status).toBe('completed')
  })
})
