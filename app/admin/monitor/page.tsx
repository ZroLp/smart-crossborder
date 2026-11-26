'use client'

import { useState, useEffect } from 'react'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useTranslation } from '@/lib/i18n/use-translation'

interface MonitorData {
  tasks: { byStatus: Record<string, number>; last24h: number; total: number }
  users: number
  payments: number
  subscriptions: number
  dunning: number
  audit: Array<{
    actor_id: number | null
    action: string
    resource: string | null
    resource_id: string | null
    before_json: string | null
    after_json: string | null
    ip: string | null
    created_at: string
  }>
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
      <p className="text-xs text-[#86909C] dark:text-[#6B7080]">{label}</p>
      <p className="text-2xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">{value}</p>
    </div>
  )
}

export default function AdminMonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchMonitor() {
      try {
        const res = await fetch('/api/admin/monitor')
        if (res.ok) {
          const payload = await res.json()
          if (payload.success) {
            setData(payload.data)
          }
        }
      } catch {
        console.error('Failed to fetch monitor data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMonitor()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="text" width="200px" height="24px" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} variant="card" height="80px" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-[#86909C] dark:text-[#6B7080]">--</p>
      </div>
    )
  }

  const statusEntries = Object.entries(data.tasks.byStatus)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">{t('admin.monitorTitle')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label={t('admin.monitorLast24h')} value={data.tasks.last24h} />
        <StatCard label={t('admin.monitorTasks')} value={data.tasks.total} />
        <StatCard label={t('admin.monitorUsers')} value={data.users} />
        <StatCard label={t('admin.monitorPayments')} value={data.payments} />
        <StatCard label={t('admin.monitorSubs')} value={data.subscriptions} />
        <StatCard label={t('admin.monitorDunning')} value={data.dunning} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">{t('admin.monitorTasks')}</h2>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-[#86909C] dark:text-[#6B7080]">--</p>
          ) : (
            <div className="space-y-2">
              {statusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{status}</span>
                  <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">{t('admin.monitorRecentAudit')}</h2>
          {data.audit.length === 0 ? (
            <p className="text-sm text-[#86909C] dark:text-[#6B7080]">{t('admin.auditEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {data.audit.map((log, i) => (
                <div key={`${log.created_at}-${i}`} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">{log.action}</span>
                  <span className="text-xs text-[#86909C] dark:text-[#6B7080]">
                    {log.actor_id ?? '--'} · {new Date(log.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
