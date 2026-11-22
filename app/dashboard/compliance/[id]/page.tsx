'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'

export default function ComplianceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const id = params.id as string

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/compliance')}
          className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-primary transition-colors"
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('compliance.detailTitle')}</h2>
      </div>

      <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#181A20] rounded-xl shadow-sm">
        <span className="text-4xl mb-4">🛡️</span>
        <p className="text-base text-[#4E5969] dark:text-[#A0A4AC]">
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
  )
}
