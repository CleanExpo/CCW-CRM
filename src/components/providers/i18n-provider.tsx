/**
 * i18n Provider Component
 *
 * Prefer using `NextIntlClientProvider` directly from a Server Component layout
 * (see `src/app/layout.tsx`). This wrapper remains for legacy call sites.
 *
 * Do not import `NextIntlClientProvider` into client wrappers unless necessary —
 * next-intl's package exports can resolve the async Server Component version into
 * the client graph, which surfaces as:
 * "Element type is invalid. Received a promise that resolves to: undefined".
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
