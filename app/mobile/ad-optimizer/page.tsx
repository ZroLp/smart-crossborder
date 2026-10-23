'use client'

import { useState } from 'react'
import Link from 'next/link'

const campaigns = [
  {
    name: '北美-夏季推广',
    platform: 'Shopee',
    budget: '¥10,000',
    spent: '¥8,200',
    roas: '3.8',
    status: 'running',
    progress: 82,
  },
  {
    name: '欧洲-品牌曝光',
    platform: 'Amazon',
    budget: '¥8,000',
    spent: '¥6,500',
    roas: '2.9',
    status: 'running',
    progress: 81,
  },
  {
    name: '东南亚-新品测试',
    platform: 'TikTok',
    budget: '¥5,000',
    spent: '¥3,750',
    roas: '1.5',
    status: 'paused',
    progress: 75,
  },
  {
    name: '日本-精准投放',
    platform: 'Shopee',
    budget: '¥6,000',
    spent: '¥2,100',
    roas: '4.2',
    status: 'running',
    progress: 35,
  },
]

const alerts = [
  { title: '北美推广计划预算即将耗尽', level: 'high', time: '30分钟前' },
  { title: '东南亚测试ROAS低于预期', level: 'medium', time: '2小时前' },
]

export default function MobileAdOptimizerPage() {
  const [campaignStatus, setCampaignStatus] = useState<Record<number, string>>(
    Object.fromEntries(campaigns.map((c, i) => [i, c.status]))
  )
  const [, setForceRefresh] = useState(0)

  const toggleCampaign = (index: number) => {
    setCampaignStatus((prev) => ({
      ...prev,
      [index]: prev[index] === 'running' ? 'paused' : 'running',
    }))
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="text-gray-400 dark:text-[#6B7080]">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-600">投流监控</h1>
        </div>
        <button
          className="text-primary text-sm"
          onClick={() => setForceRefresh(Date.now())}
        >
          🔄 刷新
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">今日花费</p>
          <p className="text-lg font-semibold text-gray-600 mt-1">¥2,180</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">曝光量</p>
          <p className="text-lg font-semibold text-gray-600 mt-1">45.2万</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">点击量</p>
          <p className="text-lg font-semibold text-gray-600 mt-1">8,640</p>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">投放计划</h2>
        <div className="space-y-3">
          {campaigns.map((campaign, index) => (
            <div key={index} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-600">{campaign.name}</p>
                  <p className="text-xs text-gray-300">{campaign.platform}</p>
                </div>
                <button
                  onClick={() => toggleCampaign(index)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    campaignStatus[index] === 'running' ? 'bg-success' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white dark:bg-[#181A20] rounded-full shadow-sm transform transition-transform ${
                      campaignStatus[index] === 'running'
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  ></div>
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-[#6B7080] mb-2">
                <span>
                  {campaign.spent} / {campaign.budget}
                </span>
                <span className="text-primary font-medium">ROAS {campaign.roas}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-[#22252D] rounded-full h-1.5">
                <div
                  className={`rounded-full h-1.5 ${
                    campaignStatus[index] === 'running' ? 'bg-primary' : 'bg-gray-300'
                  }`}
                  style={{ width: `${campaign.progress}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">异常预警</h2>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
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
                  {alert.level === 'high' ? '紧急' : '注意'}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">{alert.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
