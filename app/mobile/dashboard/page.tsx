'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge } from '@/components/MobileCard'

interface DashboardStats {
  revenue: string
  orders: number
  roas: string
  csRate: string
  hasData: boolean
}

interface TaskLog {
  taskId: string
  agentType: string
  taskName: string
  status: string
  createdAt: string
}

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
const AGENTS = ['selection', 'store-builder', 'content', 'ad-optimizer', 'customer-service', 'fulfillment']

export default function MobileDashboardPage() {
  const { t } = useTranslation()
  const stats = useApi(() => getJson<DashboardStats>('/api/dashboard/stats'))
  const tasks = useApi(() => getJson<{ data: TaskLog[] }>('/api/task-logs?limit=50'))

  const statCards = [
    { label: t('dashboard.storeRevenue'), value: stats.data?.revenue ?? '—' },
    { label: t('dashboard.todayOrders'), value: String(stats.data?.orders ?? 0) },
    { label: t('dashboard.adROAS'), value: stats.data?.roas ?? '—' },
    { label: t('dashboard.customerServiceRate'), value: stats.data?.csRate ?? '—' },
  ]
  const hasData = stats.data?.hasData ?? false
  const logs = tasks.data?.data ?? []

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
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

      <Card title={t('dashboard.aiAgentStatus')}>
        <MobileApiState state={tasks.state} error={tasks.error} onRetry={tasks.retry} emptyTitle={t('mobile.tasksEmpty')} emptyHint={t('mobile.tasksHint')} />
        <div className="grid grid-cols-2 gap-3">
          {AGENTS.map((agent) => {
            const agentLogs = logs.filter((l) => l.agentType === agent)
            const running = agentLogs.some((l) => l.status === 'pending' || l.status === 'running')
            const latest = agentLogs[0]
            return (
              <div key={agent} className="rounded-lg bg-gray-50 p-3 dark:bg-[#22252D]">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t(`agents.${agentKey(agent)}`)}</p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-[#6B7080]">
                  {agentLogs.length} {t('mobile.tasks').toLowerCase()}
                </p>
                <div className="mt-2">
                  {agentLogs.length === 0 ? (
                    <span className="text-[11px] text-gray-400 dark:text-[#6B7080]">{t('common.noData')}</span>
                  ) : running ? (
                    <StatusBadge status="running" label={t('status.running')} />
                  ) : latest ? (
                    <StatusBadge status={latest.status} label={t(`status.${latest.status}`)} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title={t('dashboard.todoTasks')}>
        <div className="space-y-2">
          {logs.slice(0, 8).map((log) => (
            <div key={log.taskId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900 dark:text-white">{t(`agents.${agentKey(log.agentType)}`)}</p>
                <p className="truncate text-xs text-gray-400 dark:text-[#6B7080]">{log.createdAt?.slice(0, 10) ?? ''}</p>
              </div>
              <StatusBadge status={log.status} label={t(`status.${log.status}`)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
