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

interface PlatformConnection {
  platform: string
  connected: boolean
  connectedAt: string | null
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

const PLATFORM_OPTIONS = ['facebook', 'google', 'tiktok']

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
  const [showNewForm, setShowNewForm] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', platform: 'facebook', budget: '' })
  const [platformConnections, setPlatformConnections] = useState<PlatformConnection[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [adToast, setAdToast] = useState<string | null>(null)

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

  const loadPlatforms = useCallback(async () => {
    try {
      const res = await fetch('/api/ad-platforms', { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok && body.success === true) {
        const raw = body.data
        setPlatformConnections(Array.isArray(raw) ? raw : [])
      }
    } catch {
      // 平台连接状态加载失败不阻塞主流程
    }
  }, [])

  useEffect(() => {
    loadPlatforms()
  }, [loadPlatforms])

  useEffect(() => {
    loadAdData()
  }, [loadAdData, reloadToken])

  const showToast = useCallback((message: string) => {
    setAdToast(message)
    window.setTimeout(() => setAdToast(null), 3000)
  }, [])

  const refreshAll = useCallback(() => {
    setReloadToken((prev) => prev + 1)
    loadPlatforms()
  }, [loadPlatforms])

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

  const handleCreateCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.budget) return
    setIsBusy(true)
    try {
      const res = await fetch('/api/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: newCampaign.name.trim(),
          platform: newCampaign.platform,
          budget: Number(newCampaign.budget),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        setShowNewForm(false)
        setNewCampaign({ name: '', platform: 'facebook', budget: '' })
        showToast(t('dashboard.adCreateSuccess'))
        refreshAll()
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleToggleStatus = async (campaign: AdCampaign) => {
    const key = campaignKey(campaign)
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active'
    setIsBusy(true)
    try {
      const res = await fetch(`/api/ad-campaigns/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        setData((prev) => ({
          ...prev,
          campaigns: prev.campaigns.map((c) =>
            campaignKey(c) === key ? { ...c, status: nextStatus } : c
          ),
        }))
        showToast(t('dashboard.adToggleSuccess'))
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleDeleteCampaign = async (campaign: AdCampaign) => {
    if (!confirm(t('dashboard.adDeleteConfirm'))) return
    const key = campaignKey(campaign)
    setIsBusy(true)
    try {
      const res = await fetch(`/api/ad-campaigns/${key}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        setData((prev) => ({
          ...prev,
          campaigns: prev.campaigns.filter((c) => campaignKey(c) !== key),
        }))
        showToast(t('dashboard.adDeleteSuccess'))
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleSyncCampaign = async (campaign: AdCampaign) => {
    const key = campaignKey(campaign)
    setIsBusy(true)
    try {
      const res = await fetch(`/api/ad-campaigns/${key}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        showToast(t('dashboard.adSyncSuccess'))
      } else {
        showToast(t('dashboard.adSyncError'))
      }
    } catch {
      showToast(t('dashboard.adSyncError'))
    } finally {
      setIsBusy(false)
    }
  }

  const handleSuggestion = async (suggestion: AdSuggestion, status: 'accepted' | 'rejected') => {
    setIsBusy(true)
    try {
      const res = await fetch(`/api/ad-suggestions/${suggestion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        setData((prev) => ({
          ...prev,
          suggestions: prev.suggestions.map((s) =>
            String(s.id) === String(suggestion.id) ? { ...s, status } : s
          ),
        }))
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handlePlatformToggle = async (platform: string, connected: boolean) => {
    setIsBusy(true)
    try {
      const res = await fetch('/api/ad-platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ platform, action: connected ? 'disconnect' : 'connect' }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success === true) {
        const next = body.data?.connected === undefined ? !connected : body.data.connected
        setPlatformConnections((prev) =>
          prev.map((p) =>
            p.platform === platform ? { ...p, connected: next } : p
          )
        )
        showToast(next ? t('dashboard.adPlatformConnected') : t('dashboard.adPlatformDisconnected'))
      }
    } finally {
      setIsBusy(false)
    }
  }

  const isPlatformConnected = (platform?: string) => {
    if (!platform) return false
    const found = platformConnections.find((p) => p.platform === platform)
    return found ? found.connected : true
  }

  const displayPlatforms = PLATFORM_OPTIONS.every((opt) =>
    platformConnections.some((p) => p.platform === opt)
  )
    ? platformConnections
    : PLATFORM_OPTIONS.map((opt) => {
        const found = platformConnections.find((p) => p.platform === opt)
        return found ?? { platform: opt, connected: false, connectedAt: null }
      })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('dashboard.adSmartTitle')}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewForm((prev) => !prev)}
            className="border border-primary/30 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            {t('dashboard.adNew')}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={submitting || campaigns.length === 0}
            className="bg-primary/10 text-primary px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('dashboard.adAnalyzing') : t('dashboard.adOptimize')}
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 border border-primary/20">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3">
            {t('dashboard.adCreate')}
          </h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">
                {t('dashboard.adName')}
              </label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('dashboard.adNamePlaceholder')}
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED] w-48"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">
                {t('dashboard.adPlatformSelect')}
              </label>
              <select
                value={newCampaign.platform}
                onChange={(e) =>
                  setNewCampaign((prev) => ({ ...prev, platform: e.target.value }))
                }
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">
                {t('dashboard.adBudgetInput')}
              </label>
              <input
                type="number"
                min="0"
                value={newCampaign.budget}
                onChange={(e) => setNewCampaign((prev) => ({ ...prev, budget: e.target.value }))}
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED] w-32"
              />
            </div>
            <button
              onClick={handleCreateCampaign}
              disabled={isBusy || !newCampaign.name.trim() || !newCampaign.budget}
              className="bg-primary text-white text-xs px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('dashboard.adSubmit')}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-xs px-4 py-2 rounded-lg text-[#4E5969] dark:text-[#A0A4AC] hover:bg-gray-100 dark:hover:bg-[#2A2D35]"
            >
              {t('dashboard.adCancel')}
            </button>
          </div>
        </div>
      )}

      {adToast && (
        <div
          role="status"
          className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success"
        >
          {adToast}
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

      <div className="grid grid-cols-3 gap-4">
        {displayPlatforms.map((p) => (
          <div
            key={p.platform}
            className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium capitalize text-[#1D2129] dark:text-[#E8EAED]">
                {p.platform}
              </p>
              <p className="text-xs mt-1">
                {p.connected ? (
                  <span className="text-success">{t('dashboard.adPlatformConnected')}</span>
                ) : (
                  <span className="text-[#4E5969] dark:text-[#A0A4AC]">
                    {t('dashboard.adPlatformDisconnected')}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => handlePlatformToggle(p.platform, p.connected)}
              disabled={isBusy}
              className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                p.connected
                  ? 'border border-gray-200 dark:border-[#2A2D35] text-[#4E5969] dark:text-[#A0A4AC] hover:bg-gray-100 dark:hover:bg-[#2A2D35]'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {p.connected
                ? t('dashboard.adDisconnectPlatform')
                : t('dashboard.adConnectPlatform')}
            </button>
          </div>
        ))}
      </div>

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
                  const syncDisabled = !isPlatformConnected(c.platform)
                  const canToggle = c.status === 'active' || c.status === 'paused'
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
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => router.push(`/dashboard/ad-optimizer/${key}`)}
                            className="text-[#4E5969] dark:text-[#A0A4AC] text-xs hover:underline"
                          >
                            {t('dashboard.adDetail')}
                          </button>
                          {canToggle && (
                            <button
                              onClick={() => handleToggleStatus(c)}
                              disabled={isBusy}
                              className="text-warning text-xs hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {c.status === 'active'
                                ? t('dashboard.adPause')
                                : t('dashboard.adResume')}
                            </button>
                          )}
                          <button
                            onClick={() => handleSyncCampaign(c)}
                            disabled={isBusy || syncDisabled}
                            title={syncDisabled ? t('dashboard.adPlatformNotConnected') : undefined}
                            className="text-primary text-xs hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t('dashboard.adSync')}
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(c)}
                            disabled={isBusy}
                            className="text-danger text-xs hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t('dashboard.adDelete')}
                          </button>
                        </div>
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
          ) : suggestions.length === 0 ? (
            <p className="text-center text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4">
              {t('dashboard.adNoSuggest')}
            </p>
          ) : (
            suggestions.map((s) => {
              const key = String(s.id)
              const pending = s.status === 'pending' || !s.status
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
                    {pending ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSuggestion(s, 'accepted')}
                          disabled={isBusy}
                          className="bg-primary text-white text-xs px-3 py-1 rounded-lg hover:opacity-90 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('dashboard.adAdopt')}
                        </button>
                        <button
                          onClick={() => handleSuggestion(s, 'rejected')}
                          disabled={isBusy}
                          className="border border-gray-200 dark:border-[#2A2D35] text-[#4E5969] dark:text-[#A0A4AC] text-xs px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2D35] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('dashboard.adReject')}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          s.status === 'accepted'
                            ? 'bg-success/10 text-success'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.status === 'accepted'
                          ? t('dashboard.adAdopted')
                          : t('dashboard.adRejected')}
                      </span>
                    )}
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
