'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Locale, CurrencyCode } from './index';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  userId: string | null;
  loading: boolean;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'zh',
  setLocale: () => {},
  timezone: 'Asia/Shanghai',
  setTimezone: () => {},
  currency: 'USD',
  setCurrency: () => {},
  userId: null,
  loading: true,
});

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

interface LocaleProviderProps {
  children: ReactNode;
  userId: string | null;
}

export function LocaleProvider({ children, userId }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [timezone, setTimezoneState] = useState<string>('Asia/Shanghai');
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetch(`/api/user-preferences?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.preferences) {
          if (data.preferences.locale) setLocaleState(data.preferences.locale as Locale);
          if (data.preferences.timezone) setTimezoneState(data.preferences.timezone);
          if (data.preferences.currency) setCurrencyState(data.preferences.currency as CurrencyCode);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const persistPreference = useCallback(
    async (field: string, value: string) => {
      if (!userId) return;
      try {
        await fetch('/api/user-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, [field]: value }),
        });
      } catch {
      }
    },
    [userId]
  );

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      persistPreference('locale', newLocale);
    },
    [persistPreference]
  );

  const setTimezone = useCallback(
    (newTimezone: string) => {
      setTimezoneState(newTimezone);
      persistPreference('timezone', newTimezone);
    },
    [persistPreference]
  );

  const setCurrency = useCallback(
    (newCurrency: CurrencyCode) => {
      setCurrencyState(newCurrency);
      persistPreference('currency', newCurrency);
    },
    [persistPreference]
  );

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, timezone, setTimezone, currency, setCurrency, userId, loading }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
