'use client'

import { useEffect, useState, useCallback, useContext } from 'react'
import Link from 'next/link'
import { OfflineContext } from '@/lib/offline-context'
import { saveData, getData, type CacheEntry } from '@/lib/offline/cache-manager'

interface DashboardData {
  revenue: { amount: string; change: string; orders: string; conversion: string }
  metrics: {
    visitors: { value: string; change: string }
    addToCart: { value: string; change: string }
    refundRate: { value: string; change: string }
    inventoryTurn: { value: string; change: string }
  }
  tasks: Array<{ title: string; urgency: string; time: string }>
}

const CACHE_KEY = 'homepage'

const defaultDashboardData: DashboardData = {
  revenue: { amount: '¥12,680', change: '+18.5%', orders: '订单 86单', conversion: '转化率 3.2%' },
  metrics: {
    visitors: { value: '2,684', change: '+12.3%' },
    addToCart: { value: '8.7%', change: '+2.1%' },
    refundRate: { value: '1.2%', change: '-0.3%' },
    inventoryTurn: { value: '15天', change: '+3天' },
  },
  tasks: [
    { title: 'Shopee店铺3个商品待上架', urgency: 'high', time: '10分钟前' },
    { title: 'Amazon订单#A2301待发货', urgency: 'medium', time: '30分钟前' },
    { title: 'TikTok广告预算即将耗尽', urgency: 'high', time: '1小时前' },
    { title: '欧洲站VAT申报截止提醒', urgency: 'low', time: '2小时前' },
  ],
}

const quickActions = [
  { name: '选品', icon: '🔍', href: '/mobile/selection' },
  { name: '建站', icon: '🌐', href: '#' },
  { name: '文案', icon: '✍️', href: '/mobile/content' },
  { name: '投流', icon: '📈', href: '/mobile/ad-optimizer' },
  { name: '客服', icon: '💬', href: '#' },
  { name: '发货', icon: '📦', href: '/mobile/orders' },
]

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

export default function MobileHomePage() {
  const { isOnline, wasOffline, acknowledgeReconnect } = useContext(OfflineContext)
  const [dashboardData, setDashboardData] = useState<DashboardData>(defaultDashboardData)
  const [cachedTimestamp, setCachedTimestamp] = useState<number | null>(null)

  const cacheDashboardData = useCallback(async (data: DashboardData) => {
    await saveData('dashboard-data', CACHE_KEY, data)
  }, [])

  useEffect(() => {
    if (isOnline) {
      setDashboardData(defaultDashboardData)
      setCachedTimestamp(null)
      cacheDashboardData(defaultDashboardData)
    } else {
      async function loadCached() {
        const cached: CacheEntry | null = await getData('dashboard-data', CACHE_KEY)
        if (cached) {
          setDashboardData(cached.data as DashboardData)
          setCachedTimestamp(cached.timestamp)
        }
      }
      loadCached()
    }

    if (wasOffline && isOnline) {
      acknowledgeReconnect()
    }
  }, [isOnline, wasOffline, acknowledgeReconnect, cacheDashboardData])

  const data = dashboardData

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">2024年1月15日 星期一</p>
          <h1 className="text-lg font-semibold text-gray-600 dark:text-[#A0A4AC] mt-1">
            👋 你好，张经理
          </h1>
        </div>
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">张</span>
        </div>
      </div>

      {!isOnline && cachedTimestamp && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 mb-4">
          <p className="text-xs text-warning">
            ⚠️ 当前为离线模式，显示缓存数据 (更新于 {formatTimestamp(cachedTimestamp)})
          </p>
        </div>
      )}

      <div className="bg-gradient-to-r from-primary to-purple rounded-2xl p-5 mb-4 text-white">
        <p className="text-xs opacity-80 mb-1">今日营收</p>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold">{data.revenue.amount}</span>
            <span className="text-xs ml-2 opacity-80">{data.revenue.change}</span>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">{data.revenue.orders}</p>
            <p className="text-xs opacity-80">{data.revenue.conversion}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">访客数</p>
          <p className="text-lg font-semibold text-gray-600 dark:text-[#A0A4AC] mt-1">{data.metrics.visitors.value}</p>
          <p className="text-xs text-success mt-1">{data.metrics.visitors.change}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">加购率</p>
          <p className="text-lg font-semibold text-gray-600 dark:text-[#A0A4AC] mt-1">{data.metrics.addToCart.value}</p>
          <p className="text-xs text-success mt-1">{data.metrics.addToCart.change}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">退款率</p>
          <p className="text-lg font-semibold text-gray-600 dark:text-[#A0A4AC] mt-1">{data.metrics.refundRate.value}</p>
          <p className="text-xs text-success mt-1">{data.metrics.refundRate.change}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400">库存周转</p>
          <p className="text-lg font-semibold text-gray-600 mt-1">{data.metrics.inventoryTurn.value}</p>
          <p className="text-xs text-danger mt-1">{data.metrics.inventoryTurn.change}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600">待处理任务</h2>
          <span className="text-xs text-primary">查看全部</span>
        </div>
        <div className="space-y-3">
          {data.tasks.map((task, index) => (
            <div key={index} className="flex items-start gap-3">
              <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  task.urgency === 'high'
                    ? 'bg-danger'
                    : task.urgency === 'medium'
                    ? 'bg-warning'
                    : 'bg-gray-300'
                }`}
              ></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 truncate">{task.title}</p>
                <p className="text-xs text-gray-300 mt-0.5">{task.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">快捷操作</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className={`flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl transition-colors ${
                isOnline ? 'active:bg-gray-100' : 'opacity-50 pointer-events-none'
              }`}
            >
              <span className="text-2xl mb-2">{action.icon}</span>
              <span className="text-xs text-gray-500 font-medium">{action.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
