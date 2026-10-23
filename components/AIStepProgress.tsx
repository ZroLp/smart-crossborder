'use client'

import { useState, useCallback } from 'react'

export interface StepInfo {
  step: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
  input?: string
  output?: string
}

interface AIStepProgressProps {
  taskId: string
  steps: StepInfo[]
  onPause?: () => void
  onTerminate?: () => void
  onRetry?: () => void
}

const STATUS_ICONS: Record<StepInfo['status'], string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AIStepProgress({ taskId, steps, onPause, onTerminate, onRetry }: AIStepProgressProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleExpand = useCallback((index: number) => {
    const step = steps[index]
    if (step.status !== 'completed' && step.status !== 'failed') return
    setExpandedStep(prev => prev === index ? null : index)
  }, [steps])

  const hasRunning = steps.some(s => s.status === 'running')
  const hasFailed = steps.some(s => s.status === 'failed')

  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6" data-testid="ai-step-progress">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">AI 推理进度</h3>
        <span className="text-xs text-[#86909C] dark:text-[#6B7080]">任务ID: {taskId}</span>
      </div>

      <div className="flex items-start w-full">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const isCompleted = step.status === 'completed'
          const isRunning = step.status === 'running'
          const isFailed = step.status === 'failed'
          const isExpanded = expandedStep === index

          const dotStyle: React.CSSProperties = {}
          if (isRunning) {
            dotStyle.background = 'linear-gradient(135deg, #1677FF, #722ED1)'
            dotStyle.animation = 'ai-flow 2s ease infinite'
            dotStyle.backgroundSize = '200% 200%'
          } else if (isCompleted) {
            dotStyle.background = '#00B42A'
          } else if (isFailed) {
            dotStyle.background = '#F53F3F'
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

          const isClickable = isCompleted || isFailed

          return (
            <div key={step.step} className={`flex flex-col ${isLast ? '' : 'flex-1'}`}>
              <div className="flex items-center w-full">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                    !isCompleted && !isRunning && !isFailed ? 'bg-[#86909C]' : ''
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
                  <div
                    className="flex-1 h-0.5 mx-1.5 rounded-full bg-[#E5E6EB]"
                    style={lineStyle}
                  />
                )}
              </div>

              <div className="mt-2 text-center">
                <p className={`text-xs font-medium ${
                  isRunning ? 'text-primary' :
                  isCompleted ? 'text-[#00B42A]' :
                  isFailed ? 'text-[#F53F3F]' :
                  'text-[#86909C]'
                }`} data-testid={`step-label-${index}`}>
                  {step.label}
                </p>
                {step.duration !== undefined && step.duration !== null && (
                  <p className="text-[10px] text-[#86909C] dark:text-[#6B7080] mt-0.5" data-testid={`step-duration-${index}`}>
                    {formatDuration(step.duration)}
                  </p>
                )}
              </div>

              {isExpanded && (isCompleted || isFailed) && (
                <div className="mt-3 p-3 bg-[#F5F7FA] dark:bg-[#0F1117] rounded-lg text-xs space-y-2" data-testid={`step-detail-${index}`}>
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
          disabled={!hasRunning}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#FF7D00]/10 text-[#FF7D00] hover:bg-[#FF7D00]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-pause"
        >
          暂停
        </button>
        <button
          onClick={onTerminate}
          disabled={!hasRunning && !hasFailed}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F53F3F]/10 text-[#F53F3F] hover:bg-[#F53F3F]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-terminate"
        >
          终止
        </button>
        <button
          onClick={onRetry}
          disabled={!hasFailed}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="btn-retry"
        >
          重新生成
        </button>
      </div>
    </div>
  )
}
