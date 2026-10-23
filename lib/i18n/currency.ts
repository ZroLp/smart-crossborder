import { CurrencyCode, Locale } from './index';

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.24,
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
};

const CURRENCY_LOCALE_MAP: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  const usdAmount = amount / EXCHANGE_RATES[from];
  return usdAmount * EXCHANGE_RATES[to];
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  locale?: Locale
): string {
  const resolvedLocale = locale ? CURRENCY_LOCALE_MAP[locale] : 'zh-CN';
  const formatter = new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export { EXCHANGE_RATES, CURRENCY_SYMBOLS };
