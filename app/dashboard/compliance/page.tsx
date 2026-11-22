'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'

interface ComplianceItem {
  id: number | string
  title?: string | null
  summary?: string | null
  level?: string | null
  status?: string | null
  effectiveDate?: string | null
  dueDate?: string | null
  source?: string | null
  category?: string | null
  action?: string | null
  [key: string]: unknown
}

interface ComplianceData {
  policyUpdates: ComplianceItem[]
  taxReminders: ComplianceItem[]
  complianceChecks: ComplianceItem[]
  riskItems: ComplianceItem[]
  suggestions: ComplianceItem[]
}

const EMPTY_DATA: ComplianceData = {
  policyUpdates: [],
  taxReminders: [],
  complianceChecks: [],
  riskItems: [],
  suggestions: [],
}

function text(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return '—'
}

function normalizeList(value: unknown): ComplianceItem[] {
  return Array.isArray(value) ? (value as ComplianceItem[]) : []
}

function normalizeData(raw: unknown): ComplianceData {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    policyUpdates: normalizeList(data.policyUpdates),
    taxReminders: normalizeList(data.taxReminders),
    complianceChecks: normalizeList(data.complianceChecks),
    riskItems: normalizeList(data.riskItems),
    suggestions: normalizeList(data.suggestions),
  }
}

const statusColor: Record<string, string> = {
  pass: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  fail: 'text-danger bg-danger/10',
}

function getStatusLabel(t: (key: string) => string): Record<string, string> {
  return {
    pass: t('compliance.checkPassed'),
    warning: t('compliance.checkWarning'),
    fail: t('compliance.checkFailed'),
  }
}

const severityColor: Record<string, string> = {
  high: 'text-danger bg-danger/10',
  medium: 'text-warning bg-warning/10',
  low: 'text-primary bg-primary/10',
}

function getSeverityLabel(t: (key: string) => string): Record<string, string> {
  return {
    high: t('compliance.sevHigh'),
    medium: t('compliance.sevMid'),
    low: t('compliance.sevLow'),
  }
}

const urgencyColor: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-[#4E5969] dark:text-[#A0A4AC]',
}

const EmptyRow = ({ text: label }: { text: string }) => (
  <p className="text-sm text-[#86909C] dark:text-[#6B7080] py-4 text-center">{label}</p>
)

