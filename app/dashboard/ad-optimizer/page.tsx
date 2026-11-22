'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'
import { useTranslation } from '@/lib/i18n/use-translation'

interface AdCampaign {
  id: number | string
  externalId?: string
  name?: string
  platform?: string
  status?: string
  budget?: number
  spent?: number
  roas?: number
  clicks?: number
  conversions?: number
  ctr?: number
  createdAt?: string
}

interface AdSuggestion {
  id: number | string
  campaignExternalId?: string | null
  type?: string
  title?: string
  description?: string | null
  expectedImpact?: string | null
  action?: string | null
  status?: string
  createdAt?: string
}

interface AdData {
  campaigns: AdCampaign[]
  suggestions: AdSuggestion[]
}

const EMPTY_DATA: AdData = { campaigns: [], suggestions: [] }

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return '—'
}

function formatCtr(value: unknown): string {
  const num = asNumber(value)
  if (!num) return '—'
  const pct = num <= 1 ? num * 100 : num
  return `${pct.toFixed(2)}%`
}

function campaignKey(campaign: AdCampaign): string {
  return campaign.externalId || String(campaign.id)
}

function getStatusMeta(t: (key: string) => string): Record<string, { text: string; color: string }> {
  return {
    active: { text: t('status.adRunning'), color: 'bg-success/10 text-success' },
    paused: { text: t('status.paused'), color: 'bg-warning/10 text-warning' },
    ended: { text: t('status.adFinished'), color: 'bg-gray-100 text-gray-500' },
  }
}

const TYPE_ICON: Record<string, string> = {
  budget_optimization: '💰',
  audience_expansion: '👥',
  creative_refresh: '🎨',
  roas_improvement: '📈',
}

