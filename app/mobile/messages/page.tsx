'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson, getJsonData } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge, Empty } from '@/components/MobileCard'

interface TaskLog {
  taskId: string
  agentType: string
  taskName: string
  status: string
  createdAt: string
}

interface ComplianceItem {
  id: number
  title?: string
  summary?: string
  createdAt?: string
}

export default function MobileMessagesPage() {
  const { t } = useTranslation()
  const tasks = useApi(() => getJson<{ data: TaskLog[] }>('/api/task-logs?limit=50'))
  const compliance = useApi(() =>
    getJsonData<{ policyUpdates: ComplianceItem[]; taxReminders: ComplianceItem[] }>('/api/compliance')
  )
  const [tab, setTab] = useState<'all' | 'tasks' | 'system'>('all')

  const taskLogs = tasks.data?.data ?? []
  const policyUpdates = compliance.data?.policyUpdates ?? []
  const taxReminders = compliance.data?.taxReminders ?? []
  const systemCount = policyUpdates.length + taxReminders.length
  const hasSystem = systemCount > 0

  const showTasks = tab !== 'system'
  const showSystem = tab !== 'tasks'
  const nothingToShow =
    tasks.state !== 'loading' &&
    compliance.state !== 'loading' &&
    (showTasks && taskLogs.length === 0) &&
    (showSystem && !hasSystem)

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t('mobile.messages')}</h1>

      <div className="mb-4 flex gap-2">
        {([['all', t('common.viewAll')], ['tasks', t('mobile.tasks')], ['system', t('compliance.policyUpdate')]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 shadow-sm dark:bg-[#181A20] dark:text-[#8B91A0]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {nothingToShow && (
        <Empty title={t('mobile.msgEmpty')} hint={t('mobile.msgHint')} />
      )}

      <div className="space-y-4">
        {showSystem && hasSystem && (
          <>
            <Card title={t('compliance.policyUpdate')} right={<span className="text-xs text-gray-400">{policyUpdates.length}</span>}>
              <div className="space-y-2">
                {policyUpdates.map((u) => (
                  <div key={u.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                    <p className="text-sm text-gray-900 dark:text-white">{u.title ?? ''}</p>
                    {u.summary && <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8B91A0]">{u.summary}</p>}
                  </div>
                ))}
              </div>
            </Card>
            <Card title={t('compliance.taxReminder')} right={<span className="text-xs text-gray-400">{taxReminders.length}</span>}>
              <div className="space-y-2">
                {taxReminders.map((u) => (
                  <div key={u.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                    <p className="text-sm text-gray-900 dark:text-white">{u.title ?? ''}</p>
                    {u.summary && <p className="mt-0.5 text-xs text-gray-500 dark:text-[#8B91A0]">{u.summary}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {showTasks && (
          <Card title={t('mobile.tasks')} right={<span className="text-xs text-gray-400">{taskLogs.length}</span>}>
            <MobileApiState state={tasks.state} error={tasks.error} onRetry={tasks.retry} emptyTitle={t('mobile.tasksEmpty')} emptyHint={t('mobile.tasksHint')} />
            <div className="space-y-2">
              {taskLogs.map((l) => (
                <div key={l.taskId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-900 dark:text-white">{l.taskName}</p>
                    <p className="text-xs text-gray-400 dark:text-[#6B7080]">{l.agentType} · {l.createdAt?.slice(0, 10) ?? ''}</p>
                  </div>
                  <StatusBadge status={l.status} label={t(`status.${l.status}`)} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showTasks && tasks.state === 'error' && (
        <p role="alert" className="mt-3 text-xs text-red-500">
          {tasks.error}
        </p>
      )}
    </div>
  )
}
