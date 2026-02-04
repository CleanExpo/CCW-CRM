import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { RouteProgressBar } from "@/components/transitions/RouteProgressBar";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { defaultLocale, type Locale, isValidLocale } from "@/i18n/config";

const inter = Inter({ subsets: ["latin"] });

/**
 * Get the current locale from cookies or default to English
 */
async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE");

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

export const metadata: Metadata = {
  title: "CCW ERP - Equipment Supplier",
  description: "Premium ERP system for equipment suppliers",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  other: {
    'grammarly': 'false',
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

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <I18nProvider locale={locale} messages={messages}>
          <RouteProgressBar />
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
