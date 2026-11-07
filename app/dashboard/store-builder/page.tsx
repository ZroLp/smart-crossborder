'use client'

import { useState, useEffect, useCallback } from 'react'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'

interface StoreTemplate {
  id: string
  name: string
  category: string
  desc: string
}

export default function StoreBuilderPage() {
  const [templates, setTemplates] = useState<StoreTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/data?type=task-logs&agentType=store-builder')
      const data = await res.json()
      if (data.success && data.data) {
        setTemplates(
          data.data.map((t: any, i: number) => ({
            id: t.id || `template-${i}`,
            name: t.name || t.title || `模板${i + 1}`,
            category: t.category || '综合',
            desc: t.desc || t.description || '建站模板',
          }))
        )
      } else {
        setTemplates([])
      }
    } catch {
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const {
    submit,
    pause,
    terminate,
    retry,
    displayId,
    taskId,
    taskStatus,
    steps,
    error,
    submitting,
    controlling,
    isActive,
    clearError,
  } = useAgentTask({
    agentType: 'store-builder',
    onTerminal: (status) => {
      if (status === 'completed') {
        void fetchTemplates()
      }
    },
  })

  const handleSubmit = async (templateId?: string) => {
    const outcome = await submit(
      templateId ? { action: 'create', templateId } : { action: 'create' }
    )
    if (outcome.ok && outcome.data?.status === 'completed') {
      void fetchTemplates()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">智能建站</h2>
        <button
          onClick={() => handleSubmit()}
          disabled={submitting}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '建站中...' : '一键建站'}
        </button>
      </div>

      {error && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden animate-pulse"
            >
              <div className="h-40 bg-gray-100 dark:bg-[#22252D]"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-[#2A2D35] rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 dark:bg-[#22252D] rounded w-1/2"></div>
                <div className="h-8 bg-gray-100 dark:bg-[#22252D] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-[#4E5969] dark:text-[#A0A4AC]">
          <span className="text-4xl mb-4">🏪</span>
          <p className="text-base">暂无可用模板，点击&quot;一键建站&quot;创建新站点</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
              <div className="h-40 bg-gradient-to-br from-primary/5 to-purple/5 flex items-center justify-center">
                <span className="text-5xl">🏪</span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{t.name}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {t.category}
                  </span>
                </div>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-3">{t.desc}</p>
                <button
                  onClick={() => handleSubmit(t.id)}
                  disabled={submitting}
                  className="w-full bg-primary/10 text-primary py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  使用模板
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isActive && (displayId || taskId) && (
        <AIStepProgress
          taskId={(displayId || taskId) as string}
          steps={steps}
          taskStatus={taskStatus}
          errorMessage={error}
          busy={controlling}
          onPause={pause}
          onTerminate={terminate}
          onRetry={retry}
          onDismissError={clearError}
        />
      )}
    </div>
  )
}
