'use client'

import { useState, useEffect } from 'react'
import SkeletonLoader from '@/components/SkeletonLoader'

interface Shop {
  id: number
  user_id: number
  shop_name: string
  domain: string
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: '正常',
  inactive: '未激活',
  pending: '待审核',
  suspended: '已暂停',
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchShops() {
      try {
        const res = await fetch('/api/admin/shops')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setShops(data.shops)
          }
        }
      } catch {
        console.error('Failed to fetch shops')
      } finally {
        setIsLoading(false)
      }
    }

    fetchShops()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">店铺管理</h1>
        <span className="text-sm text-[#86909C] dark:text-[#6B7080]">共 {shops.length} 家店铺</span>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonLoader variant="text" width="150px" height="16px" />
              <SkeletonLoader variant="text" width="200px" height="16px" />
              <SkeletonLoader variant="text" width="80px" height="16px" />
              <SkeletonLoader variant="text" width="100px" height="16px" />
            </div>
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">🏪</div>
          <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">暂无店铺数据</h3>
          <p className="text-sm text-[#86909C] dark:text-[#6B7080]">系统暂未接入任何店铺</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">店铺名称</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">域名</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">状态</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:hover:bg-[#22252D]/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">{shop.shop_name}</td>
                  <td className="px-6 py-4 text-sm text-[#4E5969] dark:text-[#A0A4AC]">{shop.domain || '--'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[shop.status] || STATUS_STYLES.inactive}`}>
                      {STATUS_LABELS[shop.status] || shop.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#86909C] dark:text-[#6B7080]">
                    {shop.created_at ? new Date(shop.created_at).toLocaleDateString('zh-CN') : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
