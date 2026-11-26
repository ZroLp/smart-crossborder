'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'
import { getJson } from '@/lib/api/get-json'

interface ComplianceEvent {
  id: number
  eventType: string
  detail: string | null
  createdAt: string
}

interface ComplianceDetail {
  id: number
  kind: string
  source: string | null
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string | null
  events: ComplianceEvent[]
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function severityColor(level?: string): string {
  switch (level) {
    case 'high': return 'text-red-600'
    case 'medium': return 'text-orange-500'
    case 'low': return 'text-blue-500'
    default: return 'text-[#4E5969]'
  }
}

export default function ComplianceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const id = params.id as string

  const [detail, setDetail] = useState<ComplianceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getJson<{ success: boolean; data: ComplianceDetail }>(`/api/compliance/${id}`)
        if (!cancelled && res.success) setDetail(res.data)
        if (!cancelled) setError(res.success ? null : '404')
      } catch {
        if (!cancelled) setError('network')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function handleMarkProcessed() {
    if (!detail) return
    try {
      await fetch(`/api/compliance/${detail.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'processed', detail: 'Marked as processed from detail page' }),
      })
      // Reload to refresh the audit timeline
      const res = await getJson<{ success: boolean; data: ComplianceDetail }>(`/api/compliance/${id}`)
      if (res.success) setDetail(res.data)
    } catch {
      // ignore
    }
  }

  const kindLabel: Record<string, string> = {
    policy: t('compliance.policyUpdate'),
    tax: t('compliance.taxReminder'),
    check: t('compliance.complianceCheck'),
    risk: t('compliance.riskList'),
    suggestion: t('compliance.rectification'),
  }

  const hasAuditLog = (detail?.events?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/compliance')}
          className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-primary transition-colors"
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">
          {t('compliance.detailTitle')}
        </h2>
      </div>

      {/* Error / not found */}
      {error && !loading && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <div className="flex flex-col items-center justify-center py-10">
            <span className="text-4xl mb-3">🛡️</span>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">
              {t('compliance.itemPrefix')} {id} {t('compliance.noDetail')}
            </p>
            <button
              onClick={() => router.push('/dashboard/compliance')}
              className="mt-4 text-primary text-sm hover:underline"
            >
              {t('compliance.backToCenter')}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-24 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      )}

      {/* Content */}
      {detail && !loading && !error && (
        <div className="space-y-6">
          {/* Kind + source badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {kindLabel[detail.kind] ?? detail.kind}
            </span>
            {detail.source && (
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  detail.source === 'demo'
                    ? 'bg-gray-100 dark:bg-gray-800 text-[#86909C] dark:text-[#A0A4AC]'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}
              >
                {detail.source === 'demo'
                  ? t('compliance.demoData')
                  : `${t('compliance.source')}：${detail.source}`}
              </span>
            )}
          </div>

          {/* Payload */}
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5 space-y-4">
            {typeof detail.payload.title === 'string' && (
              <h3 className="text-base font-semibold text-[#1D2129] dark:text-[#E8EAED]">
                {detail.payload.title}
              </h3>
            )}
            {typeof detail.payload.summary === 'string' && (
              <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] leading-relaxed">
                {detail.payload.summary}
              </p>
            )}
            {typeof detail.payload.level === 'string' && (
              <p className={`text-sm font-medium ${severityColor(detail.payload.level as string)}`}>
                {t(`compliance.sev${detail.payload.level === 'high' ? 'High' : detail.payload.level === 'medium' ? 'Mid' : 'Low'}`)}
              </p>
            )}
            {typeof detail.payload.effectiveDate === 'string' && (
              <p className="text-xs text-[#86909C] dark:text-[#A0A4AC]">
                {t('compliance.dueDate')}：{detail.payload.effectiveDate}
              </p>
            )}
            {typeof detail.payload.action === 'string' && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs font-medium text-[#4E5969] dark:text-[#A0A4AC] mb-1">
                  {t('compliance.rectification')}
                </p>
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{detail.payload.action}</p>
              </div>
            )}

            {/* Mark as processed button */}
            {detail.kind === 'suggestion' && (
              <button
                onClick={handleMarkProcessed}
                className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('compliance.markProcessed')}
              </button>
            )}
          </div>

          {/* Timestamps */}
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-3">
              {t('compliance.createdAt')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[#86909C] dark:text-[#A0A4AC] block text-xs mb-0.5">
                  {t('compliance.createdAt')}
                </span>
                <span className="text-[#1D2129] dark:text-[#E8EAED]">{formatDate(detail.createdAt)}</span>
              </div>
              {detail.updatedAt && (
                <div>
                  <span className="text-[#86909C] dark:text-[#A0A4AC] block text-xs mb-0.5">
                    {t('compliance.updatedAt')}
                  </span>
                  <span className="text-[#1D2129] dark:text-[#E8EAED]">{formatDate(detail.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Audit timeline */}
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <h4 className="text-sm font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">
              {t('compliance.auditLog')}
            </h4>
            {!hasAuditLog && (
              <p className="text-sm text-[#86909C] dark:text-[#A0A4AC] py-2">
                {t('compliance.noAudit')}
              </p>
            )}
            {hasAuditLog && (
              <ol className="space-y-0 relative">
                {detail.events.map((event, idx) => (
                  <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* timeline line */}
                    {idx < (detail.events ?? []).length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    )}
                    {/* dot */}
                    <div
                      className={`relative w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                        event.eventType === 'processed'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          event.eventType === 'processed'
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                      />
                    </div>
                    {/* content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                          {event.eventType === 'processed'
                            ? t('compliance.eventProcessed')
                            : event.eventType}
                        </span>
                        {event.detail && (
                          <span className="text-xs text-[#86909C] dark:text-[#A0A4AC]">
                            {event.detail}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#86909C] dark:text-[#A0A4AC] mt-0.5">
                        {formatDate(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
