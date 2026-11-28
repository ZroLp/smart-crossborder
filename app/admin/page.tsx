'use client'

import { useState, useEffect } from 'react'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useTranslation } from '@/lib/i18n/use-translation'

interface AdminStats {
  totalUsers: number
  totalShops: number
  totalOrders: number
  totalGMV: number
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setStats(data.stats)
          }
        }
      } catch {
        console.error('Failed to fetch admin stats')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards: { label: string; key: keyof AdminStats; color: string; icon: string }[] = [
    { label: t('admin.statUsers'), key: 'totalUsers', color: 'text-primary', icon: '👥' },
    { label: t('admin.statShops'), key: 'totalShops', color: 'text-purple', icon: '🏪' },
    { label: t('admin.statOrders'), key: 'totalOrders', color: 'text-success', icon: '📦' },
    { label: t('admin.statGMV'), key: 'totalGMV', color: 'text-teal', icon: '💰' },
  ]

  const formatGMV = (value: number) => {
    return '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getValue = (key: keyof AdminStats) => {
    if (!stats) return '--'
    const val = stats[key]
    if (key === 'totalGMV') return formatGMV(val)
    return val.toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">{t('admin.overviewNav')}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <SkeletonLoader variant="text" width="60%" height="14px" />
              <div className="mt-3">
                <SkeletonLoader variant="text" width="80%" height="28px" />
              </div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.key} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{card.icon}</span>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{card.label}</p>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {getValue(card.key)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">{t('admin.noStatsTitle')}</h3>
          <p className="text-sm text-[#86909C] dark:text-[#6B7080]">{t('admin.noStatsHint')}</p>
        </div>
      )}
    </div>
  )
}
