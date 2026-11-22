'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'

interface AdCampaignDetail {
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
  audience?: Record<string, unknown>
  creatives?: Array<Record<string, unknown>>
  createdAt?: string
}

interface AdSuggestion {
  id: number | string
  type?: string
  title?: string
  description?: string | null
  expectedImpact?: string | null
  action?: string | null
}

function getStatusMeta(t: (key: string) => string): Record<string, { text: string; color: string }> {
  return {
    active: { text: t('status.adRunning'), color: 'bg-success/10 text-success' },
    paused: { text: t('status.paused'), color: 'bg-warning/10 text-warning' },
    ended: { text: t('status.adFinished'), color: 'bg-gray-100 text-gray-500' },
  }
}

function asText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return '—'
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatCtr(value: unknown): string {
  const num = asNumber(value)
  if (!num) return '—'
  return `${(num <= 1 ? num * 100 : num).toFixed(2)}%`
}

function displayAudienceValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => asText(item)).join('、')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return asText(value)
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-gray-100 dark:bg-[#2A2D35] rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all duration-500 ${
          percentage > 80 ? 'bg-danger' : 'bg-primary'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default function AdCampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { t } = useTranslation()
  const statusMeta = getStatusMeta(t)
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<AdCampaignDetail | null>(null)
  const [suggestions, setSuggestions] = useState<AdSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const loadCampaign = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ad-campaigns/${encodeURIComponent(campaignId)}`, {
        credentials: 'same-origin',
      })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setError(
          body.code === 'CAMPAIGN_NOT_FOUND'
            ? t('dashboard.adNotFound')
            : body.error || t('dashboard.adFailedShort')
        )
        setCampaign(null)
        setSuggestions([])
        return
      }
      setCampaign(body.data?.campaign ?? null)
      setSuggestions(Array.isArray(body.data?.suggestions) ? body.data.suggestions : [])
    } catch {
      setError(`${t('dashboard.adNetworkError')}，${t('dashboard.adFailedShort')}`)
      setCampaign(null)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [campaignId, t])

  useEffect(() => {
    loadCampaign()
  }, [loadCampaign, reloadToken])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-[#22252D] rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#4E5969] dark:text-[#A0A4AC]">
        <span className="text-4xl mb-4">📊</span>
        <p className="text-base">{error || t('dashboard.adNotFound')}</p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => router.push('/dashboard/ad-optimizer')}
            className="text-primary text-sm hover:underline"
          >
            {t('common.backToList')}
          </button>
          {error && (
            <button
              onClick={() => setReloadToken((prev) => prev + 1)}
              className="text-primary text-sm hover:underline"
            >
              {t('common.reload')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const status = (campaign.status && statusMeta[campaign.status]) || {
    text: asText(campaign.status),
    color: 'bg-gray-100 text-gray-500',
  }
  const budget = asNumber(campaign.budget)
  const spent = asNumber(campaign.spent)
  const budgetPercentage = budget > 0 ? Math.round((spent / budget) * 100) : 0
  const audienceEntries = Object.entries(campaign.audience ?? {})
  const creatives = Array.isArray(campaign.creatives) ? campaign.creatives : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/ad-optimizer')}
            className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-[#1D2129] dark:hover:text-[#E8EAED] transition-colors"
            aria-label={t('common.backToList')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">
              {asText(campaign.name)}
            </h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">
              {asText(campaign.externalId ?? campaign.id)}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adPlatformLabel')}</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                {asText(campaign.platform)}
              </span>
            </p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adStatusLabel')}</span>
            <p
              className={`font-medium mt-1 ${status.color} px-2 py-0.5 rounded-full text-xs inline-block`}
            >
              {status.text}
            </p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('taskLogs.colCreated')}</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1 text-xs">
              {asText(campaign.createdAt)}
            </p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adOwner')}</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">—</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">💰 {t('dashboard.adBudgetSpend')}</h3>
          <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">
            ¥{spent.toLocaleString()} / ¥{budget.toLocaleString()}
          </span>
        </div>
        <ProgressBar value={spent} max={budget} />
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adBudgetUsed')}</span>
            <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">
              {budget > 0 ? `${budgetPercentage}%` : '—'}
            </p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adBudgetLeft')}</span>
            <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">
              {budget > 0 ? `¥${Math.max(budget - spent, 0).toLocaleString()}` : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adClicks')}</p>
          <p className="text-xl font-bold text-primary mt-1">
            {asNumber(campaign.clicks).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">CTR</p>
          <p
            className={`text-xl font-bold ${
              asNumber(campaign.ctr) < 0.02 ? 'text-danger' : 'text-success'
            }`}
          >
            {formatCtr(campaign.ctr)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('dashboard.adConversions')}</p>
          <p className="text-xl font-bold text-teal mt-1">
            {asNumber(campaign.conversions).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">ROAS</p>
          <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">
            {asText(campaign.roas)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">👥 {t('dashboard.adAudience')}</h3>
        {audienceEntries.length === 0 ? (
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">{t('dashboard.adNoAudience')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {audienceEntries.map(([key, value]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{key}</p>
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED] mt-1 break-all">
                  {displayAudienceValue(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🎨 {t('dashboard.adCreatives')}</h3>
        {creatives.length === 0 ? (
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">{t('dashboard.adNoCreatives')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creatives.map((creative, index) => (
              <div
                key={asText(creative.id) || index}
                className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">
                    {asText(creative.name)}
                  </span>
                  <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC] font-mono">
                    {asText(creative.id)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#4E5969] dark:text-[#A0A4AC]">
                    {t('dashboard.adTypeLabel')}: {asText(creative.type)}
                  </span>
                  <span className="text-[#4E5969] dark:text-[#A0A4AC]">
                    {t('settings.language')}: {asText(creative.language)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">💡 {t('dashboard.adAiSuggest')}</h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">{t('dashboard.adNoSuggest')}</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={String(suggestion.id)}
                className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg"
              >
                <p className="font-medium text-[#1D2129] dark:text-[#E8EAED]">
                  {asText(suggestion.title)}
                </p>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                  {asText(suggestion.description)}
                </p>
                <p className="text-xs text-success mt-2">
                  {t('dashboard.adImpact')}: {asText(suggestion.expectedImpact)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
