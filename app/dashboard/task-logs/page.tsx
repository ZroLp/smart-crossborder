'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'

interface TaskLogItem {
  taskId: string
  displayId: string
  agentType: string
  taskName: string
  status: string
  userId: number | null
  error: string | null
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const AGENT_OPTIONS = ['' , 'selection', 'store-builder', 'content', 'ad-optimizer', 'customer-service', 'fulfillment']

const STATUS_OPTIONS = ['', 'pending', 'running', 'paused', 'completed', 'failed', 'terminated']

const AGENT_LABEL_KEYS: Record<string, string> = {
  selection: 'agents.selection',
  'store-builder': 'agents.storeBuilder',
  content: 'agents.content',
  'ad-optimizer': 'agents.adOptimizer',
  'customer-service': 'agents.customerService',
  fulfillment: 'agents.fulfillment',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'taskLogs.waiting',
  running: 'status.running',
  paused: 'status.paused',
  completed: 'status.completed',
  failed: 'status.failed',
  terminated: 'status.terminated',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#4E5969] bg-[#4E5969]/10',
  running: 'text-primary bg-primary/10',
  paused: 'text-[#FF7D00] bg-[#FF7D00]/10',
  completed: 'text-success bg-success/10',
  failed: 'text-danger bg-danger/10',
  terminated: 'text-danger bg-danger/10',
}

const TIME_RANGE_MS: Record<string, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function parseTime(value: string): number {
  if (!value) return NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return Date.parse(normalized)
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const start = parseTime(createdAt)
  const end = parseTime(updatedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  if (minutes < 60) return `${minutes}m ${remain}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export default function TaskLogsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const agentLabelOf = (agent: string) => {
    if (agent === '') return t('taskLogs.allAgents')
    const key = AGENT_LABEL_KEYS[agent]
    return key ? t(key) : agent
  }
  const statusLabelOf = (status: string) => {
    if (status === '') return t('taskLogs.allStatuses')
    const key = STATUS_LABEL_KEYS[status]
    return key ? t(key) : status
  }
  const [agentFilter, setAgentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState('7d')
  const [logs, setLogs] = useState<TaskLogItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (agentFilter) params.set('agentType', agentFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/task-logs?${params.toString()}`)
      const data = await res.json()

      if (res.ok === false || data.success === false) {
        setError(data.error || t('taskLogs.listLoadFailed'))
        setLogs([])
        return
      }

      setLogs(Array.isArray(data.data) ? data.data : [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch {
      setError(t('taskLogs.listLoadFailedNetwork'))
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [agentFilter, page, statusFilter, t])

  useEffect(() => {
    loadLogs()
  }, [loadLogs, reloadToken])

  useEffect(() => {
    setPage(1)
  }, [agentFilter, statusFilter])

  const handleRetry = async (log: TaskLogItem) => {
    if (retryingId) return
    setRetryingId(log.taskId)
    setActionError(null)
    try {
      const res = await fetch('/api/agent/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: log.taskId }),
      })
      const data = await res.json()
      if (res.ok === false) {
        if (data.code === 'TASK_NOT_FOUND') {
          setActionError(t('taskLogs.taskNotFound'))
        } else if (data.code === 'INVALID_STATE') {
          setActionError(t('taskLogs.invalidState'))
        } else {
          setActionError(data.error || t('taskLogs.retryFailed'))
        }
        return
      }
      if (!data?.data?.taskId) {
        setActionError(data.error || t('taskLogs.retryFailed'))
        return
      }
      setReloadToken((prev) => prev + 1)
    } catch {
      setActionError(t('taskLogs.retryFailedNetwork'))
    } finally {
      setRetryingId(null)
    }
  }

  const now = Date.now()
  const filteredLogs = logs.filter((log) => {
    const created = parseTime(log.createdAt)
    if (!Number.isFinite(created)) return true
    return now - created <= TIME_RANGE_MS[timeRange]
  })

  const totalCount = pagination.total || logs.length
  const runningCount = logs.filter((log) => log.status === 'running' || log.status === 'pending').length
  const completedCount = logs.filter((log) => log.status === 'completed').length
  const failedCount = logs.filter(
    (log) => log.status === 'failed' || log.status === 'terminated'
  ).length

  const handleExport = () => {
    const csv =
      `${t('taskLogs.csvHeader')}\n` +
      filteredLogs
        .map(
          (log) =>
            `${log.displayId},${agentLabelOf(log.agentType)},${log.taskName},${
              statusLabelOf(log.status)
            },${log.createdAt},${formatDuration(log.createdAt, log.updatedAt)}`
        )
        .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-logs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('taskLogs.title')}</h2>
        <button
          onClick={handleExport}
          disabled={filteredLogs.length === 0}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('taskLogs.export')}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => loadLogs()}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            {t('common.reload')}
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label={t('common.closeError')}
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.agentFilter')}</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            >
              {AGENT_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {agentLabelOf(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.statusFilter')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {statusLabelOf(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.timeRange')}</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            >
              <option value="1d">{t('taskLogs.today')}</option>
              <option value="3d">{t('taskLogs.last3d')}</option>
              <option value="7d">{t('taskLogs.last7d')}</option>
              <option value="30d">{t('taskLogs.last30d')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.totalTasks')}</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.runningCount')}</p>
          <p className="text-h1 text-primary mt-1">{runningCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.completedCount')}</p>
          <p className="text-h1 text-success mt-1">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.failedCount')}</p>
          <p className="text-h1 text-danger mt-1">{failedCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colTaskId')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colAgent')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colTaskName')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colStatus')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colCreated')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colDuration')}</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">{t('taskLogs.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">
                    {t('common.loading')}...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">
                    {t('taskLogs.noLogs')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const statusColor = STATUS_COLORS[log.status] ?? STATUS_COLORS.pending
                  const canRetry =
                    log.status === 'failed' ||
                    log.status === 'terminated' ||
                    log.status === 'paused'
                  return (
                    <tr
                      key={log.taskId}
                      className="border-b border-gray-50 dark:border-[#22252D] hover:bg-gray-50 dark:hover:bg-[#22252D] transition-colors"
                    >
                      <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">
                        {log.displayId}
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {agentLabelOf(log.agentType)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-[#1D2129] dark:text-[#E8EAED]">
                        {log.taskName || '—'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                          {statusLabelOf(log.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]">
                        {log.createdAt}
                      </td>
                      <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]">
                        {formatDuration(log.createdAt, log.updatedAt)}
                      </td>
                      <td className="px-6 py-3">
                        {canRetry ? (
                          <button
                            onClick={() => handleRetry(log)}
                            disabled={retryingId !== null}
                            className="text-xs text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {retryingId === log.taskId ? t('taskLogs.retrying') : t('taskLogs.rerun')}
                          </button>
                        ) : log.status === 'running' || log.status === 'pending' ? (
                          <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">—</span>
                        ) : (
                          <button
                            onClick={() => router.push(`/dashboard/task-logs/${log.displayId}`)}
                            className="text-xs text-primary hover:underline"
                          >
                            {t('taskLogs.detail')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A2D35] text-sm text-[#4E5969] dark:text-[#A0A4AC] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('taskLogs.prevPage')}
          </button>
          <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
            disabled={page >= pagination.totalPages || isLoading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A2D35] text-sm text-[#4E5969] dark:text-[#A0A4AC] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('taskLogs.nextPage')}
          </button>
        </div>
      )}
    </div>
  )
}
