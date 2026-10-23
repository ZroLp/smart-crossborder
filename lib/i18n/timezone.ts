import { Locale } from './index';

export const DEFAULT_TIMEZONES = [
  'Asia/Shanghai',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
];

export function convertToTimezone(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1;
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function formatDate(
  date: Date | string,
  timezone: string,
  locale?: Locale
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeMap: Record<Locale, string> = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
  };
  const resolvedLocale = locale ? localeMap[locale] : 'zh-CN';
  const formatter = new Intl.DateTimeFormat(resolvedLocale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(d);
}

export function getTimezoneOffset(timezone: string): number {
  const now = new Date();
  const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
  const targetString = now.toLocaleString('en-US', { timeZone: timezone });
  const utcDate = new Date(utcString);
  const targetDate = new Date(targetString);
  return (utcDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60);
}
