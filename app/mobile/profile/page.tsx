'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useAuth } from '@/lib/auth/auth-context'
import { useApi } from '@/lib/hooks/use-api'
import { getJsonData } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card } from '@/components/MobileCard'

interface ProfileData {
  user: {
    id: number
    username: string
    email: string | null
    role: string
  }
  preferences: {
    locale: string
    timezone: string
    currency: string
  } | null
  sessions: Array<{
    id: number
    device: string
    current: boolean
    createdAt: string
  }>
}

export default function MobileProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const profile = useApi(() => getJsonData<ProfileData>('/api/profile'))

  const prefs = profile.data?.preferences ?? null
  const sessions = profile.data?.sessions ?? []

  const settingsLinks = [
    { label: t('mobile.languageSettings'), href: '/mobile/settings-locale' },
    { label: t('mobile.themeSettings'), href: '/mobile/settings-theme' },
  ]

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('mobile.profile')}</h1>
        {user ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs font-medium text-red-500 underline-offset-2 hover:underline"
          >
            {t('mobile.logout')}
          </button>
        ) : (
          <Link href="/mobile/login" className="text-xs font-medium text-primary underline">
            {t('mobile.loginNow')}
          </Link>
        )}
      </div>

      <Card>
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
              <p className="text-xs text-gray-400 dark:text-[#6B7080]">{user.role}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('mobile.notLogin')}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-[#6B7080]">{t('mobile.loginPrompt')}</p>
          </div>
        )}
      </Card>

      {user && (
        <Card title={t('mobile.profile')} right={<span className="text-xs text-gray-400">{sessions.length}</span>}>
          <MobileApiState state={profile.state} error={profile.error} onRetry={profile.retry} />
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.sessions')}</dt>
              <dd className="text-gray-900 dark:text-white">{sessions.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.language')}</dt>
              <dd className="text-gray-900 dark:text-white">{prefs?.locale ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.timezone')}</dt>
              <dd className="text-gray-900 dark:text-white">{prefs?.timezone ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.currency')}</dt>
              <dd className="text-gray-900 dark:text-white">{prefs?.currency ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card title={t('mobile.subscriptionPlan')}>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.aiQuota')}</dt>
            <dd className="text-gray-900 dark:text-white">{t('common.comingSoon')}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.storage')}</dt>
            <dd className="text-gray-900 dark:text-white">{t('common.comingSoon')}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-[#8B91A0]">{t('mobile.expiry')}</dt>
            <dd className="text-gray-900 dark:text-white">{t('common.comingSoon')}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-gray-400 dark:text-[#6B7080]">{t('mobile.quotaSoon')}</p>
      </Card>

      <Card title={t('mobile.settings')}>
        <div className="divide-y divide-gray-100 dark:divide-[#2A2D35]">
          {settingsLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between py-3 text-sm text-gray-900 hover:text-primary dark:text-white"
            >
              {link.label}
              <span className="text-gray-300 dark:text-[#6B7080]">{'>'}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
