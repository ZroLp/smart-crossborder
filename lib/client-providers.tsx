'use client';

import { type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { ThemeProvider } from '@/lib/theme/theme-context';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>{children}</LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
