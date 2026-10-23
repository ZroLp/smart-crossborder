'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress'

interface ContentItem {
  id: string
  title: string
  description: string
  language: string
  type: string
  createdAt: string
}

const DEFAULT_STEPS: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
]

export default function ContentPage() {
  const [language, setLanguage] = useState('en')
  const [product, setProduct] = useState('')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<StepInfo[]>(DEFAULT_STEPS)
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchContent = useCallback(async () => {
    try {
      setIsLoadingContent(true)
      const res = await fetch('/api/data?type=task-logs&agentType=content&limit=50')
      const data = await res.json()
      if (data.success && data.data) {
        setGeneratedContent(data.data.map((c: any, i: number) => ({
          id: c.id || `content-${i}`,
          title: c.title || c.name || `内容${i + 1}`,
          description: c.description || c.desc || c.content || '',
          language: c.language || language,
          type: c.type || '文案',
          createdAt: c.createdAt || new Date().toISOString(),
        })))
      } else {
        setGeneratedContent([])
      }
    } catch {
      setGeneratedContent([])
    } finally {
      setIsLoadingContent(false)
    }
  }, [language])

  const fetchProgress = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/agent/progress?taskId=${taskId}&agentType=content`)
      const data = await res.json()
      if (data.success && data.data?.steps) {
        setStepProgress(data.data.steps)
        const hasRunning = data.data.steps.some((s: StepInfo) => s.status === 'running')
        if (!hasRunning && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          fetchContent()
        }
      }
    } catch {}
  }, [fetchContent])

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

  useEffect(() => {
    if (product) {
      fetchContent()
    }
  }, [product, fetchContent])

  const handleSubmit = async () => {
    if (!product) return
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'content',
          input: { language, productId: product },
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.taskId) {
        setCurrentTaskId(data.data.taskId)
        setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
        startPolling(data.data.taskId)
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
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">AI 内容创作</h2>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">目标语言</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">选择商品</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">请选择商品</option>
              <option value="1">无线蓝牙耳机</option>
              <option value="2">智能手表</option>
              <option value="3">便携式充电宝</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 min-h-[300px]">
        <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-4">生成内容预览</p>
        {isLoadingContent ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-[#2A2D35] rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 dark:bg-[#22252D] rounded w-full"></div>
            <div className="h-3 bg-gray-100 dark:bg-[#22252D] rounded w-5/6"></div>
          </div>
        ) : generatedContent.length === 0 ? (
          <div className="border border-dashed border-gray-200 dark:border-[#2A2D35] rounded-lg p-8 text-center text-gray-400 dark:text-[#6B7080] text-sm">
            选择商品后，AI将自动生成多语言标题、描述和营销文案
          </div>
        ) : (
          <div className="space-y-4">
            {generatedContent.slice(0, 5).map((item) => (
              <div key={item.id} className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-[#1D2129] dark:text-[#E8EAED] text-sm">{item.title}</h4>
                  <div className="flex gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.language}</span>
                    <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">{item.type}</span>
                  </div>
                </div>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          生成文案
        </button>
        <button onClick={() => {
          if (!product) return
          fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentType: 'content',
              input: { language, productId: product, type: 'materials' },
            }),
          }).then(res => res.json()).then(data => {
            if (data.success && data.data?.taskId) {
              setCurrentTaskId(data.data.taskId)
              setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
              startPolling(data.data.taskId)
            }
          }).catch(() => {})
        }} className="bg-purple text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          生成素材
        </button>
        <button onClick={() => {
          if (!product) return
          fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentType: 'content',
              input: { language, productId: product, type: 'batch-update' },
            }),
          }).then(res => res.json()).then(data => {
            if (data.success && data.data?.taskId) {
              setCurrentTaskId(data.data.taskId)
              setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
              startPolling(data.data.taskId)
            }
          }).catch(() => {})
        }} className="bg-teal text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          批量更新
        </button>
      </div>

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
