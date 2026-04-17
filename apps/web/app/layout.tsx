/**
 * BISECT STUB — Phase 2h-B diagnostic (UNI-1949)
 *
 * Previous result:
 *   Phase 2g (pure stub)        → 200 ✅
 *   Phase 2h-A (full Group A)   → 500 ❌
 *
 * This test: stub + Inter font + metadata/Viewport (no cookies, no globals.css).
 *
 * If 200 → crash is in cookies() or globals.css
 * If 500 → crash is in Inter font or metadataBase URL
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ccwonline.com.au'),
  title: 'CCW Online',
  description: 'Phase 2h-B bisect',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
