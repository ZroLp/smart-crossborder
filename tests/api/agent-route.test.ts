import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { TaskLogRepository } from '@/lib/db/task-log-repository'
import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth/session'
import {
  createTask,
  resetTaskRuntimeForTests,
  transitionTask,
} from '@/lib/agents/task-service'

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
import { GET as getProgress } from '@/app/api/agent/progress/route'
import { POST as postPause } from '@/app/api/agent/pause/route'
import { POST as postTerminate } from '@/app/api/agent/terminate/route'
import { POST as postRetry } from '@/app/api/agent/retry/route'
import { GET as getTaskLogs } from '@/app/api/task-logs/route'
import { GET as getTaskLogDetail } from '@/app/api/task-logs/[id]/route'

let db: Database.Database
let token: string
let userId: number

beforeEach(() => {
  db = initDatabase(':memory:')
  jest.clearAllMocks()
  resetTaskRuntimeForTests()
  userId = Number(
    new UserRepository(db).create({ username: 'alice', password: 'x', email: null, role: 'viewer' })
      .lastInsertRowid
  )
  token = createSession(userId, db)
  mockExecuteTask.mockResolvedValue({ success: true, data: { products: [{ name: 'A' }] } })
  mockExecuteChain.mockResolvedValue([{ success: true, data: {} }])
})

afterEach(() => {
  db.close()
})

const authHeaders = (): Record<string, string> => ({ cookie: `${SESSION_COOKIE_NAME}=${token}` })

function agentRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

function controlRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/agent/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

function getRequest(url: string): NextRequest {
  return new NextRequest(url, { headers: authHeaders() })
}

function repo(): TaskLogRepository {
  return new TaskLogRepository(db)
}