export default function AdOptimizerPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const statusMeta = getStatusMeta(t)
  const [data, setData] = useState<AdData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [processedSuggestions, setProcessedSuggestions] = useState<Set<string>>(new Set())

  const loadAdData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ad-campaigns', { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setError(body.error || t('dashboard.adLoadFailed'))
        setData(EMPTY_DATA)
        return
      }
      const raw = body.data ?? {}
      setData({
        campaigns: Array.isArray(raw.campaigns) ? raw.campaigns : [],
        suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      })
    } catch {
      setError(`${t('dashboard.adNetworkError')}，${t('dashboard.adFailedShort')}`)
      setData(EMPTY_DATA)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadAdData()
  }, [loadAdData, reloadToken])

  const campaigns = data.campaigns
  const suggestions = data.suggestions

  const {
    submit,
    pause,
    terminate,
    retry,
    displayId,
    taskId,
    taskStatus,
    steps,
    error: taskError,
    submitting,
    controlling,
    isActive,
    clearError,
  } = useAgentTask({ agentType: 'ad-optimizer' })

  const totalBudget = campaigns.reduce((sum, c) => sum + asNumber(c.budget), 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + asNumber(c.spent), 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const avgRoas =
    activeCampaigns.length > 0
      ? activeCampaigns.reduce((sum, c) => sum + asNumber(c.roas), 0) / activeCampaigns.length
      : 0
  const totalClicks = campaigns.reduce((sum, c) => sum + asNumber(c.clicks), 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + asNumber(c.conversions), 0)

  const platforms = Array.from(
    new Set(campaigns.map((c) => c.platform).filter((p): p is string => Boolean(p)))
  )

  const filteredCampaigns = campaigns.filter((c) => {
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  const handleAnalyze = async () => {
    await submit({
      adData: {
        campaigns: campaigns.map((c) => ({
          id: campaignKey(c),
          platform: c.platform ?? 'unknown',
          spend: asNumber(c.spent),
          impressions: 0,
          clicks: asNumber(c.clicks),
          conversions: asNumber(c.conversions),
          revenue: Math.round(asNumber(c.spent) * asNumber(c.roas)),
        })),
      },
    })
  }

  const visibleSuggestions = suggestions.filter(
    (s) => !processedSuggestions.has(String(s.id))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('dashboard.adSmartTitle')}</h2>
        <button
          onClick={handleAnalyze}
          disabled={submitting || campaigns.length === 0}
          className="bg-primary/10 text-primary px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('dashboard.adAnalyzing') : t('dashboard.adOptimize')}
        </button>
      </div>

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

      {taskError && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{taskError}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label={t('common.closeError')}
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <div className="h-3 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-[#2A2D35] rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adTotalBudget')}</p>
            <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">
              {campaigns.length > 0 ? `¥${totalBudget.toLocaleString()}` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adSpend')}</p>
            <p className="text-xl font-bold text-warning mt-1">
              {campaigns.length > 0 ? `¥${totalSpent.toLocaleString()}` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adAvgRoas')}</p>
            <p
              className={`text-xl font-bold ${avgRoas < 4 ? 'text-danger' : 'text-success'}`}
            >
              {activeCampaigns.length > 0 ? avgRoas.toFixed(1) : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adClicks')}</p>
            <p className="text-xl font-bold text-primary mt-1">
              {campaigns.length > 0 ? totalClicks.toLocaleString() : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adConversions')}</p>
            <p className="text-xl font-bold text-teal mt-1">
              {campaigns.length > 0 ? totalConversions : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adPlatformFilter')}</label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
          >
            <option value="all">{t('dashboard.adAllPlatforms')}</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adStatusFilter')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
          >
            <option value="all">{t('dashboard.adAllStatuses')}</option>
            <option value="active">{t('status.adRunning')}</option>
            <option value="paused">{t('status.paused')}</option>
            <option value="ended">{t('status.adFinished')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35]">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('dashboard.adCampaignList')}</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('common.loading')}</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#4E5969] dark:text-[#A0A4AC]">
            {t('dashboard.adNoCampaigns')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColId')}</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColName')}</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColPlatform')}</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColStatus')}</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColBudget')}</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColSpend')}</th>
                  <th className="px-6 py-3 font-medium">ROAS</th>
                  <th className="px-6 py-3 font-medium">CTR</th>
                  <th className="px-6 py-3 font-medium">{t('dashboard.adColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
                {filteredCampaigns.map((c) => {
                  const key = campaignKey(c)
                  const status = (c.status && statusMeta[c.status]) || {
                    text: asText(c.status),
                    color: 'bg-gray-100 text-gray-500',
                  }
                  return (
                    <tr
                      key={key}
                      className="hover:bg-gray-50 dark:hover:bg-[#22252D] transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-[#4E5969] dark:text-[#A0A4AC]">
                        {key}
                      </td>
                      <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">
                        {asText(c.name)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {asText(c.platform)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">
                        ¥{asNumber(c.budget).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">
                        ¥{asNumber(c.spent).toLocaleString()}
                      </td>
                      <td
                        className={`px-6 py-4 font-medium ${
                          asNumber(c.roas) < 4 ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {asText(c.roas)}
                      </td>
                      <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">
                        {formatCtr(c.ctr)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/dashboard/ad-optimizer/${key}`)}
                          className="text-[#4E5969] dark:text-[#A0A4AC] text-xs hover:underline"
                        >
                          {t('dashboard.adDetail')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">{t('dashboard.adAiSuggest')}</h3>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-center text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4">{t('common.loading')}</p>
          ) : visibleSuggestions.length === 0 ? (
            <p className="text-center text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4">
              {t('dashboard.adNoSuggest')}
            </p>
          ) : (
            visibleSuggestions.map((s) => {
              const key = String(s.id)
              return (
                <div key={key} className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {TYPE_ICON[s.type ?? ''] ?? '📌'}
                      </span>
                      <div>
                        <h4 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">
                          {asText(s.title)}
                        </h4>
                        <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                          {asText(s.description)}
                        </p>
                        <p className="text-xs text-success mt-2">
                          {t('dashboard.adImpact')}: {asText(s.expectedImpact)}
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
                      className="bg-primary text-white text-xs px-3 py-1 rounded-lg hover:opacity-90 whitespace-nowrap"
                    >
                      {asText(s.action)}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {isActive && (displayId || taskId) && (
        <AIStepProgress
          taskId={(displayId || taskId) as string}
          steps={steps}
          taskStatus={taskStatus}
          errorMessage={taskError}
          busy={controlling}
          onPause={pause}
          onTerminate={terminate}
          onRetry={retry}
          onDismissError={clearError}
        />
      )}
    </div>
  )
}
