export type Locale = 'zh' | 'en' | 'es' | 'fr' | 'de';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CNY';

export interface I18nConfig {
  locale: Locale;
  timezone: string;
  currency: CurrencyCode;
}

export type TranslationDict = Record<string, string | Record<string, string>>;

export const LOCALES: Locale[] = ['zh', 'en', 'es', 'fr', 'de'];

export const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CNY'];

export const DEFAULT_TIMEZONES = [
  'Asia/Shanghai',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
];

const LOCALE_TIMEZONE_MAP: Record<Locale, string> = {
  zh: 'Asia/Shanghai',
  en: 'America/New_York',
  es: 'Europe/Madrid',
  fr: 'Europe/Paris',
  de: 'Europe/Berlin',
};

const LOCALE_CURRENCY_MAP: Record<Locale, CurrencyCode> = {
  zh: 'CNY',
  en: 'USD',
  es: 'EUR',
  fr: 'EUR',
  de: 'EUR',
};

export function getI18nConfig(locale?: Locale): I18nConfig {
  const resolvedLocale = locale ?? 'zh';
  return {
    locale: resolvedLocale,
    timezone: LOCALE_TIMEZONE_MAP[resolvedLocale],
    currency: LOCALE_CURRENCY_MAP[resolvedLocale],
  };
}
