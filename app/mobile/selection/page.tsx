'use client'

import { useState } from 'react'
import Link from 'next/link'

const hotProducts = [
  {
    name: '便携式挂脖风扇',
    price: '¥29.9',
    trend: '+156%',
    category: '户外生活',
    sales: '2.3万件/月',
  },
  {
    name: '磁吸无线充电宝',
    price: '¥89.9',
    trend: '+89%',
    category: '数码配件',
    sales: '1.8万件/月',
  },
  {
    name: '折叠式旅行收纳袋',
    price: '¥15.9',
    trend: '+67%',
    category: '旅行用品',
    sales: '3.1万件/月',
  },
  {
    name: '智能体脂秤',
    price: '¥49.9',
    trend: '+45%',
    category: '健康生活',
    sales: '1.2万件/月',
  },
]

const riskAlerts = [
  { title: '硅胶厨具类目侵权风险上升', level: 'high', time: '2小时前' },
  { title: '蓝牙耳机类目竞争加剧', level: 'medium', time: '4小时前' },
  { title: '欧盟新规影响塑料制品', level: 'high', time: '6小时前' },
]

const competitorBriefs = [
  { title: '竞品A降价15%促销', platform: 'Shopee', time: '1小时前' },
  { title: '竞品B新品上架3C配件', platform: 'Amazon', time: '3小时前' },
  { title: '竞品C加大广告投放', platform: 'TikTok', time: '5小时前' },
]

export default function MobileSelectionPage() {
  const [, setForceRefresh] = useState(0)

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="text-gray-400 dark:text-[#6B7080]">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-600">选品快报</h1>
        </div>
        <button
          className="text-primary text-sm"
          onClick={() => setForceRefresh(Date.now())}
        >
          🔄 刷新
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">今日爆款</h2>
        <div className="space-y-3">
          {hotProducts.map((product, index) => (
            <div key={index} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-gray-100 dark:bg-[#22252D] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{product.name}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{product.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{product.price}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400 dark:text-[#6B7080]">{product.sales}</span>
                    <span className="text-xs text-success font-medium">{product.trend}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">风险预警</h2>
        <div className="space-y-2">
          {riskAlerts.map((alert, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 border-l-4 ${
                alert.level === 'high' ? 'border-danger' : 'border-warning'
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-600 flex-1">{alert.title}</p>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ml-2 ${
                    alert.level === 'high'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {alert.level === 'high' ? '高风险' : '中风险'}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">{alert.time}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">竞品动态</h2>
        <div className="space-y-2">
          {competitorBriefs.map((brief, index) => (
            <div key={index} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-600 flex-1">{brief.title}</p>
                <span className="text-[10px] bg-gray-100 dark:bg-[#22252D] text-gray-400 dark:text-[#6B7080] px-2 py-0.5 rounded-full ml-2">
                  {brief.platform}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">{brief.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
