'use client'

import { useState, useEffect } from 'react'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useTranslation } from '@/lib/i18n/use-translation'

interface AuditLog {
  actor_id: number | null
  action: string
  resource: string | null
  resource_id: string | null
  before_json: string | null
  after_json: string | null
  ip: string | null
  created_at: string
}

function jsonSummary(json: string | null): string {
  if (!json) return '--'
  let text = json
  try {
    const parsed = JSON.parse(json)
    const role = parsed?.user?.role
    if (typeof role === 'string') text = `role=${role}`
    else text = JSON.stringify(parsed)
  } catch {
    /* keep raw */
  }
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch('/api/admin/audit')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setLogs(data.data?.logs ?? [])
          }
        }
      } catch {
        console.error('Failed to fetch audit logs')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAudit()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">{t('admin.auditTitle')}</h1>
        <span className="text-sm text-[#86909C] dark:text-[#6B7080]">{logs.length}</span>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonLoader variant="text" width="140px" height="16px" />
              <SkeletonLoader variant="text" width="120px" height="16px" />
              <SkeletonLoader variant="text" width="200px" height="16px" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">{t('admin.auditEmpty')}</h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.auditColTime')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.auditColActor')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.auditColAction')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.auditColBefore')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.auditColAfter')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={`${log.created_at}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50 dark:hover:bg-[#22252D]/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-[#86909C] dark:text-[#6B7080] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4E5969] dark:text-[#A0A4AC]">{log.actor_id ?? '--'}</td>
                  <td className="px-6 py-4 text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">
                    {log.action}
                    {log.resource && (
                      <span className="ml-1 text-xs text-[#86909C] dark:text-[#6B7080]">
                        {log.resource}{log.resource_id ? ` #${log.resource_id}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#4E5969] dark:text-[#A0A4AC] break-all max-w-xs">{jsonSummary(log.before_json)}</td>
                  <td className="px-6 py-4 text-xs text-[#4E5969] dark:text-[#A0A4AC] break-all max-w-xs">{jsonSummary(log.after_json)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
