'use client'

import { useState } from 'react'

const tabs = ['全部', '系统通知', '任务消息', '预警消息']

const messages = [
  {
    id: 1,
    title: '系统升级通知',
    preview: '跨境智卖系统将于今晚22:00进行升级维护，预计持续30分钟...',
    time: '10分钟前',
    read: false,
    type: 'system',
  },
  {
    id: 2,
    title: '选品任务完成',
    preview: 'AI选品助手已完成北美市场夏季热销品分析，共推荐12款商品...',
    time: '30分钟前',
    read: false,
    type: 'task',
  },
  {
    id: 3,
    title: '库存预警',
    preview: '无线蓝牙耳机库存不足，当前剩余12件，建议及时补货...',
    time: '1小时前',
    read: false,
    type: 'alert',
  },
  {
    id: 4,
    title: '订单发货提醒',
    preview: '您有3个订单待发货，请及时处理以避免延迟...',
    time: '2小时前',
    read: true,
    type: 'task',
  },
  {
    id: 5,
    title: '广告预算预警',
    preview: '北美推广计划预算已使用82%，剩余预算预计可维持2天...',
    time: '3小时前',
    read: true,
    type: 'alert',
  },
  {
    id: 6,
    title: '新功能上线',
    preview: 'AI客服助手已上线，可自动回复买家咨询，提升响应效率...',
    time: '5小时前',
    read: true,
    type: 'system',
  },
  {
    id: 7,
    title: '文案生成完成',
    preview: '无线蓝牙耳机英文版文案已生成，包含标题、描述和营销话术...',
    time: '6小时前',
    read: true,
    type: 'task',
  },
  {
    id: 8,
    title: '店铺授权到期',
    preview: 'Shopee店铺授权将于7天后到期，请及时续期...',
    time: '8小时前',
    read: true,
    type: 'alert',
  },
  {
    id: 9,
    title: '日报生成',
    preview: '您的1月15日经营日报已生成，今日营收¥12,680...',
    time: '昨天',
    read: true,
    type: 'system',
  },
  {
    id: 10,
    title: '物流异常',
    preview: '订单ORD-2024003物流状态更新延迟，请关注...',
    time: '昨天',
    read: true,
    type: 'alert',
  },
]

export default function MobileMessagesPage() {
  const [activeTab, setActiveTab] = useState(0)

  const filteredMessages =
    activeTab === 0
      ? messages
      : messages.filter((m) => {
          if (activeTab === 1) return m.type === 'system'
          if (activeTab === 2) return m.type === 'task'
          if (activeTab === 3) return m.type === 'alert'
          return true
        })

  return (
    <div className="px-4 pt-6">
      <h1 className="text-lg font-semibold text-gray-600 mb-4">消息中心</h1>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              activeTab === index
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-[#181A20] text-gray-400 dark:text-[#6B7080] shadow-sm'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredMessages.map((message) => (
          <div
            key={message.id}
            className={`bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 ${
              !message.read ? 'border-l-2 border-primary' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {!message.read && (
                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                )}
                <p className="text-sm font-medium text-gray-600">{message.title}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  message.type === 'system'
                    ? 'bg-gray-100 dark:bg-[#22252D] text-gray-400 dark:text-[#6B7080]'
                    : message.type === 'task'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-danger/10 text-danger'
                }`}
              >
                {message.type === 'system'
                  ? '系统'
                  : message.type === 'task'
                  ? '任务'
                  : '预警'}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-[#6B7080] line-clamp-2">{message.preview}</p>
            <p className="text-[10px] text-gray-300 mt-2">{message.time}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
