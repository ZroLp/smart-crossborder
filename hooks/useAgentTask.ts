'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentType } from '@/lib/framework/types'

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated'

export type AgentStepStatus = AgentTaskStatus

export interface StepInfo {
  step: string
  label: string
  status: AgentStepStatus
  duration?: number | null
  input?: string
  output?: string
}

const STEP_LABELS: Array<{ step: string; label: string }> = [
  { step: 'data-collection', label: '数据采集' },
  { step: 'model-reasoning', label: '模型推理' },
  { step: 'strategy-generation', label: '策略生成' },
  { step: 'execution', label: '执行落地' },
  { step: 'result-callback', label: '结果回传' },
]

export function createDefaultSteps(): StepInfo[] {
  return STEP_LABELS.map((item) => ({ ...item, status: 'pending' as AgentStepStatus }))
}

export const TERMINAL_TASK_STATUSES: AgentTaskStatus[] = [
  'completed',
  'failed',
  'terminated',
  'paused',
]

export interface AgentTaskData {
  taskId: string
  displayId: string
  agentType?: string
  status: AgentTaskStatus
  result?: unknown
  error?: string | null
  [key: string]: unknown
}

export interface AgentTaskOutcome {
  ok: boolean
  data: AgentTaskData | null
  error: string | null
}

export interface UseAgentTaskOptions {
  agentType: AgentType
  /** 步骤骨架（默认五步），用于在服务端未返回 steps 前占位。 */
  steps?: StepInfo[]
  pollIntervalMs?: number
  /** 终态回调：completed / failed / terminated / paused，每任务每状态仅触发一次。 */
  onTerminal?: (status: AgentTaskStatus) => void
}

interface FetchLikeResponse {
  ok?: boolean
  status?: number
  headers?: { get: (name: string) => string | null }
  json: () => Promise<unknown>
}

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: string
  code?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTaskStatus(value: unknown): AgentTaskStatus | null {
  if (
    value === 'pending' ||
    value === 'running' ||
    value === 'paused' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'terminated'
  ) {
    return value
  }
  return null
}

function normalizeStepStatus(value: unknown): AgentStepStatus {
  return normalizeTaskStatus(value) ?? 'pending'
}

function cloneSteps(steps: StepInfo[]): StepInfo[] {
  return steps.map((step) => ({ ...step }))
}

/** Merge server steps onto the local skeleton, keeping stable order/labels. */
function mergeSteps(raw: unknown, skeleton: StepInfo[]): StepInfo[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  const byId = new Map<string, Record<string, unknown>>()
  for (const item of raw) {
    if (isRecord(item) && typeof item.step === 'string') {
      byId.set(item.step, item)
    }
  }

  return skeleton.map((base) => {
    const found = byId.get(base.step)
    if (!found) return { ...base }
    return {
      step: base.step,
      label: typeof found.label === 'string' && found.label ? found.label : base.label,
      status: normalizeStepStatus(found.status),
      duration: typeof found.duration === 'number' ? found.duration : null,
      input: typeof found.input === 'string' ? found.input : undefined,
      output: typeof found.output === 'string' ? found.output : undefined,
    }
  })
}

function normalizeTaskData(raw: unknown): AgentTaskData | null {
  if (!isRecord(raw)) return null
  const rawTaskId = raw.taskId
  if (typeof rawTaskId !== 'string' && typeof rawTaskId !== 'number') return null
  const taskId = String(rawTaskId)
  if (!taskId) return null

  const displayId = typeof raw.displayId === 'string' && raw.displayId ? raw.displayId : taskId

  return {
    ...raw,
    taskId,
    displayId,
    status: normalizeTaskStatus(raw.status) ?? 'completed',
    error: typeof raw.error === 'string' ? raw.error : null,
  }
}

async function readJson<T>(res: FetchLikeResponse): Promise<ApiEnvelope<T> | null> {
  try {
    const body = await res.json()
    return isRecord(body) ? (body as ApiEnvelope<T>) : null
  } catch {
    return null
  }
}

