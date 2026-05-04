/**
 * i18n Provider Component
 *
 * Wraps the application with NextIntlClientProvider to enable translations
 * in client components.
 */

'use client';

import { NextIntlClientProvider } from 'next-intl';
import { type ReactNode } from 'react';

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  /** next-intl accepts nested JSON objects from locale files */
  messages: Record<string, unknown>;
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const safeMessages =
    messages && typeof messages === 'object' ? messages : ({} as I18nProviderProps['messages']);
  return (
    <NextIntlClientProvider locale={locale} messages={safeMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
