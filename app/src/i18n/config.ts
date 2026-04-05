/**
 * i18n Configuration for CCW Online ERP
 *
 * Supports 10 languages with RTL support for Arabic.
 */

export const locales = [
  'en',
  'zh-CN',
  'zh-TW',
  'es',
  'pt',
  'ar',
  'vi',
  'hi',
  'ta',
  'te',
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/**
 * Language metadata for UI display
 */
export const languageConfig: Record<
  Locale,
  {
    name: string;
    nativeName: string;
    flag: string;
    isRTL: boolean;
  }
> = {
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    isRTL: false,
  },
  'zh-CN': {
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    isRTL: false,
  },
  'zh-TW': {
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    flag: '🇹🇼',
    isRTL: false,
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    isRTL: false,
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    isRTL: false,
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    isRTL: true,
  },
  vi: {
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    isRTL: false,
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    isRTL: false,
  },
  ta: {
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    isRTL: false,
  },
  te: {
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    isRTL: false,
  },
};

/**
 * Check if a locale code is valid
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
