'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress'

interface OrderItem {
  id: string
  product: string
  quantity: number
  price: number
}

interface OrderTrackingEvent {
  date: string
  status: string
  location: string
  description: string
}

interface OrderDetail {
  id: string
  customer: string
  email: string
  product: string
  status: string
  statusColor: string
  total: number
  items: OrderItem[]
  shippingAddress: string
  trackingNumber: string
  trackingEvents: OrderTrackingEvent[]
  createdAt: string
  updatedAt: string
}

const DEFAULT_STEPS: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
]

const MOCK_ORDERS: Record<string, OrderDetail> = {
  'default': {
    id: 'ORD-20250523-001',
    customer: 'John Smith',
    email: 'john.smith@email.com',
    product: '无线蓝牙耳机',
    status: '已发货',
    statusColor: 'bg-primary/10 text-primary',
    total: 299.00,
    items: [
      { id: 'item-1', product: '无线蓝牙耳机 Pro', quantity: 1, price: 199 },
      { id: 'item-2', product: '充电线套装', quantity: 2, price: 50 },
    ],
    shippingAddress: '123 Main Street, Apt 4B, New York, NY 10001, USA',
    trackingNumber: 'SF1234567890CN',
    trackingEvents: [
      { date: '2025-05-20 08:30', status: '已签收', location: 'New York, USA', description: '包裹已由收件人签收' },
      { date: '2025-05-19 14:20', status: '派送中', location: 'New York, USA', description: '快递员正在派送' },
      { date: '2025-05-18 09:15', status: '到达目的国', location: 'New York, USA', description: '包裹已到达目的地处理中心' },
      { date: '2025-05-15 16:45', status: '国际运输', location: 'Shanghai, China', description: '包裹已离开中国，前往美国' },
      { date: '2025-05-14 10:00', status: '已揽收', location: 'Shenzhen, China', description: '快递公司已揽收' },
      { date: '2025-05-13 09:30', status: '待发货', location: 'Shenzhen, China', description: '订单已创建，等待发货' },
    ],
    createdAt: '2025-05-13 09:30',
    updatedAt: '2025-05-20 08:30',
  },
}

export default function OrdersPage() {
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<StepInfo[]>(DEFAULT_STEPS)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchOrder = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/data?type=orders&limit=1')
      const data = await res.json()
      if (data.success && data.data && data.data.length > 0) {
        const raw = data.data[0]
        const statusMap: Record<string, { text: string; color: string }> = {
          shipped: { text: '已发货', color: 'bg-primary/10 text-primary' },
          pending: { text: '待发货', color: 'bg-warning/10 text-warning' },
          delivered: { text: '已签收', color: 'bg-success/10 text-success' },
          cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-500' },
        }
        const status = statusMap[raw.status] || statusMap.pending
        setOrder({
          ...MOCK_ORDERS['default'],
          id: raw.id || raw.orderId || MOCK_ORDERS['default'].id,
          product: raw.product || raw.productName || MOCK_ORDERS['default'].product,
          status: status.text,
          statusColor: status.color,
          total: raw.total || raw.amount || MOCK_ORDERS['default'].total,
        })
      } else {
        setOrder(MOCK_ORDERS['default'])
      }
    } catch {
      setOrder(MOCK_ORDERS['default'])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleSyncTracking = async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'fulfillment',
          input: { action: 'sync-tracking', orderId: order?.id },
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.taskId) {
        setCurrentTaskId(data.data.taskId)
        setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
      }
    } catch {}
  }

  const handlePause = async () => {
    if (!currentTaskId) return
    try {
      await fetch(`/api/agent/pause?taskId=${currentTaskId}`, { method: 'POST' })
      setStepProgress(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'pending' as const } : s))
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    } catch {}
  }

  const handleTerminate = async () => {
    if (!currentTaskId) return
    try {
      await fetch(`/api/agent/terminate?taskId=${currentTaskId}`, { method: 'POST' })
    } catch {}
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setCurrentTaskId(null)
  }

  const handleRetry = async () => {
    if (!currentTaskId) return
    try {
      await fetch(`/api/agent/retry?taskId=${currentTaskId}`, { method: 'POST' })
      setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/agent/progress?taskId=${currentTaskId}&agentType=fulfillment`)
          const data = await res.json()
          if (data.success && data.data?.steps) {
            setStepProgress(data.data.steps)
            const hasRunning = data.data.steps.some((s: StepInfo) => s.status === 'running')
            if (!hasRunning && pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        } catch {}
      }, 2000)
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-[#22252D] rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#4E5969] dark:text-[#A0A4AC]">
        <span className="text-4xl mb-4">📦</span>
        <p className="text-base">未找到订单详情</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm hover:underline">返回</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-[#1D2129] dark:hover:text-[#E8EAED] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">订单详情</h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">{order.id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncTracking}
            className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            同步物流
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">订单状态</p>
          <p className={`text-lg font-semibold mt-1 ${order.statusColor}`}>{order.status}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">订单金额</p>
          <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{order.total.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">运单号</p>
          <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1 font-mono text-sm">{order.trackingNumber}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">创建时间</p>
          <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1 text-sm">{order.createdAt}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📋 商品信息</h3>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{item.product}</p>
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">数量: {item.quantity}</p>
                </div>
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">¥{item.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">👤 客户信息</h3>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
              <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">收件人</p>
              <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">{order.customer}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
              <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">邮箱</p>
              <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1 font-mono text-xs">{order.email}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
              <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">收货地址</p>
              <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">{order.shippingAddress}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🚚 物流追踪</h3>
        <div className="relative">
          {order.trackingEvents.map((event, i) => (
            <div key={i} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-gray-300 dark:bg-[#2A2D35]'}`} />
                {i < order.trackingEvents.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-[#2A2D35] mt-1" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${i === 0 ? 'text-primary' : 'text-[#4E5969] dark:text-[#A0A4AC]'}`}>
                    {event.status}
                  </span>
                  <span className="text-xs text-[#86909C]">{event.location}</span>
                </div>
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{event.description}</p>
                <p className="text-xs text-[#86909C] mt-1">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {currentTaskId && (
        <AIStepProgress
          taskId={currentTaskId}
          steps={stepProgress}
          onPause={handlePause}
          onTerminate={handleTerminate}
          onRetry={handleRetry}
        />
      )}
    </div>
  )
}
