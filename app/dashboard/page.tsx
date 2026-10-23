'use client'

import { useState, useEffect, useCallback } from 'react'
import AgentStatusCard from '@/components/AgentStatusCard'
import SkeletonLoader from '@/components/SkeletonLoader'
import RiskAlertPopup from '@/components/RiskAlertPopup'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  revenue: string
  orders: number
  roas: string
  csRate: string
  hasData: boolean
}

interface RiskAlert {
  id: string
  type: string
  title: string
  message: string
  link?: string
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([
    {
      id: 'alert-1',
      type: 'roas_drop',
      title: t('nav.adOptimizer') + ' ROAS ' + t('status.failed'),
      message: '广告ROAS降至3.2，低于阈值4.0，建议立即优化投放策略',
      link: '/dashboard/ad-optimizer',
    },
    {
      id: 'alert-2',
      type: 'inventory_low',
      title: t('dashboard.storeRevenue'),
      message: '热销商品SKU-28391库存不足50件，请及时补货',
      link: '/dashboard/fulfillment',
    },
  ])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date())

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLastRefreshTime(new Date())
      setIsRefreshing(false)
    }
  }, [])

  const refreshData = useCallback(() => {
    setIsRefreshing(true)
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshData()
    }, 300000)

    return () => clearInterval(interval)
  }, [refreshData])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleCloseAlert = (id: string) => {
    setRiskAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const handleJumpAlert = (link: string) => {
    window.location.href = link
  }

  const formatRevenue = (value: string) => {
    const num = parseFloat(value)
    return num.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }).replace('CNY', '¥')
  }

  const metrics = stats && stats.hasData
    ? [
        { label: t('dashboard.storeRevenue'), value: formatRevenue(stats.revenue), color: 'text-primary', abnormal: false },
        { label: t('dashboard.todayOrders'), value: stats.orders.toString(), color: 'text-success', abnormal: false },
        { label: t('dashboard.adROAS'), value: stats.roas, color: 'text-purple', abnormal: parseFloat(stats.roas) < 3 },
        { label: t('dashboard.customerServiceRate'), value: `${stats.csRate}%`, color: 'text-teal', abnormal: false },
      ]
    : [
        { label: t('dashboard.storeRevenue'), value: '¥0', color: 'text-primary', abnormal: false },
        { label: t('dashboard.todayOrders'), value: '0', color: 'text-success', abnormal: false },
        { label: t('dashboard.adROAS'), value: '0', color: 'text-purple', abnormal: false },
        { label: t('dashboard.customerServiceRate'), value: '0%', color: 'text-teal', abnormal: false },
      ]

  const agents = [
    { name: t('agents.selection'), type: t('agents.selection'), status: 'online' as const, taskCount: 5 },
    { name: t('agents.storeBuilder'), type: t('agents.storeBuilder'), status: 'online' as const, taskCount: 3 },
    { name: t('agents.content'), type: t('agents.content'), status: 'busy' as const, taskCount: 8 },
    { name: t('agents.adOptimizer'), type: t('agents.adOptimizer'), status: 'online' as const, taskCount: 2 },
    { name: t('agents.customerService'), type: t('agents.customerService'), status: 'online' as const, taskCount: 12 },
    { name: t('agents.fulfillment'), type: t('agents.fulfillment'), status: 'online' as const, taskCount: 6 },
  ]

  const tasks = [
    { title: t('dashboard.processShipments') + ' (3)', status: t('dashboard.pending'), statusColor: 'bg-warning/10 text-warning' },
    { title: t('dashboard.optimizeAdStrategy'), status: t('dashboard.inProgress'), statusColor: 'bg-primary/10 text-primary' },
    { title: t('dashboard.updateProductDesc'), status: t('status.completed'), statusColor: 'bg-success/10 text-success' },
  ]

  const quickActions = [
    { label: t('dashboard.oneClickSelection'), color: 'bg-primary', route: '/dashboard/selection' },
    { label: t('dashboard.oneClickStore'), color: 'bg-purple', route: '/dashboard/store-builder' },
    { label: t('dashboard.generateAssets'), color: 'bg-teal', route: '/dashboard/content' },
    { label: t('dashboard.optimizeAds'), color: 'bg-warning', route: '/dashboard/ad-optimizer' },
  ]

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes blink-red {
          0%, 100% { color: #F53F3F; }
          50% { color: #FF7D00; }
        }
        .abnormal-blink {
          animation: blink-red 1s ease-in-out infinite;
        }
      `}</style>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">{t('dashboard.overview')}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#86909C] dark:text-[#6B7080]">
            {t('common.updated')} {lastRefreshTime.toLocaleTimeString('zh-CN')}
          </span>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#F5F7FA] dark:bg-[#0F1117] text-[#4E5969] dark:text-[#A0A4AC] hover:bg-[#E5E6EB] dark:hover:bg-[#22252D] transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? t('common.refreshing') : t('common.refresh')}
          </button>
        </div>
      </div>

      {isRefreshing || isLoading ? (
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
      ) : stats && !stats.hasData ? (
        <div className="bg-gradient-to-br from-primary/5 to-purple/5 rounded-xl border-2 border-dashed border-primary/20 p-8 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">你还没有订单数据</h3>
          <p className="text-sm text-[#86909C] dark:text-[#6B7080] mb-4">试试下发 AI 指令，开始你的第一笔交易吧</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {metrics.map((m, i) => (
              <div key={i} className="bg-white/80 dark:bg-[#181A20]/80 rounded-xl p-4">
                <p className="text-xs text-[#86909C] dark:text-[#6B7080] mb-1">{m.label}</p>
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, i) => (
            <div key={i} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-2">{m.label}</p>
              <p className={`text-2xl font-bold ${m.abnormal ? 'abnormal-blink' : m.color}`}>
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('dashboard.aiAgentStatus')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a, i) => (
            <AgentStatusCard key={i} {...a} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('dashboard.todoTasks')}</h2>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-[#2A2D35]">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{task.title}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${task.statusColor}`}>{task.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('dashboard.quickActions')}</h2>
        <div className="flex gap-3">
          {quickActions.map((a, i) => (
            <button key={i} onClick={() => router.push(a.route)} className={`${a.color} text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <RiskAlertPopup alerts={riskAlerts} onClose={handleCloseAlert} onJump={handleJumpAlert} />
    </div>
  )
}
