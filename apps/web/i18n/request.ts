/**
 * i18n Request Configuration
 *
 * Provides configuration for server components to access translations.
 */

import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {locales, type Locale} from './config';

export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
