'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { ThemeProvider } from '@/lib/theme/theme-context';

export function ClientProviders({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('userId');
    if (stored) setUserId(stored);
  }, []);

  return (
    <ThemeProvider userId={userId}>
      <LocaleProvider userId={userId}>
        {children}
      </LocaleProvider>
    </ThemeProvider>
  );
}
