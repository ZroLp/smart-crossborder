'use client'

import { useState, useCallback } from 'react'
import type { AgentTaskStatus, AgentStepStatus, StepInfo } from '@/hooks/useAgentTask'

export type { StepInfo } from '@/hooks/useAgentTask'

interface AIStepProgressProps {
  taskId: string
  steps: StepInfo[]
  taskStatus?: AgentTaskStatus | null
  errorMessage?: string | null
  busy?: 'pause' | 'terminate' | 'retry' | null
  onPause?: () => void
  onTerminate?: () => void
  onRetry?: () => void
  onDismissError?: () => void
}

const STATUS_ICONS: Record<AgentStepStatus, string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
  paused: '⏸️',
  terminated: '⛔',
}

const STEP_STATUS_LABELS: Record<AgentStepStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  terminated: '已终止',
}

const TASK_STATUS_META: Record<AgentTaskStatus, { label: string; className: string }> = {
  pending: { label: '等待中', className: 'bg-[#4E5969]/10 text-[#4E5969]' },
  running: { label: '执行中', className: 'bg-primary/10 text-primary' },
  paused: { label: '已暂停', className: 'bg-[#FF7D00]/10 text-[#FF7D00]' },
  completed: { label: '已完成', className: 'bg-success/10 text-success' },
  failed: { label: '执行失败', className: 'bg-danger/10 text-danger' },
  terminated: { label: '已终止', className: 'bg-danger/10 text-danger' },
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === undefined || ms === null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AIStepProgress({
  taskId,
  steps,
  taskStatus,
  errorMessage,
  busy,
  onPause,
  onTerminate,
  onRetry,
  onDismissError,
}: AIStepProgressProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleExpand = useCallback(
    (index: number) => {
      const step = steps[index]
      if (step.status !== 'completed' && step.status !== 'failed' && step.status !== 'paused') return
      setExpandedStep((prev) => (prev === index ? null : index))
    },
    [steps]
  )

  const hasRunning = steps.some((s) => s.status === 'running')
  const hasFailed = steps.some((s) => s.status === 'failed')

  const canPause = taskStatus ? taskStatus === 'running' : hasRunning
  const canTerminate = taskStatus
    ? taskStatus === 'pending' || taskStatus === 'running' || taskStatus === 'paused'
    : hasRunning || hasFailed
  const canRetry = taskStatus
    ? taskStatus === 'failed' || taskStatus === 'terminated' || taskStatus === 'paused'
    : hasFailed

  const isBusy = Boolean(busy)
  const statusMeta = taskStatus ? TASK_STATUS_META[taskStatus] : null

  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6" data-testid="ai-step-progress">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">AI 推理进度</h3>
        <div className="flex items-center gap-2">
          {statusMeta && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}
              data-testid="task-status"
            >
              {statusMeta.label}
            </span>
          )}
          <span className="text-xs text-[#86909C] dark:text-[#6B7080]">任务ID: {taskId}</span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2"
          data-testid="task-error"
        >
          <p className="text-xs text-danger">{errorMessage}</p>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="text-danger/70 hover:text-danger text-base leading-none"
              aria-label="关闭错误提示"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex items-start w-full">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const isCompleted = step.status === 'completed'
          const isRunning = step.status === 'running'
          const isFailed = step.status === 'failed'
          const isPaused = step.status === 'paused'
          const isTerminated = step.status === 'terminated'
          const isExpanded = expandedStep === index

          const dotStyle: React.CSSProperties = {}
          if (isRunning) {
            dotStyle.background = 'linear-gradient(135deg, #1677FF, #722ED1)'
            dotStyle.animation = 'ai-flow 2s ease infinite'
            dotStyle.backgroundSize = '200% 200%'
          } else if (isCompleted) {
            dotStyle.background = '#00B42A'
          } else if (isFailed || isTerminated) {
            dotStyle.background = '#F53F3F'
          } else if (isPaused) {
            dotStyle.background = '#FF7D00'
          }

          const lineStyle: React.CSSProperties = {}
          if (isCompleted) {
            lineStyle.background = 'linear-gradient(90deg, #722ED1, #1677FF)'
          } else if (isRunning && index > 0) {
            const prevCompleted = steps[index - 1]?.status === 'completed'
            if (prevCompleted) {
              lineStyle.background = 'linear-gradient(90deg, #722ED1, #1677FF)'
            }
          }

          const isClickable = isCompleted || isFailed || isPaused

          return (
            <div key={step.step} className={`flex flex-col ${isLast ? '' : 'flex-1'}`}>
              <div className="flex items-center w-full">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                    !isCompleted && !isRunning && !isFailed && !isPaused && !isTerminated
                      ? 'bg-[#86909C]'
                      : ''
                  } ${isClickable ? 'cursor-pointer' : ''}`}
                  style={dotStyle}
                  onClick={() => toggleExpand(index)}
                  data-testid={`step-dot-${index}`}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  <span className={isRunning ? 'animate-spin' : ''} data-testid={`step-icon-${index}`}>
                    {STATUS_ICONS[step.status]}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 h-0.5 mx-1.5 rounded-full bg-[#E5E6EB]" style={lineStyle} />
                )}
              </div>

              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-medium ${
                    isRunning
                      ? 'text-primary'
                      : isCompleted
                        ? 'text-[#00B42A]'
                        : isFailed || isTerminated
                          ? 'text-[#F53F3F]'
                          : isPaused
                            ? 'text-[#FF7D00]'
                            : 'text-[#86909C]'
                  }`}
                  data-testid={`step-label-${index}`}
                >
                  {step.label}
                </p>
                {step.duration !== undefined && step.duration !== null && (
                  <p
                    className="text-[10px] text-[#86909C] dark:text-[#6B7080] mt-0.5"
                    data-testid={`step-duration-${index}`}
                  >
                    {formatDuration(step.duration)}
                  </p>
                )}
                {(isPaused || isTerminated) && (
                  <p className="text-[10px] text-[#86909C] dark:text-[#6B7080] mt-0.5">
                    {STEP_STATUS_LABELS[step.status]}
                  </p>
                )}
              </div>

              {isExpanded && (isCompleted || isFailed || isPaused) && (
                <div
                  className="mt-3 p-3 bg-[#F5F7FA] dark:bg-[#0F1117] rounded-lg text-xs space-y-2"
                  data-testid={`step-detail-${index}`}
                >
                  {step.input && (
                    <div>
                      <p className="text-[#86909C] dark:text-[#6B7080] mb-1">输入</p>
                      <p className="text-[#1D2129] dark:text-[#E8EAED] break-all">{step.input}</p>
                    </div>
                  )}
                  {step.output && (
                    <div>
                      <p className="text-[#86909C] dark:text-[#6B7080] mb-1">输出</p>
                      <p className="text-[#1D2129] dark:text-[#E8EAED] break-all">{step.output}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-[#2A2D35]">
        <button
          onClick={onPause}
          disabled={!canPause || isBusy}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#FF7D00]/10 text-[#FF7D00] hover:bg-[#FF7D00]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-pause"
        >
          {busy === 'pause' ? '暂停中...' : '暂停'}
        </button>
        <button
          onClick={onTerminate}
          disabled={!canTerminate || isBusy}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F53F3F]/10 text-[#F53F3F] hover:bg-[#F53F3F]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-terminate"
        >
          {busy === 'terminate' ? '终止中...' : '终止'}
        </button>
        <button
          onClick={onRetry}
          disabled={!canRetry || isBusy}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-retry"
        >
          {busy === 'retry' ? '重试中...' : '重新生成'}
        </button>
      </div>
    </div>
  )
}
