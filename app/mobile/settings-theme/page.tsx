'use client'

import { useTheme, Theme } from '@/lib/theme/theme-context'
import { useTranslation } from '@/lib/i18n/use-translation'
import Link from 'next/link'

export default function MobileThemeSettingsPage() {
  const { theme, setTheme, isDark } = useTheme()
  const { t } = useTranslation()

  const currentThemeLabel = theme === 'system'
    ? (isDark ? t('mobile.dark') : t('mobile.light'))
    : (theme === 'light' ? t('mobile.light') : t('mobile.dark'))

  const themeOptions: { value: Theme; label: string; icon: string; desc: string }[] = [
    { value: 'light', label: t('mobile.light'), icon: '☀️', desc: t('mobile.lightDesc') },
    { value: 'dark', label: t('mobile.dark'), icon: '🌙', desc: t('mobile.darkDesc') },
    { value: 'system', label: t('mobile.system'), icon: '💻', desc: t('mobile.systemDesc') },
  ]

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/mobile/profile" className="text-gray-400 dark:text-[#6B7080] text-lg">‹</Link>
        <h1 className="text-lg font-semibold text-gray-600">{t('settings.themeSettings')}</h1>
      </div>

      <div className="bg-gradient-to-br from-primary/5 to-purple/5 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-[#A0A4AC]">{t('mobile.currentTheme')}</p>
            <p className="text-base font-semibold text-gray-600 mt-1">{currentThemeLabel}</p>
          </div>
          <span className="text-3xl">
            {theme === 'system' ? (isDark ? '🌙' : '☀️') : (theme === 'light' ? '☀️' : '🌙')}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-600">{t('mobile.chooseTheme')}</h3>
        </div>
        {themeOptions.map((option, index) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`w-full flex items-center justify-between px-4 py-3 ${
              index < themeOptions.length - 1 ? 'border-b border-gray-50' : ''
            } active:bg-gray-50 dark:active:bg-[#22252D]`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{option.icon}</span>
              <div className="text-left">
                <p className="text-sm text-gray-600">{option.label}</p>
                <p className="text-xs text-gray-300">{option.desc}</p>
              </div>
            </div>
            {theme === option.value && <span className="text-primary text-sm">✓</span>}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">{t('mobile.themePreview')}</h3>
        <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50 dark:bg-[#22252D]'}`}>
          <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-700' : 'bg-white dark:bg-[#181A20]'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-600'}`}>
              {t('mobile.cardTitle')}
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-400 dark:text-[#6B7080]'}`}>
              {t('mobile.previewText')}
            </p>
            <button
              className="mt-3 bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-medium cursor-default"
              disabled
            >
              {t('mobile.button')} - {theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '跟随系统'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