function messageForError(status: number, body: ApiEnvelope<unknown> | null, fallback: string): string {
  const code = body?.code
  if (status === 401) return '登录状态已失效，请重新登录后再试'
  if (status === 403) return '无权操作该任务'
  if (status === 404 || code === 'TASK_NOT_FOUND') return '任务不存在或已被删除'
  if (status === 409 || code === 'INVALID_STATE') return '当前任务状态不允许该操作'
  if (status === 429) return '操作过于频繁，请稍后再试'
  if (status === 400) {
    return body?.error ? `请求参数有误：${body.error}` : '请求参数有误，请稍后重试'
  }
  if (body?.error) return body.error
  return fallback
}

export function useAgentTask(options: UseAgentTaskOptions) {
  const { agentType, pollIntervalMs = 2000 } = options
  const skeletonRef = useRef<StepInfo[]>(options.steps ?? createDefaultSteps())
  const onTerminalRef = useRef(options.onTerminal)
  const controllingRef = useRef<null | 'pause' | 'terminate' | 'retry'>(null)
  const terminalNotifiedRef = useRef<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    onTerminalRef.current = options.onTerminal
  }, [options.onTerminal])

  const [taskId, setTaskId] = useState<string | null>(null)
  const [displayId, setDisplayId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<AgentTaskStatus>('pending')
  const [steps, setSteps] = useState<StepInfo[]>(() => cloneSteps(skeletonRef.current))
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [controlling, setControlling] = useState<null | 'pause' | 'terminate' | 'retry'>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const notifyTerminal = useCallback(
    (id: string, status: AgentTaskStatus) => {
      stopPolling()
      const key = `${id}:${status}`
      if (terminalNotifiedRef.current === key) return
      terminalNotifiedRef.current = key
      onTerminalRef.current?.(status)
    },
    [stopPolling]
  )

  const fetchProgress = useCallback(
    async (id: string): Promise<AgentTaskStatus | null> => {
      try {
        const res = (await fetch(
          `/api/agent/progress?taskId=${encodeURIComponent(id)}&agentType=${encodeURIComponent(agentType)}`
        )) as unknown as FetchLikeResponse
        const body = await readJson<Record<string, unknown>>(res)

        if (res.ok === false || body?.success === false) {
          if (res.status === 404) {
            setError('任务不存在或已被删除')
            stopPolling()
          }
          return null
        }

        const data = isRecord(body?.data) ? body.data : null
        if (!data) return null

        const status = normalizeTaskStatus(data.taskStatus ?? data.status)
        if (status) setTaskStatus(status)

        const merged = mergeSteps(data.steps, skeletonRef.current)
        if (merged) setSteps(merged)

        if (status && TERMINAL_TASK_STATUSES.includes(status)) {
          notifyTerminal(id, status)
        }
        return status
      } catch {
        return null
      }
    },
    [agentType, notifyTerminal, stopPolling]
  )

  const startPolling = useCallback(
    (id: string) => {
      stopPolling()
      pollingRef.current = setInterval(() => {
        void fetchProgress(id)
      }, pollIntervalMs)
    },
    [fetchProgress, pollIntervalMs, stopPolling]
  )

  const submit = useCallback(
    async (input: Record<string, unknown>, submitOptions?: { chain?: boolean }): Promise<AgentTaskOutcome> => {
      stopPolling()
      terminalNotifiedRef.current = null
      setSubmitting(true)
      setError(null)
      setResult(null)
      setTaskId(null)
      setDisplayId(null)
      setTaskStatus('pending')
      setSteps(cloneSteps(skeletonRef.current))

      try {
        const res = (await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentType, input, chain: submitOptions?.chain }),
        })) as unknown as FetchLikeResponse
        const body = await readJson<Record<string, unknown>>(res)

        if (res.ok === false) {
          const message = messageForError(res.status ?? 500, body, '任务创建失败，请稍后重试')
          setError(message)
          return { ok: false, data: null, error: message }
        }

        const taskData = normalizeTaskData(body?.data)
        if (!taskData) {
          const message = messageForError(
            res.status ?? 500,
            body,
            body?.error || '任务创建失败，请稍后重试'
          )
          setError(message)
          return { ok: false, data: null, error: message }
        }

        setTaskId(taskData.taskId)
        setDisplayId(taskData.displayId)
        setTaskStatus(taskData.status)
        setResult(taskData.result ?? null)

        let failure: string | null = null
        if (taskData.status === 'failed') {
          failure = body?.error || '任务执行失败，请稍后重试'
          setError(failure)
        }

        if (TERMINAL_TASK_STATUSES.includes(taskData.status)) {
          const polled = await fetchProgress(taskData.taskId)
          if (!polled) notifyTerminal(taskData.taskId, taskData.status)
        } else {
          startPolling(taskData.taskId)
        }

        return { ok: taskData.status !== 'failed' && body?.success !== false, data: taskData, error: failure }
      } catch {
        const message = '网络错误，请检查网络后重试'
        setError(message)
        return { ok: false, data: null, error: message }
      } finally {
        setSubmitting(false)
      }
    },
    [agentType, fetchProgress, notifyTerminal, startPolling, stopPolling]
  )

  const control = useCallback(
    async (action: 'pause' | 'terminate' | 'retry'): Promise<AgentTaskOutcome> => {
      if (!taskId) {
        return { ok: false, data: null, error: '当前没有可操作的任务' }
      }
      if (controllingRef.current) {
        return { ok: false, data: null, error: '操作正在进行中，请稍候' }
      }

      controllingRef.current = action
      setControlling(action)
      setError(null)
      stopPolling()

      try {
        const res = (await fetch(`/api/agent/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        })) as unknown as FetchLikeResponse
        const body = await readJson<Record<string, unknown>>(res)
        const taskData = normalizeTaskData(body?.data)

        if (res.ok === false || !taskData) {
          const message = messageForError(
            res.status ?? 500,
            body,
            body?.error || '操作失败，请稍后重试'
          )
          setError(message)
          return { ok: false, data: null, error: message }
        }

        const previousDisplayId = displayId
        setTaskId(taskData.taskId)
        setDisplayId(taskData.displayId || previousDisplayId)
        setTaskStatus(taskData.status)

        let failure: string | null = null
        if (action === 'retry') {
          terminalNotifiedRef.current = null
          setSteps(cloneSteps(skeletonRef.current))
          if (taskData.status === 'failed') {
            failure = body?.error || '任务执行失败，请稍后重试'
            setError(failure)
          }
          if (TERMINAL_TASK_STATUSES.includes(taskData.status)) {
            const polled = await fetchProgress(taskData.taskId)
            if (!polled) notifyTerminal(taskData.taskId, taskData.status)
          } else {
            startPolling(taskData.taskId)
          }
        } else {
          // Reflect paused/terminated immediately, then refine from progress.
          setSteps((prev) =>
            prev.map((step) => {
              if (step.status === 'running') {
                return { ...step, status: action === 'pause' ? 'paused' : 'terminated' }
              }
              if (action === 'terminate' && step.status === 'paused') {
                return { ...step, status: 'terminated' }
              }
              return step
            })
          )
          const polled = await fetchProgress(taskData.taskId)
          if (!polled) notifyTerminal(taskData.taskId, taskData.status)
        }

        return { ok: true, data: taskData, error: failure }
      } catch {
        const message = '网络错误，请检查网络后重试'
        setError(message)
        return { ok: false, data: null, error: message }
      } finally {
        controllingRef.current = null
        setControlling(null)
      }
    },
    [displayId, fetchProgress, notifyTerminal, startPolling, stopPolling, taskId]
  )

  const pause = useCallback(() => control('pause'), [control])
  const terminate = useCallback(() => control('terminate'), [control])
  const retry = useCallback(() => control('retry'), [control])

  const reset = useCallback(() => {
    stopPolling()
    terminalNotifiedRef.current = null
    setTaskId(null)
    setDisplayId(null)
    setTaskStatus('pending')
    setSteps(cloneSteps(skeletonRef.current))
    setResult(null)
    setError(null)
  }, [stopPolling])

  const clearError = useCallback(() => setError(null), [])

  return {
    agentType,
    taskId,
    displayId,
    taskStatus,
    steps,
    result,
    error,
    submitting,
    controlling,
    isActive: Boolean(taskId),
    isRunning: taskStatus === 'pending' || taskStatus === 'running',
    submit,
    pause,
    terminate,
    retry,
    reset,
    clearError,
  }
}

export type UseAgentTaskResult = ReturnType<typeof useAgentTask>
