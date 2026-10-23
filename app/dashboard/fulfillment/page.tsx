'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress'

interface Order {
  id: string
  product: string
  status: string
  statusColor: string
}

interface StockAlert {
  id: string
  product: string
  stock: number
  level: string
}

interface TrackingUpdate {
  id: string
  orderId: string
  status: string
  timestamp: string
}

const DEFAULT_STEPS: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
]

export default function FulfillmentPage() {
  const router = useRouter()
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [stepProgress, setStepProgress] = useState<StepInfo[]>(DEFAULT_STEPS)
  const [orders, setOrders] = useState<Order[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [trackingUpdates, setTrackingUpdates] = useState<TrackingUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchFulfillmentData = useCallback(async () => {
    try {
      setIsLoading(true)
      const ordersRes = await fetch('/api/data?type=orders&limit=50')
      const ordersData = await ordersRes.json()

      const productsRes = await fetch('/api/data?type=products&limit=50')
      const productsData = await productsRes.json()

      if (ordersData.success && ordersData.data) {
        const orderItems = ordersData.data.slice(0, 20).map((o: any, i: number) => {
          const statusMap: Record<string, { text: string; color: string }> = {
            shipped: { text: '已发货', color: 'bg-primary/10 text-primary' },
            pending: { text: '待发货', color: 'bg-warning/10 text-warning' },
            delivered: { text: '已签收', color: 'bg-success/10 text-success' },
            cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-500' },
          }
          const status = statusMap[o.status] || statusMap.pending
          return {
            id: o.id || o.orderId || `ORD-${Date.now()}-${i}`,
            product: o.product || o.productName || o.title || `商品${i + 1}`,
            status: status.text,
            statusColor: status.color,
          }
        })
        setOrders(orderItems)

        setTrackingUpdates(ordersData.data
          .filter((o: any) => o.status === 'shipped' || o.status === 'delivered')
          .slice(0, 5)
          .map((o: any, i: number) => ({
            id: `tracking-${i}`,
            orderId: o.id || o.orderId || `ORD-${i}`,
            status: o.status === 'shipped' ? '已到达目的国' : '已签收',
            timestamp: o.updatedAt || o.trackingTime || new Date().toISOString(),
          }))
        )
      } else {
        setOrders([])
        setTrackingUpdates([])
      }

      if (productsData.success && productsData.data) {
        const lowStock = productsData.data
          .filter((p: any) => (p.stock || p.inventory || 0) < 20)
          .slice(0, 10)
          .map((p: any, i: number) => ({
            id: p.id || `alert-${i}`,
            product: p.name || p.title || p.productName || `商品${i + 1}`,
            stock: p.stock || p.inventory || 0,
            level: (p.stock || p.inventory || 0) < 10 ? '极低' : '低',
          }))
        setStockAlerts(lowStock)
      } else {
        setStockAlerts([])
      }
    } catch {
      setOrders([])
      setStockAlerts([])
      setTrackingUpdates([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFulfillmentData()
  }, [fetchFulfillmentData])

  const fetchProgress = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/agent/progress?taskId=${taskId}&agentType=fulfillment`)
      const data = await res.json()
      if (data.success && data.data?.steps) {
        setStepProgress(data.data.steps)
        const hasRunning = data.data.steps.some((s: StepInfo) => s.status === 'running')
        if (!hasRunning && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          fetchFulfillmentData()
        }
      }
    } catch {}
  }, [fetchFulfillmentData])

  const startPolling = useCallback((taskId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    fetchProgress(taskId)
    pollingRef.current = setInterval(() => fetchProgress(taskId), 2000)
  }, [fetchProgress])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'fulfillment',
          input: { action: 'sync' },
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.taskId) {
        setCurrentTaskId(data.data.taskId)
        setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
        startPolling(data.data.taskId)
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
    setStepProgress(DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' })))
    try {
      await fetch(`/api/agent/retry?taskId=${currentTaskId}`, { method: 'POST' })
      startPolling(currentTaskId)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">智能履约</h2>
        <button
          onClick={handleSubmit}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          同步订单
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden animate-pulse">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35]">
            <div className="h-4 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-[#22252D] rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35]">
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">订单列表</h3>
          </div>
          {orders.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-[#6B7080] text-sm">暂无订单，点击"同步订单"获取数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                  <th className="px-6 py-3 font-medium">订单号</th>
                  <th className="px-6 py-3 font-medium">商品</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED] font-mono text-xs">{o.id}</td>
                    <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{o.product}</td>
                    <td className="px-6 py-4"><span className={`text-xs px-2 py-0.5 rounded-full ${o.statusColor}`}>{o.status}</span></td>
                    <td className="px-6 py-4"><button onClick={() => router.push(`/dashboard/orders`)} className="text-primary text-xs hover:underline">详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">物流追踪</h3>
          {trackingUpdates.length === 0 ? (
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] text-center py-4">暂无物流更新</p>
          ) : (
            <div className="space-y-3">
              {trackingUpdates.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <div className="flex-1">
                    <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{t.orderId} {t.status}</p>
                    <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{new Date(t.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">库存预警</h3>
          {stockAlerts.length === 0 ? (
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] text-center py-4">库存充足，暂无预警</p>
          ) : (
            <div className="space-y-3">
              {stockAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-danger/5 rounded-lg">
                  <div>
                    <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{a.product}</p>
                    <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">剩余库存: {a.stock}</p>
                  </div>
                  <span className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full">{a.level}</span>
                </div>
              ))}
            </div>
          )}
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
