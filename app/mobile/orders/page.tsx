'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge } from '@/components/MobileCard'

interface MobileOrder {
  id: number
  order_number: string | null
  customer_name: string | null
  total_amount: number | null
  status: string
  shipping_region: string | null
  logistics_channel: string | null
  created_at: string
}

const TABS = ['all', 'pending', 'shipped', 'completed'] as const
type Tab = (typeof TABS)[number]

export default function MobileOrdersPage() {
  const { t } = useTranslation()
  const orders = useApi(() => getJson<MobileOrder[]>('/api/data?type=orders'))
  const [tab, setTab] = useState<Tab>('all')

  const all = orders.data ?? []
  const filtered = tab === 'all' ? all : all.filter((o) => o.status === tab)
  const tabLabel = (v: Tab) => (v === 'all' ? t('mobile.orderAll') : t(`status.${v}`))

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t('mobile.orderAll')}</h1>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === v
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 shadow-sm dark:bg-[#181A20] dark:text-[#8B91A0]'
            }`}
          >
            {tabLabel(v)}
          </button>
        ))}
      </div>

      <MobileApiState state={orders.state} error={orders.error} onRetry={orders.retry} emptyTitle={t('mobile.ordersEmpty')} emptyHint={t('mobile.ordersHint')} />
      <div className="space-y-3">
        {filtered.map((o) => (
          <Card key={o.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {o.order_number ?? `#${o.id}`}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#6B7080]">
                  {o.customer_name ?? '—'} · {o.created_at?.slice(0, 10) ?? ''}
                </p>
              </div>
              <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-[#8B91A0]">
                {o.shipping_region ?? '—'} · {o.logistics_channel ?? '—'}
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {o.total_amount != null ? o.total_amount.toFixed(2) : '—'}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
