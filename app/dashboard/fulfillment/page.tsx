'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'
import { useTranslation } from '@/lib/i18n/use-translation'

interface Order {
  id: string
  product: string
  status: string
  statusColor: string
  /** P5-07: real tracking events returned by /api/data?type=orders */
  tracking?: Array<{
    status: string
    location: string | null
    description: string | null
    carrier: string | null
    tracking_number: string | null
    occurred_at: string
  }>
  logisticsChannel?: string
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
  /** P5-07: carrier + tracking number */
  carrier: string | null
  tracking_number: string | null
}

export default function FulfillmentPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [trackingUpdates, setTrackingUpdates] = useState<TrackingUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
            shipped: { text: t('status.shipped'), color: 'bg-primary/10 text-primary' },
            pending: { text: t('status.awaitingShipment'), color: 'bg-warning/10 text-warning' },
            delivered: { text: t('status.delivered'), color: 'bg-success/10 text-success' },
            cancelled: { text: t('status.cancelled'), color: 'bg-gray-100 text-gray-500' },
          }
          const status = statusMap[o.status] || statusMap.pending
          return {
            id: o.id || o.orderId || `ORD-${Date.now()}-${i}`,
            product: o.product || o.productName || o.title || `${t('fulfillment.productFallback')}${i + 1}`,
            status: status.text,
            statusColor: status.color,
            // P5-07: include real tracking events and logistics channel
            tracking: Array.isArray(o.tracking) ? o.tracking : undefined,
            logisticsChannel: o.logisticsChannel || o.logistics_channel || undefined,
          }
        })
        setOrders(orderItems)

        // P5-07: build tracking updates from real tracking data
        const ordersWithTracking = ordersData.data
          .filter((o: any) => Array.isArray(o.tracking) && o.tracking.length > 0)
          .slice(0, 5)

        setTrackingUpdates(
          ordersWithTracking.map((o: any, i: number) => {
            const latest = o.tracking[0]
            return {
              id: `tracking-${i}`,
              orderId: o.id || o.orderNumber || `ORD-${i}`,
              status: latest.status,
              timestamp: latest.occurred_at,
              carrier: latest.carrier ?? o.logisticsChannel ?? null,
              tracking_number: latest.tracking_number ?? null,
            }
          })
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
            product: p.name || p.title || p.productName || `${t('fulfillment.productFallback')}${i + 1}`,
            stock: p.stock || p.inventory || 0,
            level: (p.stock || p.inventory || 0) < 10 ? t('fulfillment.riskVeryLow') : t('fulfillment.riskLow'),
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
  }, [t])

  useEffect(() => {
    fetchFulfillmentData()
  }, [fetchFulfillmentData])

  const {
    submit,
    pause,
    terminate,
    retry,
    displayId,
    taskId,
    taskStatus,
    steps,
    error,
    submitting,
    controlling,
    isActive,
    clearError,
  } = useAgentTask({
    agentType: 'fulfillment',
    onTerminal: (status) => {
      if (status === 'completed') {
        void fetchFulfillmentData()
      }
    },
  })

  const handleSubmit = async () => {
    await submit({ action: 'sync' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('nav.fulfillment')}</h2>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? `${t('fulfillment.syncing')}...` : t('fulfillment.syncOrders')}
        </button>
      </div>

      {error && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label={t('common.closeError')}
          >
            ×
          </button>
        </div>
      )}

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
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('fulfillment.orderList')}</h3>
          </div>
          {orders.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-[#6B7080] text-sm">
              {t('fulfillment.noOrdersHint')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                  <th className="px-6 py-3 font-medium">{t('fulfillment.colOrderNo')}</th>
                  <th className="px-6 py-3 font-medium">{t('fulfillment.colProduct')}</th>
                  <th className="px-6 py-3 font-medium">{t('fulfillment.colStatus')}</th>
                  <th className="px-6 py-3 font-medium">{t('fulfillment.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED] font-mono text-xs">
                      {o.id}
                    </td>
                    <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{o.product}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.statusColor}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push('/dashboard/orders')}
                        className="text-primary text-xs hover:underline"
                      >
                        {t('fulfillment.detail')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('fulfillment.tracking')}</h3>
          {trackingUpdates.length === 0 ? (
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] text-center py-4">{t('fulfillment.noTracking')}</p>
          ) : (
            <div className="space-y-3">
              {trackingUpdates.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">
                        {item.orderId}
                      </p>
                      {item.carrier && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {item.carrier}
                        </span>
                      )}
                      {item.tracking_number && (
                        <span className="text-xs font-mono text-[#4E5969] dark:text-[#A0A4AC]">
                          {item.tracking_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">
                      {item.status} · {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('fulfillment.stockAlert')}</h3>
          {stockAlerts.length === 0 ? (
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] text-center py-4">{t('fulfillment.stockOk')}</p>
          ) : (
            <div className="space-y-3">
              {stockAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-danger/5 rounded-lg">
                  <div>
                    <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{a.product}</p>
                    <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{t('fulfillment.stockLeft')}: {a.stock}</p>
                  </div>
                  <span className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full">
                    {a.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isActive && (displayId || taskId) && (
        <AIStepProgress
          taskId={(displayId || taskId) as string}
          steps={steps}
          taskStatus={taskStatus}
          errorMessage={error}
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
