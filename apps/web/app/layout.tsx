/**
 * BISECT STUB — Phase 2h-C diagnostic (UNI-1949)
 *
 * Previous results:
 *   Phase 2g (pure stub)        → 200 ✅
 *   Phase 2h-A (full Group A)   → 500 ❌
 *   Phase 2h-B (Inter+metadata) → 200 ✅
 *
 * This test: add cookies() back on top of 2h-B (still no globals.css).
 *
 * If 200 → cookies is safe → globals.css is the culprit
 * If 500 → cookies() is the culprit
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';

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
  description: 'Phase 2h-C bisect',
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
