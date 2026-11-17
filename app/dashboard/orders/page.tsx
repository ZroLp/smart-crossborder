'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'

interface OrderSummary {
  id: number
  orderNumber: string | null
  customerName: string | null
  totalAmount: number | null
  status: string
  shippingRegion: string | null
  logisticsChannel: string | null
  createdAt: string
}

interface OrderItemRecord {
  id?: string | number
  name?: string
  product?: string
  quantity?: number
  price?: number
  [key: string]: unknown
}

interface TrackingRecord {
  status?: string
  location?: string
  description?: string
  date?: string
  createdAt?: string
  [key: string]: unknown
}

interface OrderDetail extends OrderSummary {
  shopName?: string
  shopDomain?: string
  shippingWeight?: number | null
  items: OrderItemRecord[]
  tracking: TrackingRecord[]
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  shipped: { text: '已发货', color: 'bg-primary/10 text-primary' },
  pending: { text: '待发货', color: 'bg-warning/10 text-warning' },
  delivered: { text: '已签收', color: 'bg-success/10 text-success' },
  cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-500' },
}

function asText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return '—'
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function orderStatus(status: string) {
  return STATUS_META[status] || { text: asText(status), color: 'bg-gray-100 text-gray-500' }
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/data?type=orders&limit=50', { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setError(body.error || '订单加载失败，请稍后重试')
        setOrders([])
        return
      }
      const list: OrderSummary[] = Array.isArray(body.data) ? body.data : []
      setOrders(list)
      setSelectedId((prev) => {
        if (prev !== null && list.some((order) => order.id === prev)) return prev
        return list.length > 0 ? list[0].id : null
      })
    } catch {
      setError('网络错误，订单加载失败')
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders, reloadToken])

  const loadDetail = useCallback(async (orderId: number) => {
    setIsDetailLoading(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setDetailError(body.error || '订单详情加载失败')
        setDetail(null)
        return
      }
      const order = body.data?.order
      if (!order) {
        setDetailError('订单详情加载失败')
        setDetail(null)
        return
      }
      setDetail({
        ...order,
        items: Array.isArray(body.data.items) ? body.data.items : [],
        tracking: Array.isArray(body.data.tracking) ? body.data.tracking : [],
      })
    } catch {
      setDetailError('网络错误，订单详情加载失败')
      setDetail(null)
    } finally {
      setIsDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null)
      return
    }
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const {
    submit,
    pause,
    terminate,
    retry,
    displayId,
    taskId,
    taskStatus,
    steps,
    error: taskError,
    submitting,
    controlling,
    isActive,
    clearError,
  } = useAgentTask({ agentType: 'fulfillment' })

  const handleSyncTracking = async () => {
    if (!detail) return
    await submit({
      order: {
        id: detail.id,
        orderNumber: detail.orderNumber,
        customerName: detail.customerName,
        totalAmount: detail.totalAmount,
        status: detail.status,
        shippingRegion: detail.shippingRegion,
        logisticsChannel: detail.logisticsChannel,
      },
    })
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

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">订单详情</h2>
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
          >
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={() => setReloadToken((prev) => prev + 1)}
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              重新加载
            </button>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-16 text-[#4E5969] dark:text-[#A0A4AC] bg-white dark:bg-[#181A20] rounded-xl shadow-sm">
          <span className="text-4xl mb-4">📦</span>
          <p className="text-base">暂无订单</p>
          <button
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="mt-4 text-primary text-sm hover:underline"
          >
            刷新
          </button>
        </div>
      </div>
    )
  }

  const status = detail ? orderStatus(detail.status) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-[#1D2129] dark:hover:text-[#E8EAED] transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">订单详情</h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">
              {detail?.orderNumber || (detail ? `#${detail.id}` : '—')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
          >
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber || `#${order.id}`}
              </option>
            ))}
          </select>
          <button
            onClick={handleSyncTracking}
            disabled={submitting || !detail}
            className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '同步中...' : '同步物流'}
          </button>
        </div>
      </div>

      {detailError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{detailError}</p>
          <button
            onClick={() => selectedId !== null && loadDetail(selectedId)}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            重新加载
          </button>
        </div>
      )}

      {taskError && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{taskError}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </div>
      )}

      {isDetailLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-8 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">
          加载中...
        </div>
      ) : !detail ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-8 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">
          暂无该订单详情
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">订单状态</p>
              <p className={`text-lg font-semibold mt-1 ${status?.color || ''}`}>
                {status?.text || '—'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">订单金额</p>
              <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">
                {detail.totalAmount === null || detail.totalAmount === undefined
                  ? '—'
                  : `¥${asNumber(detail.totalAmount).toFixed(2)}`}
              </p>
            </div>
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">物流渠道</p>
              <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1 text-sm">
                {asText(detail.logisticsChannel)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">创建时间</p>
              <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1 text-sm">
                {asText(detail.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📋 商品信息</h3>
              {detail.items.length === 0 ? (
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">
                  暂无商品明细
                </p>
              ) : (
                <div className="space-y-3">
                  {detail.items.map((item, index) => (
                    <div
                      key={String(item.id ?? index)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                          {asText(item.name ?? item.product)}
                        </p>
                        <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">
                          数量: {item.quantity ?? '—'}
                        </p>
                      </div>
                      <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">
                        {item.price === undefined || item.price === null
                          ? '—'
                          : `¥${asNumber(item.price).toFixed(2)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">👤 客户信息</h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">收件人</p>
                  <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">
                    {asText(detail.customerName)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">收货地区</p>
                  <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">
                    {asText(detail.shippingRegion)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">店铺</p>
                  <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">
                    {asText(detail.shopName)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">重量</p>
                  <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1">
                    {detail.shippingWeight === null || detail.shippingWeight === undefined
                      ? '—'
                      : `${detail.shippingWeight}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🚚 物流追踪</h3>
            {detail.tracking.length === 0 ? (
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">
                暂无物流轨迹
              </p>
            ) : (
              <div className="relative">
                {detail.tracking.map((event, i) => (
                  <div key={i} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-gray-300 dark:bg-[#2A2D35]'
                        }`}
                      />
                      {i < detail.tracking.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 dark:bg-[#2A2D35] mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-medium ${
                            i === 0 ? 'text-primary' : 'text-[#4E5969] dark:text-[#A0A4AC]'
                          }`}
                        >
                          {asText(event.status)}
                        </span>
                        <span className="text-xs text-[#86909C]">{asText(event.location)}</span>
                      </div>
                      <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">
                        {asText(event.description)}
                      </p>
                      <p className="text-xs text-[#86909C] mt-1">
                        {asText(event.date ?? event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isActive && (displayId || taskId) && (
        <AIStepProgress
          taskId={(displayId || taskId) as string}
          steps={steps}
          taskStatus={taskStatus}
          errorMessage={taskError}
          busy={controlling}
          onPause={pause}
          onTerminate={terminate}
          onRetry={retry}
          onDismissError={clearError}
        />
      )}
    </div>
  )
}