describe('POST /api/agent (C-01 contract)', () => {
  test('returns taskId, displayId, status and the execution result', async () => {
    const response = await postAgent(
      agentRequest({
        agentType: 'selection',
        input: { products: [{ name: 'A', category: 'home', price: 10, cost: 5, sales: 1 }] },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.taskId).toMatch(/^\d+$/)
    expect(data.data.displayId).toMatch(/^TSK-\d{8}\d+$/)
    expect(data.data.agentType).toBe('selection')
    expect(data.data.status).toBe('completed')
    expect(data.data.result.success).toBe(true)

    const row = repo().findById(Number(data.data.taskId))!
    expect(row.status).toBe('completed')
  })

  test('persists failed executions with status failed and error', async () => {
    mockExecuteTask.mockResolvedValue({ success: false, error: '上游超时' })

    const response = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.data.status).toBe('failed')
    expect(data.error).toBe('上游超时')
  })

  test('rejects missing input and invalid agent types', async () => {
    const missing = await postAgent(agentRequest({ agentType: 'selection' }))
    expect(missing.status).toBe(400)

    const invalid = await postAgent(agentRequest({ agentType: 'nope', input: {} }))
    expect(invalid.status).toBe(400)
  })
})

describe('/api/agent/progress', () => {
  test('returns taskStatus and five steps after execution', async () => {
    const created = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const body = await created.json()
    const taskId = body.data.taskId

    const response = await getProgress(
      getRequest(`http://localhost/api/agent/progress?taskId=${taskId}&agentType=selection`)
    )
    const progress = await response.json()

    expect(response.status).toBe(200)
    expect(progress.data.taskId).toBe(taskId)
    expect(progress.data.taskStatus).toBe('completed')
    expect(progress.data.steps).toHaveLength(5)
    expect(progress.data.steps.map((s: { step: string }) => s.step)).toContain('data-collection')
  })

  test('returns 404 for unknown tasks', async () => {
    const response = await getProgress(
      getRequest('http://localhost/api/agent/progress?taskId=99999')
    )
    expect(response.status).toBe(404)
  })
})

describe('task control routes', () => {
  test('pause: 200 for running, 409 for pending, 404 for unknown', async () => {
    const running = createTask('selection', {}, userId)
    transitionTask(running.taskId, 'running')

    const ok = await postPause(controlRequest('pause', { taskId: running.taskId }))
    const okData = await ok.json()
    expect(ok.status).toBe(200)
    expect(okData.data.status).toBe('paused')

    const pending = createTask('selection', {}, userId)
    const conflict = await postPause(controlRequest('pause', { taskId: pending.taskId }))
    expect(conflict.status).toBe(409)

    const missing = await postPause(controlRequest('pause', { taskId: '99999' }))
    expect(missing.status).toBe(404)
  })

  test('terminate: 200 for running and 409 for completed', async () => {
    const running = createTask('selection', {}, userId)
    transitionTask(running.taskId, 'running')

    const ok = await postTerminate(controlRequest('terminate', { taskId: running.taskId }))
    expect((await ok.json()).data.status).toBe('terminated')

    const completed = createTask('selection', {}, userId)
    transitionTask(completed.taskId, 'running')
    transitionTask(completed.taskId, 'completed')
    const conflict = await postTerminate(controlRequest('terminate', { taskId: completed.taskId }))
    expect(conflict.status).toBe(409)
  })

  test('retry: creates a new taskId from the original input', async () => {
    const failed = createTask('selection', { category: 'beauty' }, userId)
    transitionTask(failed.taskId, 'running')
    transitionTask(failed.taskId, 'failed')

    const response = await postRetry(controlRequest('retry', { taskId: failed.taskId }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.taskId).not.toBe(failed.taskId)
    expect(data.data.status).toBe('completed')
    expect(repo().findById(Number(failed.taskId))!.status).toBe('failed')
  })

  test('control routes validate taskId', async () => {
    const response = await postPause(controlRequest('pause', {}))
    expect(response.status).toBe(400)
  })
})

describe('task log routes', () => {
  test('GET /api/task-logs paginates and filters', async () => {
    const first = createTask('selection', {}, userId)
    transitionTask(first.taskId, 'running')
    transitionTask(first.taskId, 'completed')
    createTask('content', {}, userId)

    const all = await (await getTaskLogs(getRequest('http://localhost/api/task-logs?page=1&limit=10'))).json()
    expect(all.success).toBe(true)
    expect(all.pagination.total).toBe(2)
    expect(all.data[0].taskId).toBeTruthy()

    const byStatus = await (await getTaskLogs(getRequest('http://localhost/api/task-logs?status=pending'))).json()
    expect(byStatus.pagination.total).toBe(1)
  })

  test('GET /api/task-logs/[id] returns displayId, status and steps', async () => {
    const created = await postAgent(agentRequest({ agentType: 'selection', input: {} }))
    const body = await created.json()
    const taskId = body.data.taskId
    const displayId = body.data.displayId

    const byNumeric = await getTaskLogDetail(
      getRequest(`http://localhost/api/task-logs/${taskId}`),
      { params: { id: taskId } }
    )
    const numericData = await byNumeric.json()
    expect(numericData.task.id).toBe(displayId)
    expect(numericData.task.status).toBe('completed')
    expect(numericData.task.steps).toHaveLength(5)

    const byDisplay = await getTaskLogDetail(
      getRequest(`http://localhost/api/task-logs/${displayId}`),
      { params: { id: displayId } }
    )
    expect((await byDisplay.json()).task.task_id).toBe(taskId)

    const missing = await getTaskLogDetail(
      getRequest('http://localhost/api/task-logs/99999'),
      { params: { id: '99999' } }
    )
    expect(missing.status).toBe(404)
  })
})

describe('C-02 session guards', () => {
  function anonymousAgentRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  test('returns 401 for anonymous agent and task-log requests', async () => {
    const agent = await postAgent(anonymousAgentRequest({ agentType: 'selection', input: {} }))
    expect(agent.status).toBe(401)
    expect((await agent.json()).code).toBe('UNAUTHORIZED')

    const list = await getTaskLogs(new NextRequest('http://localhost/api/task-logs'))
    expect(list.status).toBe(401)

    const progress = await getProgress(
      new NextRequest('http://localhost/api/agent/progress?taskId=1')
    )
    expect(progress.status).toBe(401)
  })

  test('cross-user task access returns 404', async () => {
    const created = createTask('selection', {}, userId)
    transitionTask(created.taskId, 'running')

    const otherUserId = Number(
      new UserRepository(db).create({ username: 'bob', password: 'x', email: null, role: 'viewer' })
        .lastInsertRowid
    )
    const otherToken = createSession(otherUserId, db)
    const otherHeaders = { cookie: `${SESSION_COOKIE_NAME}=${otherToken}` }

    const detail = await getTaskLogDetail(
      new NextRequest(`http://localhost/api/task-logs/${created.taskId}`, { headers: otherHeaders }),
      { params: { id: created.taskId } }
    )
    expect(detail.status).toBe(404)

    const progress = await getProgress(
      new NextRequest(`http://localhost/api/agent/progress?taskId=${created.taskId}`, {
        headers: otherHeaders,
      })
    )
    expect(progress.status).toBe(404)

    const pause = await postPause(
      new NextRequest('http://localhost/api/agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...otherHeaders },
        body: JSON.stringify({ taskId: created.taskId }),
      })
    )
    expect(pause.status).toBe(404)

    const list = await getTaskLogs(
      new NextRequest('http://localhost/api/task-logs', { headers: otherHeaders })
    )
    const listData = await list.json()
    expect(listData.data).toHaveLength(0)
  })
})
