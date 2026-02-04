/**
 * i18n Provider Component
 *
 * Wraps the application with NextIntlClientProvider to enable translations
 * in client components.
 */

"use client";

import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
