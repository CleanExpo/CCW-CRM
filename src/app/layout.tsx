import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { Toaster } from '@/components/ui/toast';
import { Toaster as HotToaster } from 'react-hot-toast';
import { RouteProgressBar } from '@/components/transitions/RouteProgressBar';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { defaultLocale, type Locale, isValidLocale } from '@/i18n/config';
import { JsonLd } from '@/components/seo/JsonLd';

const inter = Inter({ subsets: ['latin'] });

/**
 * Get the current locale from cookies or default to English
 */
async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE');

  if (localeCookie?.value && isValidLocale(localeCookie.value)) {
    return localeCookie.value as Locale;
  }

  return defaultLocale;
}

/**
 * Load messages for the current locale
 */
async function getMessages(locale: Locale) {
  try {
    return (await import(`@/i18n/messages/${locale}.json`)).default;
  } catch (error) {
    // Fallback to English if locale messages not found
    return (await import(`@/i18n/messages/en.json`)).default;
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ccwonline.com.au'),
  title: {
    default: 'CCW Online | Carpet Cleaners Warehouse Australia',
    template: '%s | CCW Online',
  },
  description:
    "Australia's leading supplier of professional carpet cleaning equipment, chemicals, and restoration equipment. Shop industrial carpet cleaners, extraction machines, and IICRC training courses. Australia-wide shipping.",
  keywords: [
    'carpet cleaning equipment',
    'carpet cleaning machines',
    'commercial carpet cleaner',
    'water damage restoration equipment',
    'extraction machines',
    'carpet cleaning chemicals',
    'IICRC training',
    'CCW Online',
    'Carpet Cleaners Warehouse',
    'professional cleaning equipment',
    'truck mount carpet cleaner',
    'portable extractor',
    'mould remediation equipment',
    'cleaning equipment supplier Australia',
    'bulk cleaning chemicals Australia',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'CCW Online | Carpet Cleaners Warehouse Australia',
    description:
      "Australia's leading supplier of professional carpet cleaning equipment, chemicals, and restoration equipment.",
    url: 'https://ccwonline.com.au',
    siteName: 'CCW Online',
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CCW Online | Carpet Cleaners Warehouse Australia',
    description:
      "Australia's leading supplier of professional carpet cleaning equipment, chemicals, and restoration equipment.",
  },
  alternates: {
    canonical: 'https://ccwonline.com.au',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  other: {
    'geo.region': 'AU',
    'geo.country': 'AU',
    grammarly: 'false',
    'grammarly-extension': 'off',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages(locale);

  const orgSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': 'https://ccwonline.com.au/#organization',
    name: 'CCW Online',
    legalName: 'CCW Online Pty Ltd',
    alternateName: 'Carpet Cleaners Warehouse',
    url: 'https://ccwonline.com.au',
    logo: {
      '@type': 'ImageObject',
      url: 'https://ccwonline.com.au/logo.png',
      width: 400,
      height: 120,
    },
    description:
      "Australia's leading supplier of professional carpet cleaning equipment, chemicals, water damage restoration equipment, and IICRC-accredited training courses.",
    telephone: '+611300229273',
    email: 'sales@ccwonline.com.au',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brisbane',
      addressRegion: 'QLD',
      postalCode: '4000',
      addressCountry: 'AU',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Australia',
    },
    priceRange: '$$',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '17:00',
      },
    ],
    sameAs: [
      'https://www.facebook.com/ccwonline',
      'https://www.instagram.com/ccwonline',
      'https://www.linkedin.com/company/ccwonline',
      'https://www.youtube.com/@ccwonline',
    ],
  };

  const websiteSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://ccwonline.com.au/#website',
    url: 'https://ccwonline.com.au',
    name: 'CCW Online | Carpet Cleaners Warehouse',
    description: "Australia's leading carpet cleaning equipment supplier",
    publisher: {
      '@id': 'https://ccwonline.com.au/#organization',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://ccwonline.com.au/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <I18nProvider locale={locale} messages={messages}>
          <RouteProgressBar />
          {children}
          <Toaster />
          <HotToaster
            position="top-center"
            toastOptions={{
              duration: 4500,
              style: {
                background: 'hsl(240 6% 10%)',
                color: 'hsl(0 0% 98%)',
                border: '1px solid hsl(0 0% 100% / 0.1)',
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.45)',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#18181b' },
              },
              error: {
                iconTheme: { primary: '#f87171', secondary: '#18181b' },
              },
            }}
          />
        </I18nProvider>
        <JsonLd id="org-schema" data={[orgSchema, websiteSchema]} />
      </body>
    </html>
  );
}
