'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useLocale } from '@/lib/i18n/locale-context'
import { useTheme } from '@/lib/theme/theme-context'
import { LOCALES } from '@/lib/i18n/index'

const LOCALE_LABELS: Record<string, string> = {
  zh: '简体中文',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

const TIMEZONE_LABELS: Record<string, string> = {
  'Asia/Shanghai': 'UTC+8',
  'America/New_York': 'UTC-5',
  'Europe/London': 'UTC+0',
  'Asia/Bangkok': 'UTC+7',
  'Asia/Tokyo': 'UTC+9',
  'America/Los_Angeles': 'UTC-8',
}

export default function MobileProfilePage() {
  const { t } = useTranslation()
  const { locale, timezone } = useLocale()
  const { theme, isDark } = useTheme()

  const currentLocaleLabel = LOCALE_LABELS[locale] || locale
  const currentTimezoneLabel = TIMEZONE_LABELS[timezone] || timezone
  const currentThemeLabel = theme === 'system'
    ? (isDark ? t('mobile.dark') : t('mobile.light'))
    : (theme === 'light' ? t('mobile.light') : t('mobile.dark'))

  const settings = [
    { name: t('mobile.languageSettings'), icon: '🌐', value: currentLocaleLabel, arrow: true, href: '/mobile/settings-locale' },
    { name: t('mobile.themeSettings'), icon: '🎨', value: currentThemeLabel, arrow: true, href: '/mobile/settings-theme' },
    { name: t('mobile.timezoneSettings'), icon: '🕐', value: currentTimezoneLabel, arrow: true, href: '/mobile/settings-locale' },
    { name: t('mobile.notificationSettings'), icon: '🔔', value: t('common.updated'), arrow: true },
    { name: t('mobile.apiKeys'), icon: '🔑', value: t('common.updated'), arrow: true },
    { name: t('mobile.about'), icon: 'ℹ️', value: 'v1.0.0', arrow: true },
  ]

  return (
    <div className="px-4 pt-6">
      <h1 className="text-lg font-semibold text-gray-600 mb-4">{t('mobile.profile')}</h1>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white">张</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-600">张经理</h2>
            <p className="text-sm text-gray-400 dark:text-[#6B7080]">zhang@example.com</p>
            <p className="text-xs text-gray-300 mt-1">138****8888</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600">{t('mobile.subscriptionPlan')}</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {t('settings.proPlan')}
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 dark:text-[#6B7080]">{t('mobile.aiQuota')}</span>
            <span className="text-sm text-gray-600">850 / 1000</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#22252D] rounded-full h-2">
            <div className="bg-primary rounded-full h-2" style={{ width: '85%' }}></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 dark:text-[#6B7080]">{t('mobile.storage')}</span>
            <span className="text-sm text-gray-600">12.5 GB / 50 GB</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#22252D] rounded-full h-2">
            <div className="bg-success rounded-full h-2" style={{ width: '25%' }}></div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <span className="text-sm text-gray-400 dark:text-[#6B7080]">{t('mobile.expiry')}</span>
            <span className="text-sm text-gray-600">2025年12月31日</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden mb-4">
        {settings.map((item, index) => (
          <div
            key={item.name}
            className={`flex items-center justify-between p-4 ${
              index < settings.length - 1 ? 'border-b border-gray-50' : ''
            } ${item.href ? 'cursor-pointer active:bg-gray-50 dark:active:bg-[#22252D]' : ''}`}
          >
            {item.href ? (
              <Link href={item.href} className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">{item.value}</span>
                  {item.arrow && <span className="text-gray-300 text-xs">›</span>}
                </div>
              </Link>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">{item.value}</span>
                  {item.arrow && <span className="text-gray-300 text-xs">›</span>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          document.cookie.split(';').forEach(c => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
          });
          window.location.href = '/mobile/login';
        }}
        className="w-full bg-danger/10 text-danger py-3 rounded-xl text-sm font-medium mb-8"
      >
        {t('mobile.logout')}
      </button>
    </div>
  )
}
