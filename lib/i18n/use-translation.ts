'use client';

import { useCallback } from 'react';
import { useLocale } from './locale-context';
import { Locale, TranslationDict } from './index';
import zh from './locales/zh';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';

const translations: Record<Locale, TranslationDict> = { zh, en, es, fr, de };

function resolve(obj: TranslationDict, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function useTranslation() {
  const { locale } = useLocale();

  const t = useCallback(
    (key: string): string => {
      return resolve(translations[locale], key) ?? key;
    },
    [locale]
  );

  return { t, locale };
}
