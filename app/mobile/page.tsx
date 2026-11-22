'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useAuth } from '@/lib/auth/auth-context'
import { useApi } from '@/lib/hooks/use-api'
import { getJson, getJsonData } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, Empty, StatusBadge, RiskBadge } from '@/components/MobileCard'

interface DashboardStats {
  revenue: string
  orders: number
  roas: string
  csRate: string
  hasData: boolean
}

interface DashboardData {
  totalProducts: number
  totalOrders: number
  pendingTasks: number
  recentLogs: Array<{ agent_type: string; task_name: string; status: string; created_at: string }>
}

interface MobileProduct {
  id: number
  name: string
  category: string | null
  price: number | null
  sales: number
  stock: number
}

interface RiskItem {
  id: number
  title: string
  summary?: string
  level: string
  status?: string
}

// The server-side agent_type uses hyphenated naming (e.g., ad-optimizer), mapped to i18n agents.* keys
const AGENT_KEY_MAP: Record<string, string> = {
  'ad-optimizer': 'adOptimizer',
  'customer-service': 'customerService',
  'store-builder': 'storeBuilder',
  selection: 'selection',
  content: 'content',
  fulfillment: 'fulfillment',
}
function agentKey(agentType: string): string {
  return AGENT_KEY_MAP[agentType] ?? agentType
}

export default function MobileHomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const stats = useApi(() => getJson<DashboardStats>('/api/dashboard/stats'))
  const dashboard = useApi(() => getJson<DashboardData>('/api/data?type=dashboard'))
  const products = useApi(() => getJson<MobileProduct[]>('/api/data?type=products'))
  const compliance = useApi(() => getJsonData<{ riskItems: RiskItem[] }>('/api/compliance'))

  const statCards = [
    { label: t('dashboard.storeRevenue'), value: stats.data?.revenue ?? '—' },
    { label: t('dashboard.todayOrders'), value: String(stats.data?.orders ?? 0) },
    { label: t('dashboard.adROAS'), value: stats.data?.roas ?? '—' },
    { label: t('dashboard.customerServiceRate'), value: stats.data?.csRate ?? '—' },
  ]
  const hasData = stats.data?.hasData ?? false
  const topProducts = [...(products.data ?? [])].sort((a, b) => b.sales - a.sales).slice(0, 5)
  const risks = (compliance.data?.riskItems ?? []).filter((r) => r.status !== 'resolved').slice(0, 4)

  return (
    <div className="px-4 pb-6 pt-4">
      <header className="mb-4 flex items-center justify-between">
        {user ? (
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('mobile.hello')}, {user.username}
          </h1>
        ) : (
          <div className="text-sm text-gray-500 dark:text-[#8B91A0]">
            {t('mobile.loginPrompt')}{' '}
            <Link href="/mobile/login" className="font-medium text-primary underline">
              {t('mobile.loginNow')}
            </Link>
          </div>
        )}
      </header>

      <MobileApiState state={stats.state} error={stats.error} onRetry={stats.retry} />
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((c) => (
          <Card key={c.label}>
            <p className="text-xs text-gray-500 dark:text-[#8B91A0]">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            {!hasData && stats.state === 'success' && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-[#6B7080]">{t('common.insufficientData')}</p>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <Card title={t('mobile.tasks')} right={<span className="text-xs text-gray-400">{dashboard.data?.pendingTasks ?? 0}</span>}>
          <MobileApiState state={dashboard.state} error={dashboard.error} onRetry={dashboard.retry} emptyTitle={t('mobile.tasksEmpty')} emptyHint={t('mobile.tasksHint')} />
          <div className="space-y-2">
            {(dashboard.data?.recentLogs ?? []).slice(0, 5).map((log, i) => (
              <div key={`${log.agent_type}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900 dark:text-white">{t(`agents.${agentKey(log.agent_type)}`)}</p>
                  <p className="truncate text-xs text-gray-400 dark:text-[#6B7080]">{log.created_at?.slice(0, 10) ?? ''}</p>
                </div>
                <StatusBadge status={log.status} label={t(`status.${log.status}`)} />
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('mobile.myProducts')} right={<span className="text-xs text-gray-400">{products.data?.length ?? 0}</span>}>
          <MobileApiState state={products.state} error={products.error} onRetry={products.retry} emptyTitle={t('mobile.productsEmpty')} emptyHint={t('mobile.productsHint')} />
          <div className="space-y-2">
            {topProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-[#6B7080]">{p.category ?? '—'} · {p.sales}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                  {p.price != null ? p.price.toFixed(2) : '—'}
                </span>
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

      <nav className="mt-4 grid grid-cols-2 gap-3">
        {[
          { href: '/mobile/selection', label: t('nav.selection') },
          { href: '/mobile/content', label: t('nav.content') },
          { href: '/mobile/orders', label: t('nav.dataCenter') },
          { href: '/mobile/ad-optimizer', label: t('nav.adOptimizer') },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 dark:bg-[#181A20] dark:text-white dark:hover:bg-[#22252D]"
          >
            {a.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
