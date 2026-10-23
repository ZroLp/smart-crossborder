'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress'

const DEFAULT_STEPS: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
]

interface SelectedProduct {
  id: string
  name: string
  price: string
  profit: string
  demand: string
  competition: string
  score: number
}

export default function SelectionPage() {
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')
  const [keyword, setKeyword] = useState('')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<StepInfo[]>(DEFAULT_STEPS)
  const [isFetchingResults, setIsFetchingResults] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchResults = useCallback(async (taskId: string) => {
    try {
      setIsFetchingResults(true)
      const res = await fetch(`/api/data?type=products&agentType=selection&limit=20`)
      const data = await res.json()
      if (data.success && data.data) {
        setSelectedProducts(data.data.map((p: any, i: number) => ({
          id: p.id || `product-${i}`,
          name: p.name || p.title || '未知商品',
          price: p.price ? `¥${p.price}` : '¥--',
          profit: p.profitMargin ? `${p.profitMargin}%` : '--',
          demand: p.demand || '中等',
          competition: p.competition || '低',
          score: p.score || Math.floor(Math.random() * 30 + 70),
        })))
      }
    } catch {
      setSelectedProducts([])
    } finally {
      setIsFetchingResults(false)
    }
  }, [])

  const fetchProgress = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/agent/progress?taskId=${taskId}&agentType=selection`)
      const data = await res.json()
      if (data.success && data.data?.steps) {
        setStepProgress(data.data.steps)
        const hasRunning = data.data.steps.some((s: StepInfo) => s.status === 'running')
        if (!hasRunning && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          fetchResults(taskId)
        }
      }
    } catch {}
  }, [fetchResults])

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
          agentType: 'selection',
          input: { category, region, keyword },
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
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">AI 智能选品</h2>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">品类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">全部分类</option>
              <option value="electronics">电子数码</option>
              <option value="clothing">服装鞋帽</option>
              <option value="home">家居生活</option>
              <option value="beauty">美妆个护</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">目标市场</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">全部地区</option>
              <option value="us">北美</option>
              <option value="eu">欧洲</option>
              <option value="sea">东南亚</option>
              <option value="jp">日本</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">搜索关键词</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入商品关键词..."
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED] dark:placeholder-[#6B7080]"
            />
          </div>
          <button
            onClick={handleSubmit}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            开始AI选品
          </button>
        </div>
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

      {isFetchingResults && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-[#22252D] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isFetchingResults && selectedProducts.length > 0 && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35]">
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">推荐商品</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                <th className="px-6 py-3 font-medium">商品名称</th>
                <th className="px-6 py-3 font-medium">价格</th>
                <th className="px-6 py-3 font-medium">利润率</th>
                <th className="px-6 py-3 font-medium">需求</th>
                <th className="px-6 py-3 font-medium">竞争度</th>
                <th className="px-6 py-3 font-medium">评分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
              {selectedProducts.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{p.name}</td>
                  <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{p.price}</td>
                  <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{p.profit}</td>
                  <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{p.demand}</td>
                  <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{p.competition}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.score >= 85 ? 'bg-success/10 text-success' :
                      p.score >= 70 ? 'bg-primary/10 text-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {p.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!currentTaskId && !isFetchingResults && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-[#4E5969] dark:text-[#A0A4AC]">
          <span className="text-4xl mb-4">🔍</span>
          <p className="text-base">输入选品指令，AI将为您推荐爆款商品</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-[#6B7080]">支持自然语言描述，如"适合北美市场的夏季户外用品"</p>
        </div>
      )}
    </div>
  )
}
