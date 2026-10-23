'use client'

import { useLocale } from '@/lib/i18n/locale-context'
import { Locale, LOCALES, CURRENCIES } from '@/lib/i18n/index'
import { useTranslation } from '@/lib/i18n/use-translation'

const LOCALE_LABELS: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '上海 (UTC+8)' },
  { value: 'America/New_York', label: '纽约 (UTC-5)' },
  { value: 'Europe/London', label: '伦敦 (UTC+0)' },
  { value: 'Asia/Bangkok', label: '曼谷 (UTC+7)' },
  { value: 'Asia/Tokyo', label: '东京 (UTC+9)' },
  { value: 'America/Los_Angeles', label: '洛杉矶 (UTC-8)' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CNY', label: 'CNY (¥)' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function MobileLocaleSettingsPage() {
  const { locale, setLocale, timezone, setTimezone, currency, setCurrency } = useLocale()
  const { t } = useTranslation()

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-lg font-semibold text-gray-600 mb-4">{t('settings.intlSettings')}</h1>

      <Section title={t('settings.language')}>
        {LOCALES.map((l, index) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`w-full flex items-center justify-between px-4 py-3 ${
              index < LOCALES.length - 1 ? 'border-b border-gray-50' : ''
            } active:bg-gray-50 dark:active:bg-[#22252D]`}
          >
            <span className="text-sm text-gray-600">{LOCALE_LABELS[l]}</span>
            {locale === l && <span className="text-primary text-sm">✓</span>}
          </button>
        ))}
      </Section>

      <Section title={t('settings.timezone')}>
        {TIMEZONE_OPTIONS.map((tz, index) => (
          <button
            key={tz.value}
            onClick={() => setTimezone(tz.value)}
            className={`w-full flex items-center justify-between px-4 py-3 ${
              index < TIMEZONE_OPTIONS.length - 1 ? 'border-b border-gray-50' : ''
            } active:bg-gray-50 dark:active:bg-[#22252D]`}
          >
            <span className="text-sm text-gray-600">{tz.label}</span>
            {timezone === tz.value && <span className="text-primary text-sm">✓</span>}
          </button>
        ))}
      </Section>

      <Section title={t('settings.currency')}>
        {CURRENCY_OPTIONS.map((c, index) => (
          <button
            key={c.value}
            onClick={() => setCurrency(c.value as typeof CURRENCIES[number])}
            className={`w-full flex items-center justify-between px-4 py-3 ${
              index < CURRENCY_OPTIONS.length - 1 ? 'border-b border-gray-50' : ''
            } active:bg-gray-50 dark:active:bg-[#22252D]`}
          >
            <span className="text-sm text-gray-600">{c.label}</span>
            {currency === c.value && <span className="text-primary text-sm">✓</span>}
          </button>
        ))}
      </Section>
    </div>
  )
}
