'use client'

import { useLocale } from '@/lib/i18n/locale-context'
import { useTheme } from '@/lib/theme/theme-context'
import type { Locale } from '@/lib/i18n'
import type { Theme } from '@/lib/theme/theme-context'

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'system', label: '跟随系统', icon: '💻' },
]

export default function SettingsDropdowns() {
  const { locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-3">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="px-2 py-1 text-xs border border-gray-200 dark:border-[#2A2D35] rounded-lg bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {LOCALE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className="px-2 py-1 text-xs border border-gray-200 dark:border-[#2A2D35] rounded-lg bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {THEME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
