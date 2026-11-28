'use client'

import { useLocale } from '@/lib/i18n/locale-context'
import { useTheme } from '@/lib/theme/theme-context'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { Locale } from '@/lib/i18n'
import type { Theme } from '@/lib/theme/theme-context'

export default function SettingsDropdowns() {
  const { locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const localeOptions: { value: Locale; label: string }[] = [
    { value: 'zh', label: t('settings.localeZh') },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
  ]

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('theme.lightMode'), icon: '☀️' },
    { value: 'dark', label: t('theme.darkMode'), icon: '🌙' },
    { value: 'system', label: t('theme.followSystem'), icon: '💻' },
  ]

  return (
    <div className="flex items-center gap-3">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('settings.intlSettings')}
        className="px-2 py-1 text-xs border border-gray-200 dark:border-[#2A2D35] rounded-lg bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {localeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        aria-label={t('settings.themeSettings')}
        className="px-2 py-1 text-xs border border-gray-200 dark:border-[#2A2D35] rounded-lg bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {themeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
