import { JsonLd } from '@/components/seo/JsonLd';
import { RouteProgressBar } from '@/components/transitions/RouteProgressBar';
import { Toaster } from '@/components/ui/toast';
import { defaultLocale } from '@/i18n/config';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster as HotToaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

/**
 * This layout must not read cookies(), headers() or any other dynamic API.
 *
 * The root layout wraps every route, so a single dynamic read here opts the
 * whole application out of static rendering — including the public marketing
 * pages, which are then served `no-store` and are never edge-cached. Locale is
 * resolved in `(dashboard)/layout.tsx` instead, where the route is already
 * dynamic because it is behind authentication.
 */

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
    apple: [{ url: '/brand/ccw-logo-mark.svg', type: 'image/svg+xml' }],
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
      url: 'https://ccwonline.com.au/brand/ccw-logo-mark.svg',
      width: 40,
      height: 40,
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
    <html lang={defaultLocale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
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
        <JsonLd id="org-schema" data={[orgSchema, websiteSchema]} />
      </body>
    </html>
  );
}
