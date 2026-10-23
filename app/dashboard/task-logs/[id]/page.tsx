'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ExecutionStep {
  step: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: string
  output?: string
}

interface TaskData {
  id: string
  agent_module: string
  task_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: string | null
  output: string | null
  error: string | null
  created_at: string
  updated_at: string
  duration?: string
  steps?: ExecutionStep[]
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'text-[#4E5969] bg-[#4E5969]/10' },
  running: { label: '执行中', color: 'text-primary bg-primary/10' },
  completed: { label: '已完成', color: 'text-success bg-success/10' },
  failed: { label: '执行失败', color: 'text-danger bg-danger/10' },
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [task, setTask] = useState<TaskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/task-logs/${taskId}`)
        if (!res.ok) {
          throw new Error('获取任务详情失败')
        }
        const data = await res.json()
        if (data.success) {
          setTask(data.task)
        } else {
          setError(data.error || '未知错误')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    if (taskId) {
      fetchTask()
    }
  }, [taskId])

  const handleRetry = async () => {
    if (!task) return
    setRetrying(true)
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: task.agent_module,
          input: task.input ? JSON.parse(task.input) : {},
        }),
      })
      const data = await res.json()
      if (data.success) {
        const refreshRes = await fetch(`/api/task-logs/${taskId}`)
        const refreshData = await refreshRes.json()
        if (refreshData.success) {
          setTask(refreshData.task)
        }
      }
    } catch (err) {
      console.error('重试失败:', err)
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
          <p className="text-danger">{error || '任务不存在'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          ← 返回任务列表
        </button>
        {task.status === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? '重试中...' : '重新执行'}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">
              {task.task_name}
            </h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1 font-mono">
              {task.id}
            </p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${statusMap[task.status].color}`}
          >
            {statusMap[task.status].label}
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
              {task.duration || '—'}
            </p>
          </div>
        </div>
      </div>

      {task.input && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">
            输入数据
          </h3>
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
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">
            输出数据
          </h3>
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

      {task.steps && task.steps.length > 0 && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">
            执行步骤
          </h3>
          <div className="space-y-3">
            {task.steps.map((step) => {
              const stepStatusMap: Record<string, { icon: string; color: string; label: string }> = {
                pending: { icon: '○', color: 'text-[#4E5969] dark:text-[#A0A4AC]', label: '等待中' },
                running: { icon: '◌', color: 'text-primary', label: '执行中' },
                completed: { icon: '●', color: 'text-success', label: '已完成' },
                failed: { icon: '✕', color: 'text-danger', label: '失败' },
              }
              const stepStatus = stepStatusMap[step.status]
              return (
                <div
                  key={step.step}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]"
                >
                  <span className={`text-lg ${stepStatus.color} mt-0.5`}>{stepStatus.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                        {step.name}
                      </p>
                      <span className={`text-xs font-medium ${stepStatus.color}`}>
                        {stepStatus.label}
                      </span>
                    </div>
                    {step.duration && (
                      <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                        耗时: {step.duration}
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
