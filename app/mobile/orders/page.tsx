'use client'

import { useState } from 'react'
import Link from 'next/link'

const orders = [
  {
    id: 'ORD-2024001',
    buyer: 'John D.',
    product: '无线蓝牙耳机',
    amount: '$29.99',
    status: 'pending',
    statusText: '待发货',
    tracking: [
      { time: '01-15 14:30', event: '订单创建', done: true },
      { time: '', event: '', done: false },
      { time: '', event: '', done: false },
    ],
  },
  {
    id: 'ORD-2024002',
    buyer: 'Maria S.',
    product: '智能手表',
    amount: '$89.99',
    status: 'shipped',
    statusText: '已发货',
    tracking: [
      { time: '01-14 10:20', event: '订单创建', done: true },
      { time: '01-14 16:45', event: '已发货', done: true },
      { time: '01-15 09:30', event: '运输中', done: true },
    ],
  },
  {
    id: 'ORD-2024003',
    buyer: 'Takeshi K.',
    product: '便携充电宝',
    amount: '¥6,500',
    status: 'delivered',
    statusText: '已签收',
    tracking: [
      { time: '01-12 08:15', event: '订单创建', done: true },
      { time: '01-12 14:20', event: '已发货', done: true },
      { time: '01-14 11:00', event: '已签收', done: true },
    ],
  },
  {
    id: 'ORD-2024004',
    buyer: 'Anna M.',
    product: '折叠收纳袋',
    amount: '€12.50',
    status: 'shipped',
    statusText: '已发货',
    tracking: [
      { time: '01-13 11:30', event: '订单创建', done: true },
      { time: '01-14 09:15', event: '已发货', done: true },
      { time: '', event: '运输中', done: false },
    ],
  },
  {
    id: 'ORD-2024005',
    buyer: 'Lee J.',
    product: '磁吸充电宝',
    amount: '₩89,000',
    status: 'pending',
    statusText: '待发货',
    tracking: [
      { time: '01-15 08:45', event: '订单创建', done: true },
      { time: '', event: '', done: false },
      { time: '', event: '', done: false },
    ],
  },
]

export default function MobileOrdersPage() {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const shippedCount = orders.filter((o) => o.status === 'shipped').length
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/mobile" className="text-gray-400 dark:text-[#6B7080]">
          ← 返回
        </Link>
        <h1 className="text-lg font-semibold text-gray-600">订单履约</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">待发货</p>
          <p className="text-lg font-semibold text-warning mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">运输中</p>
          <p className="text-lg font-semibold text-primary mt-1">{shippedCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">已签收</p>
          <p className="text-lg font-semibold text-success mt-1">{deliveredCount}</p>
        </div>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm">
            <div
              className="p-4"
              onClick={() =>
                setExpandedOrder(expandedOrder === order.id ? null : order.id)
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-300 font-mono">{order.id}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    order.status === 'pending'
                      ? 'bg-warning/10 text-warning'
                      : order.status === 'shipped'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-success/10 text-success'
                  }`}
                >
                  {order.statusText}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{order.product}</p>
                  <p className="text-xs text-gray-400 dark:text-[#6B7080] mt-0.5">买家: {order.buyer}</p>
                </div>
                <span className="text-sm font-medium text-gray-600">{order.amount}</span>
              </div>
              <div className="flex items-center justify-center mt-2">
                <span className="text-xs text-gray-300">
                  {expandedOrder === order.id ? '收起 ▲' : '展开 ▼'}
                </span>
              </div>
            </div>

            {expandedOrder === order.id && (
              <div className="px-4 pb-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 dark:text-[#6B7080] mt-3 mb-2">物流跟踪</p>
                <div className="space-y-2">
                  {order.tracking.map(
                    (track, index) =>
                      track.event && (
                        <div key={index} className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              track.done ? 'bg-primary' : 'bg-gray-200'
                            }`}
                          ></div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600">{track.event}</p>
                            <p className="text-[10px] text-gray-300">{track.time}</p>
                          </div>
                        </div>
                      )
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
