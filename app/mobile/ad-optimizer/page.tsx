'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJsonData } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge } from '@/components/MobileCard'

interface MobileAdCampaign {
  id: number
  externalId: string
  name: string
  platform: string
  status: string
  budget: number
  spent: number
  roas: number
  clicks: number
  conversions: number
  ctr: number
}

interface MobileAdSuggestion {
  id: number
  campaignExternalId: string
  type: string
  title: string
  description: string
  expectedImpact: string
  status: string
}

export default function MobileAdOptimizerPage() {
  const { t } = useTranslation()
  const ads = useApi(() =>
    getJsonData<{ campaigns: MobileAdCampaign[]; suggestions: MobileAdSuggestion[] }>('/api/ad-campaigns')
  )

  const campaigns = ads.data?.campaigns ?? []
  const suggestions = ads.data?.suggestions ?? []

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t('mobile.adCampaigns')}</h1>

      <MobileApiState state={ads.state} error={ads.error} onRetry={ads.retry} emptyTitle={t('mobile.adEmpty')} emptyHint={t('mobile.adHint')} />
      {ads.state === 'success' && campaigns.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center dark:border-[#2A2D35]">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('mobile.adEmpty')}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-[#6B7080]">{t('mobile.adHint')}</p>
        </div>
      )}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                <p className="text-xs text-gray-400 dark:text-[#6B7080]">{c.platform}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={c.status} label={c.status} />
                <button
                  type="button"
                  disabled
                  title={t('mobile.adToggleSoon')}
                  aria-label={t('mobile.adToggleSoon')}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-400 dark:border-[#2A2D35]"
                >
                  &#x23FB;
                </button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[11px] text-gray-400 dark:text-[#6B7080]">{t('dashboard.adROAS')}</dt>
                <dd className="text-sm font-semibold text-gray-900 dark:text-white">{c.roas.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-400 dark:text-[#6B7080]">CTR</dt>
                <dd className="text-sm font-semibold text-gray-900 dark:text-white">{(c.ctr * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-400 dark:text-[#6B7080]">Spend / Budget</dt>
                <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                  {c.spent.toFixed(0)} / {c.budget.toFixed(0)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-[#6B7080]">{t('mobile.adToggleSoon')}</p>
          </Card>
        ))}
      </div>

      {suggestions.length > 0 && (
        <Card title={t('compliance.rectification')} right={<span className="text-xs text-gray-400">{suggestions.length}</span>}>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-gray-900 dark:text-white">{s.title}</p>
                  <StatusBadge status={s.status} label={s.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-[#8B91A0]">{s.description}</p>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-[#6B7080]">{s.expectedImpact}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
