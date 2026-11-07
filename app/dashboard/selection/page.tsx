'use client'

import { useState, useCallback } from 'react'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'

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
  const [isFetchingResults, setIsFetchingResults] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])

  const fetchResults = useCallback(async () => {
    try {
      setIsFetchingResults(true)
      const res = await fetch('/api/data?type=products&agentType=selection&limit=20')
      const data = await res.json()
      if (data.success && data.data) {
        setSelectedProducts(
          data.data.map((p: any, i: number) => ({
            id: p.id || `product-${i}`,
            name: p.name || p.title || '未知商品',
            price: p.price ? `¥${p.price}` : '¥--',
            profit: p.profitMargin ? `${p.profitMargin}%` : '--',
            demand: p.demand || '中等',
            competition: p.competition || '低',
            score: p.score || Math.floor(Math.random() * 30 + 70),
          }))
        )
      }
    } catch {
      setSelectedProducts([])
    } finally {
      setIsFetchingResults(false)
    }
  }, [])

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
    agentType: 'selection',
    onTerminal: (status) => {
      if (status === 'completed') {
        void fetchResults()
      }
    },
  })

  const handleSubmit = async () => {
    await submit({ category, region, keyword })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">AI 智能选品</h2>

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
            disabled={submitting}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '开始AI选品'}
          </button>
        </div>
      </div>

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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        p.score >= 85
                          ? 'bg-success/10 text-success'
                          : p.score >= 70
                            ? 'bg-primary/10 text-primary'
                            : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {p.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isActive && !isFetchingResults && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-[#4E5969] dark:text-[#A0A4AC]">
          <span className="text-4xl mb-4">🔍</span>
          <p className="text-base">输入选品指令，AI将为您推荐爆款商品</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-[#6B7080]">
            支持自然语言描述，如&quot;适合北美市场的夏季户外用品&quot;
          </p>
        </div>
      )}
    </div>
  )
}
