'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson, getJsonData } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, Empty, RiskBadge } from '@/components/MobileCard'

interface MobileProduct {
  id: number
  name: string
  category: string | null
  price: number | null
  sales: number
  stock: number
  status: string
}

interface RiskItem {
  id: number
  title: string
  summary?: string
  level: string
  status?: string
}

export default function MobileSelectionPage() {
  const { t } = useTranslation()
  const products = useApi(() => getJson<MobileProduct[]>('/api/data?type=products'))
  const compliance = useApi(() => getJsonData<{ riskItems: RiskItem[] }>('/api/compliance'))

  const topProducts = [...(products.data ?? [])].sort((a, b) => b.sales - a.sales).slice(0, 10)
  const risks = (compliance.data?.riskItems ?? []).filter((r) => r.status !== 'resolved').slice(0, 6)

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('nav.selection')}</h1>

      <Card title={t('mobile.myProducts')}>
        <MobileApiState state={products.state} error={products.error} onRetry={products.retry} emptyTitle={t('mobile.productsEmpty')} emptyHint={t('mobile.productsHint')} />
        <div className="space-y-2">
          {topProducts.map((p) => (
            <div key={p.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                  {p.price != null ? p.price.toFixed(2) : '—'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-[#6B7080]">{p.category ?? '—'}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('mobile.riskAlertsTitle')}>
        <MobileApiState state={compliance.state} error={compliance.error} onRetry={compliance.retry} emptyTitle={t('mobile.riskEmpty')} emptyHint={t('mobile.riskHint')} />
        {compliance.state === 'success' && risks.length === 0 ? (
          <Empty title={t('mobile.riskEmpty')} hint={t('mobile.riskHint')} />
        ) : (
          <div className="space-y-2">
          {risks.map((r) => (
            <div key={r.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-gray-900 dark:text-white">{r.title}</p>
                <RiskBadge level={r.level} />
              </div>
              {r.summary && <p className="mt-1 text-xs text-gray-500 dark:text-[#8B91A0]">{r.summary}</p>}
            </div>
          ))}
          </div>
        )}
      </Card>

      <Card title={t('mobile.competitors')}>
        <Empty title={t('common.comingSoon')} />
      </Card>
    </div>
  )
}
