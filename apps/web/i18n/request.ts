/**
 * i18n Request Configuration
 *
 * Provides configuration for server components to access translations.
 *
 * Note: This app uses cookie-based locale resolution (via the `NEXT_LOCALE`
 * cookie read in `app/layout.tsx`). It does NOT use a `[locale]` URL segment,
 * so `requestLocale` is typically undefined. We fall back to `defaultLocale`
 * rather than calling `notFound()` — the layout already handles the real
 * locale selection via cookies.
 *
 * Updated for next-intl 4.x + Next.js 16 — uses `requestLocale` (a Promise)
 * instead of the legacy `locale` parameter.
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (requested && locales.includes(requested as Locale)
    ? requested
    : defaultLocale) as Locale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
