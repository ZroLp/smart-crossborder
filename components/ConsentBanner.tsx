'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'

interface ConsentRecord {
  purpose: string
  consented: boolean
}

/**
 * P7-01 阻断式同意横幅：未同意 analytics 时展示，同意/拒绝后写回 /api/consent。
 * 「未同意零非必要脚本」——未同意前不应加载任何非必要第三方脚本。
 */
export default function ConsentBanner() {
  const { t } = useTranslation()
  const [state, setState] = useState<'loading' | 'hidden' | 'shown'>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/consent', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return
        const records: ConsentRecord[] = ((data as { data?: { records?: ConsentRecord[] } })?.data?.records ?? [])
        const analytics = records.find((record) => record.purpose === 'analytics')
        setState(analytics?.consented ? 'hidden' : 'shown')
      })
      .catch(() => {
        // 读取失败按「未同意」处理（安全默认：展示横幅而非静默放行）
        if (!cancelled) setState('shown')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function respond(consented: boolean) {
    setSubmitting(true)
    try {
      await fetch('/api/consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'analytics', consented }),
      })
      setState('hidden')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'loading' || state === 'hidden') return null

  return (
    <div
      data-testid="consent-banner"
      role="dialog"
      aria-label={t('dashboard.consentBanner')}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]"
    >
      <p className="flex-1 min-w-[200px]">{t('dashboard.consentBanner')}</p>
      <div className="flex gap-2">
        <button
          onClick={() => void respond(true)}
          disabled={submitting}
          className="bg-primary text-white px-4 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {t('dashboard.consentAccept')}
        </button>
        <button
          onClick={() => void respond(false)}
          disabled={submitting}
          className="border border-[#4E5969] text-[#4E5969] dark:text-[#A0A4AC] px-4 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {t('dashboard.consentDecline')}
        </button>
      </div>
    </div>
  )
}
