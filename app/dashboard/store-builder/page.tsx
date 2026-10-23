'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress'

interface StoreTemplate {
  id: string
  name: string
  category: string
  desc: string
}

const DEFAULT_STEPS: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
]

export default function StoreBuilderPage() {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<StepInfo[]>(DEFAULT_STEPS)
  const [templates, setTemplates] = useState<StoreTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/data?type=task-logs&agentType=store-builder')
      const data = await res.json()
      if (data.success && data.data) {
        setTemplates(data.data.map((t: any, i: number) => ({
          id: t.id || `template-${i}`,
          name: t.name || t.title || `模板${i + 1}`,
          category: t.category || '综合',
          desc: t.desc || t.description || '建站模板',
        })))
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

  const fetchProgress = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/agent/progress?taskId=${taskId}&agentType=store-builder`)
      const data = await res.json()
      if (data.success && data.data?.steps) {
        setStepProgress(data.data.steps)
        const hasRunning = data.data.steps.some((s: StepInfo) => s.status === 'running')
        if (!hasRunning && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    } catch {}
  }, [])

  const startPolling = useCallback((taskId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    fetchProgress(taskId)
    pollingRef.current = setInterval(() => fetchProgress(taskId), 2000)
  }, [fetchProgress])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'store-builder',
          input: { action: 'create' },
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.taskId) {
        setCurrentTaskId(data.data.taskId)
        setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
        startPolling(data.data.taskId)
        fetchTemplates()
      }
    } catch {}
  }

  const handlePause = async () => {
    if (!currentTaskId) return
    try {
      await fetch(`/api/agent/pause?taskId=${currentTaskId}`, { method: 'POST' })
      setStepProgress(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'pending' as const } : s))
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    } catch {}
  }

  const handleTerminate = async () => {
    if (!currentTaskId) return
    try {
      await fetch(`/api/agent/terminate?taskId=${currentTaskId}`, { method: 'POST' })
    } catch {}
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setCurrentTaskId(null)
  }

  const handleRetry = async () => {
    if (!currentTaskId) return
    setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
    try {
      await fetch(`/api/agent/retry?taskId=${currentTaskId}`, { method: 'POST' })
      startPolling(currentTaskId)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">智能建站</h2>
        <button
          onClick={handleSubmit}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          一键建站
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden animate-pulse">
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
          <p className="text-base">暂无可用模板，点击"一键建站"创建新站点</p>
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
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.category}</span>
                </div>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-3">{t.desc}</p>
                <button onClick={() => {
                  fetch('/api/agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      agentType: 'store-builder',
                      input: { action: 'create', templateId: t.id },
                    }),
                  }).then(res => res.json()).then(data => {
                    if (data.success && data.data?.taskId) {
                      setCurrentTaskId(data.data.taskId)
                      setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
                      startPolling(data.data.taskId)
                      fetchTemplates()
                    }
                  }).catch(() => {})
                }} className="w-full bg-primary/10 text-primary py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                  使用模板
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentTaskId && (
        <AIStepProgress
          taskId={currentTaskId}
          steps={stepProgress}
          onPause={handlePause}
          onTerminate={handleTerminate}
          onRetry={handleRetry}
        />
      )}
    </div>
  )
}
