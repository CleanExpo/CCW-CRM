/**
 * BISECT STUB — Phase 2h Group A diagnostic (UNI-1949)
 *
 * Restores infrastructure-level imports on top of the Phase 2g baseline:
 *   1. next/font/google (Inter) at module scope
 *   2. './globals.css' side-effect import
 *   3. cookies() from next/headers inside async getLocale
 *   4. Metadata + Viewport types + metadataBase URL
 *
 * Deliberately EXCLUDED (saved for Group B):
 *   - Toaster, RouteProgressBar, I18nProvider, JsonLd wrappers
 *   - @/i18n/config (so cookies read is self-contained)
 *
 * If this deploy returns 200 → issue lives in Group B components.
 * If this deploy returns 500 → issue lives in one of the 4 items above.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

async function getLocale(): Promise<string> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE');
  return localeCookie?.value || 'en';
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ccwonline.com.au'),
  title: 'CCW Online',
  description: 'Phase 2h bisect — Group A diagnostic',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
