'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'

export default function ForbiddenPage() {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0F1117]">
      <div className="text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">{t('permission.forbiddenTitle')}</h1>
        <p className="text-[#4E5969] dark:text-[#A0A4AC] mb-6">{t('permission.forbiddenHint')}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  )
}
