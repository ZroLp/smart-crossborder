'use client'

import { useState, useCallback } from 'react'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'
import { useTranslation } from '@/lib/i18n/use-translation'

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
  const { t } = useTranslation()
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
          data.data.map((p: any, i: number) => {
            // Derive display metrics from real product fields only; show "—" for missing dimensions.
            const price = Number(p.price) || 0
            const cost = Number(p.cost) || 0
            const sales = Number(p.sales) || 0
            const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0
            const demand = sales >= 1000 ? t('selection.demandHigh') : sales >= 300 ? t('selection.demandMid') : t('selection.demandLow')
            const score = Math.round(
              Math.min(100, Math.max(0, margin * 0.5 + Math.min(100, sales / 20) * 0.5))
            )

            return {
              id: p.id || `product-${i}`,
              name: p.name || p.title || t('selection.unknownProduct'),
              price: p.price ? `¥${p.price}` : '¥--',
              profit: price > 0 ? `${margin}%` : '--',
              demand,
              competition: '—',
              score,
            }
          })
        )
      }
    } catch {
      setSelectedProducts([])
    } finally {
      setIsFetchingResults(false)
    }
  }, [t])

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
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('selection.title')}</h2>

      {error && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label={t('common.closeError')}
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('selection.category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">{t('selection.catAll')}</option>
              <option value="electronics">{t('selection.catElectronics')}</option>
              <option value="clothing">{t('selection.catClothing')}</option>
              <option value="home">{t('selection.catHome')}</option>
              <option value="beauty">{t('selection.catBeauty')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('selection.market')}</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">{t('selection.regionAll')}</option>
              <option value="us">{t('selection.regionUs')}</option>
              <option value="eu">{t('selection.regionEu')}</option>
              <option value="sea">{t('selection.regionSea')}</option>
              <option value="jp">{t('selection.regionJp')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('selection.keyword')}</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('selection.keywordPlaceholder')}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED] dark:placeholder-[#6B7080]"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('common.submitting') : t('selection.start')}
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
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('selection.recommended')}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                <th className="px-6 py-3 font-medium">{t('selection.colName')}</th>
                <th className="px-6 py-3 font-medium">{t('selection.colPrice')}</th>
                <th className="px-6 py-3 font-medium">{t('selection.colProfit')}</th>
                <th className="px-6 py-3 font-medium">{t('selection.colDemand')}</th>
                <th className="px-6 py-3 font-medium">{t('selection.colCompetition')}</th>
                <th className="px-6 py-3 font-medium">{t('selection.colScore')}</th>
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
          <p className="text-base">{t('selection.empty')}</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-[#6B7080]">
            {t('selection.emptyHint')}
          </p>
        </div>
      )}
    </div>
  )
}
