'use client'

import { usePathname, useRouter } from 'next/navigation'
import SettingsDropdowns from '@/components/SettingsDropdowns'
import { useAuth } from '@/lib/auth/auth-context'
import { useTranslation } from '@/lib/i18n/use-translation'

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t } = useTranslation()

  const pageTitles: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/dashboard/selection': t('selection.title'),
    '/dashboard/store-builder': t('nav.storeBuilder'),
    '/dashboard/content': t('contentStudio.title'),
    '/dashboard/ad-optimizer': t('nav.adOptimizer'),
    '/dashboard/customer-service': t('nav.customerService'),
    '/dashboard/fulfillment': t('nav.fulfillment'),
    '/dashboard/data-center': t('nav.dataCenter'),
    '/dashboard/settings': t('nav.settings'),
    '/dashboard/compliance': t('nav.compliance'),
    '/dashboard/task-logs': t('nav.taskLogs'),
  }

  const title = pageTitles[pathname] || t('nav.dashboard')

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="h-[60px] bg-white dark:bg-[#181A20] border-b border-gray-200 dark:border-[#2A2D35] px-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{title}</h1>
      <div className="flex items-center gap-4">
        <SettingsDropdowns />
        <button
          className="relative p-2 text-gray-500 dark:text-[#A0A4AC] hover:text-gray-700 dark:hover:text-[#E8EAED]"
          aria-label={t('common.notifications')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-[#4E5969] dark:text-[#A0A4AC] hover:text-primary transition-colors"
          title={t('settings.logout')}
        >
          <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-medium">
            {user?.username?.slice(0, 1).toUpperCase() || 'U'}
          </span>
          <span className="hidden md:inline">{t('common.signOut')}</span>
        </button>
      </div>
    </header>
  )
}
