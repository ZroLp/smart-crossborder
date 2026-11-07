'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'terminated'

interface ExecutionStep {
  step: string
  label?: string
  status: StepStatus
  duration?: number | null
  input?: string
  output?: string
}

interface TaskData {
  id: string
  task_id?: string
  display_id?: string
  db_id?: number
  agent_module: string
  task_name: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'terminated'
  input: string | null
  output: string | null
  error: string | null
  created_at: string
  updated_at: string
  steps?: ExecutionStep[]
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'text-[#4E5969] bg-[#4E5969]/10' },
  running: { label: '执行中', color: 'text-primary bg-primary/10' },
  paused: { label: '已暂停', color: 'text-[#FF7D00] bg-[#FF7D00]/10' },
  completed: { label: '已完成', color: 'text-success bg-success/10' },
  failed: { label: '执行失败', color: 'text-danger bg-danger/10' },
  terminated: { label: '已终止', color: 'text-danger bg-danger/10' },
}

const stepStatusMap: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'text-[#4E5969] dark:text-[#A0A4AC]', label: '等待中' },
  running: { icon: '◌', color: 'text-primary', label: '执行中' },
  completed: { icon: '●', color: 'text-success', label: '已完成' },
  failed: { icon: '✕', color: 'text-danger', label: '失败' },
  paused: { icon: '⏸', color: 'text-[#FF7D00]', label: '已暂停' },
  terminated: { icon: '⛔', color: 'text-danger', label: '已终止' },
}

const RETRYABLE_STATUSES = ['failed', 'terminated', 'paused']

function formatStepDuration(duration: number | string | null | undefined): string {
  if (duration === undefined || duration === null) return ''
  if (typeof duration === 'string') return duration
  if (duration < 1000) return `${duration}ms`
  return `${(duration / 1000).toFixed(1)}s`
}

function formatTaskDuration(createdAt: string, updatedAt: string): string {
  const start = Date.parse(createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T'))
  const end = Date.parse(updatedAt.includes('T') ? updatedAt : updatedAt.replace(' ', 'T'))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  if (minutes < 60) return `${minutes}m ${remain}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [task, setTask] = useState<TaskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const fetchTask = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/task-logs/${encodeURIComponent(taskId)}`)
      const data = await res.json()
      if (res.ok === false || data.success === false) {
        throw new Error(data.error || '获取任务详情失败')
      }
      setTask(data.task as TaskData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (taskId) {
      fetchTask()
    }
  }, [taskId, fetchTask])

  const handleRetry = async () => {
    if (!task || retrying) return
    setRetrying(true)
    setRetryError(null)
    try {
      const sourceTaskId = task.task_id || (task.db_id ? String(task.db_id) : task.id)
      const res = await fetch('/api/agent/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: sourceTaskId }),
      })
      const data = await res.json()

      if (res.ok === false) {
        if (data.code === 'TASK_NOT_FOUND') {
          setRetryError('任务不存在或已被删除')
        } else if (data.code === 'INVALID_STATE') {
          setRetryError('当前任务状态不允许重新执行')
        } else {
          setRetryError(data.error || '重新执行失败，请稍后重试')
        }
        return
      }

      const newTaskId = data?.data?.displayId || data?.data?.taskId
      if (!newTaskId) {
        setRetryError(data.error || '重新执行失败，请稍后重试')
        return
      }

      router.push(`/dashboard/task-logs/${newTaskId}`)
    } catch {
      setRetryError('网络错误，重新执行失败')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#4E5969] dark:text-[#A0A4AC]">加载中...</div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          ← 返回任务列表
        </button>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-8 text-center">
          <p className="text-danger mb-4">{error || '任务不存在'}</p>
          <button
            onClick={() => fetchTask()}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  const status = statusMap[task.status] || statusMap.pending
  const canRetry = RETRYABLE_STATUSES.includes(task.status)
  const steps = task.steps ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          ← 返回任务列表
        </button>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? '重试中...' : '重新执行'}
          </button>
        )}
      </div>

      {retryError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{retryError}</p>
          <button
            onClick={() => setRetryError(null)}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">
              {task.task_name}
            </h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1 font-mono">{task.id}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4">
            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">Agent模块</p>
            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1 font-medium">
              {task.agent_module}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4">
            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">创建时间</p>
            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">{task.created_at}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4">
            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">更新时间</p>
            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">{task.updated_at}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4">
            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">耗时</p>
            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">
              {formatTaskDuration(task.created_at, task.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {task.input && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">输入数据</h3>
          <pre className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4 text-sm text-[#4E5969] dark:text-[#A0A4AC] overflow-x-auto whitespace-pre-wrap">
            {typeof task.input === 'string'
              ? (() => {
                  try {
                    return JSON.stringify(JSON.parse(task.input), null, 2)
                  } catch {
                    return task.input
                  }
                })()
              : JSON.stringify(task.input, null, 2)}
          </pre>
        </div>
      )}

      {task.output && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">输出数据</h3>
          <pre className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-4 text-sm text-[#4E5969] dark:text-[#A0A4AC] overflow-x-auto whitespace-pre-wrap">
            {typeof task.output === 'string'
              ? (() => {
                  try {
                    return JSON.stringify(JSON.parse(task.output), null, 2)
                  } catch {
                    return task.output
                  }
                })()
              : JSON.stringify(task.output, null, 2)}
          </pre>
        </div>
      )}

      {task.error && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-danger mb-3">错误信息</h3>
          <pre className="bg-danger/5 rounded-lg p-4 text-sm text-danger overflow-x-auto whitespace-pre-wrap">
            {task.error}
          </pre>
        </div>
      )}

      {steps.length > 0 && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">执行步骤</h3>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const meta = stepStatusMap[step.status] || stepStatusMap.pending
              return (
                <div
                  key={`${step.step}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]"
                >
                  <span className={`text-lg ${meta.color} mt-0.5`}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                        {step.label || step.step}
                      </p>
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    </div>
                    {step.duration !== undefined && step.duration !== null && (
                      <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                        耗时: {formatStepDuration(step.duration)}
                      </p>
                    )}
                    {step.output && (
                      <pre className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-2 bg-white dark:bg-[#181A20] p-2 rounded overflow-x-auto">
                        {step.output}
                      </pre>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
