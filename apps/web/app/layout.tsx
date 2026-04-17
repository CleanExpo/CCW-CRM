import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toast';
import { RouteProgressBar } from '@/components/transitions/RouteProgressBar';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { defaultLocale } from '@/i18n/config';
import { JsonLd } from '@/components/seo/JsonLd';
import enMessages from '@/i18n/messages/en.json';

const inter = Inter({ subsets: ['latin'] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UNI-1949: locale is hardcoded to defaultLocale ('en') because the app is
  // Australia-English only. Removing the server-side cookies() lookup fixes
  // a FUNCTION_INVOCATION_FAILED crash on Vercel's Lambda runtime that occurred
  // when the Root Layout was async + awaited cookies() under Next.js 16.
  // next-intl server components still resolve locale via i18n/request.ts (plugin).
  const locale = defaultLocale;
  const messages = enMessages;

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
        </I18nProvider>
        <JsonLd id="org-schema" data={[orgSchema, websiteSchema]} />
      </body>
    </html>
  );
}