export default function CompliancePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const statusLabel = getStatusLabel(t)
  const severityLabel = getSeverityLabel(t)
  const [activeTab, setActiveTab] = useState<'all' | 'policy' | 'tax' | 'check' | 'risk'>('all')
  const [processedSuggestions, setProcessedSuggestions] = useState<Set<string>>(new Set())
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [data, setData] = useState<ComplianceData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const loadCompliance = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/compliance', { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setError(body.error || t('compliance.loadFailed'))
        setData(EMPTY_DATA)
        return
      }
      setData(normalizeData(body.data))
    } catch {
      setError(`${t('compliance.networkError')}，${t('compliance.loadFailed')}`)
      setData(EMPTY_DATA)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadCompliance()
  }, [loadCompliance, reloadToken])

  const tabs = [
    { key: 'all' as const, label: t('common.all') },
    { key: 'policy' as const, label: t('compliance.policyUpdate') },
    { key: 'tax' as const, label: t('compliance.taxReminder') },
    { key: 'check' as const, label: t('compliance.complianceCheck') },
    { key: 'risk' as const, label: t('compliance.riskList') },
  ]

  const unreadPolicy = data.policyUpdates.filter(
    (item) => item.status === 'new' || item.status === 'unread'
  ).length
  const urgentTax = data.taxReminders.filter((item) => item.level === 'high').length
  const highRisk = data.riskItems.filter((item) => item.level === 'high').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('compliance.riskCenter')}</h2>
        <button
          onClick={() => setActionNotice(t('compliance.notReady'))}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('compliance.oneClick')}
        </button>
      </div>

      {actionNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]"
        >
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-primary hover:underline whitespace-nowrap"
          >
            {t('compliance.gotIt')}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            {t('common.reload')}
          </button>
        </div>
      )}

      <div className="flex gap-2 bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'text-[#4E5969] dark:text-[#A0A4AC] hover:bg-gray-50 dark:hover:bg-[#22252D]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('compliance.policyUpdate')}</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">
            {isLoading ? '—' : data.policyUpdates.length}
          </p>
          <p className="text-caption text-danger mt-1">
            {isLoading ? t('common.loading') : `${unreadPolicy} ${t('compliance.unreadUnit')}`}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('compliance.pendingTax')}</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">
            {isLoading ? '—' : data.taxReminders.length}
          </p>
          <p className="text-caption text-danger mt-1">
            {isLoading ? t('common.loading') : `${urgentTax} ${t('compliance.urgentUnit')}`}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('compliance.riskItems')}</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">
            {isLoading ? '—' : data.riskItems.length}
          </p>
          <p className="text-caption text-danger mt-1">
            {isLoading ? t('common.loading') : `${highRisk} ${t('compliance.highRiskUnit')}`}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('compliance.score')}</p>
          <p className="text-h1 text-warning mt-1">—</p>
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-1">{t('compliance.apiNotReady')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-[#22252D] rounded" />
          ))}
        </div>
      ) : (
        <>
          {(activeTab === 'all' || activeTab === 'policy') && (
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📋 {t('compliance.policyUpdate')}</h3>
              {data.policyUpdates.length === 0 ? (
                <EmptyRow text={t('compliance.noPolicy')} />
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#2A2D35]">
                  {data.policyUpdates.map((item) => {
                    const isNew = item.status === 'new' || item.status === 'unread'
                    return (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isNew ? 'bg-danger' : 'bg-gray-200 dark:bg-[#2A2D35]'
                            }`}
                          />
                          <div>
                            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">
                              {text(item.title)}
                            </p>
                            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">
                              {text(item.effectiveDate ?? item.dueDate ?? item.source)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">
                            {text(item.category ?? item.source)}
                          </span>
                          {isNew && (
                            <span className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full">
                              {t('compliance.newTag')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'tax') && (
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">💰 {t('compliance.taxReminder')}</h3>
              {data.taxReminders.length === 0 ? (
                <EmptyRow text={t('compliance.noTax')} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.taxReminders.map((item) => (
                    <div
                      key={String(item.id)}
                      className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                          {text(item.title)}
                        </span>
                        <span
                          className={`text-caption font-medium ${
                            item.level && urgencyColor[item.level]
                              ? urgencyColor[item.level]
                              : 'text-[#4E5969] dark:text-[#A0A4AC]'
                          }`}
                        >
                          {item.level === 'high'
                            ? t('compliance.priUrgent')
                            : item.level === 'medium'
                              ? t('compliance.taxNormal')
                              : item.level === 'low'
                                ? t('compliance.taxComfortable')
                                : '—'}
                        </span>
                      </div>
                      <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mb-2">
                        {text(item.summary ?? item.source)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">
                          {t('compliance.deadline')}: {text(item.dueDate)}
                        </span>
                        <button
                          onClick={() => router.push(`/dashboard/compliance/${item.id}`)}
                          className="text-xs text-primary hover:underline"
                        >
                          {t('compliance.viewDetail')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'check') && (
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">✅ {t('compliance.complianceCheck')}</h3>
              {data.complianceChecks.length === 0 ? (
                <EmptyRow text={t('compliance.noChecks')} />
              ) : (
                <div className="space-y-3">
                  {data.complianceChecks.map((item) => {
                    const status = item.status && statusLabel[item.status] ? item.status : null
                    return (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary/60" />
                          <div>
                            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                              {text(item.title ?? item.category)}
                            </p>
                            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">
                              {text(item.summary)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-medium ${
                            status ? statusColor[status] : 'text-[#4E5969] bg-gray-100'
                          }`}
                        >
                          {status ? statusLabel[status] : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'risk') && (
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">⚠️ {t('compliance.riskList')}</h3>
              {data.riskItems.length === 0 ? (
                <EmptyRow text={t('compliance.noRisks')} />
              ) : (
                <div className="space-y-3">
                  {data.riskItems.map((item) => {
                    const level = item.level && severityLabel[item.level] ? item.level : null
                    return (
                      <div
                        key={String(item.id)}
                        className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  level ? severityColor[level] : 'text-[#4E5969] bg-gray-100'
                                }`}
                              >
                                {level ? severityLabel[level] : '—'}
                              </span>
                              <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">
                                {text(item.category ?? item.source)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mt-2">
                              {text(item.title)}
                            </p>
                            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                              {text(item.summary)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'risk') && (
            <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">💡 {t('compliance.rectification')}</h3>
              {data.suggestions.length === 0 ? (
                <EmptyRow text={t('compliance.noRectify')} />
              ) : (
                <div className="space-y-3">
                  {data.suggestions.map((item) => {
                    const key = String(item.id)
                    const processed = processedSuggestions.has(key)
                    const level = item.level && severityLabel[item.level] ? item.level : null
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              level ? severityColor[level] : 'text-[#4E5969] bg-gray-100'
                            }`}
                          >
                            {item.level === 'high'
                              ? t('compliance.priUrgent')
                              : item.level === 'medium'
                                ? t('compliance.priSuggested')
                                : t('compliance.priOptional')}
                          </span>
                          <div>
                            <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">
                              {text(item.action ?? item.title)}
                            </p>
                            <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">
                              {t('compliance.dueDate')}: {text(item.dueDate ?? item.effectiveDate)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setProcessedSuggestions((prev) => {
                              const next = new Set(prev)
                              next.add(key)
                              return next
                            })
                          }
                          className={`text-xs hover:underline whitespace-nowrap ${
                            processed ? 'text-gray-400 line-through pointer-events-none' : 'text-primary'
                          }`}
                          disabled={processed}
                        >
                          {processed ? t('compliance.processed') : t('compliance.markProcessed')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
