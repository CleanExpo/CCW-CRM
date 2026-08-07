import { StaffCopilotWidget } from '@/components/ai/StaffCopilotWidget';
import { DemoVideoBanner } from '@/components/dashboard/DemoVideoBanner';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ShadowModeBanner } from '@/components/layout/ShadowModeBanner';
import { Sidebar } from '@/components/layout/sidebar';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { PageTransition } from '@/components/transitions/PageTransition';
import { CommandPalette } from '@/components/ui/command-palette';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { defaultLocale, isValidLocale, type Locale } from '@/i18n/config';
import { cookies } from 'next/headers';

/**
 * Get the current locale from cookies or default to English.
 *
 * This lives here rather than in the root layout: the root layout wraps the
 * public marketing pages too, and reading cookies there makes every route in
 * the application dynamic. The dashboard is behind authentication and is
 * already rendered per-request, so the cookie read costs nothing here.
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
 * Load messages for the current locale, falling back to English.
 */
async function getMessages(locale: Locale): Promise<Record<string, unknown>> {
  const load = async (code: string): Promise<Record<string, unknown> | undefined> => {
    try {
      const mod = await import(`@/i18n/messages/${code}.json`);
      const data = mod.default;
      return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  };

  const primary = await load(locale);
  if (primary) return primary;
  const fallback = await load('en');
  return fallback ?? {};
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <WebSocketProvider>
        {/* Match marketing home: dark zinc/black shell */}
        <div className="dark dashboard-app text-foreground flex h-dvh min-h-0 flex-col overflow-hidden bg-gradient-to-br from-black via-zinc-950 to-black antialiased">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
            {/* Desktop: fixed-height rail — sidebar stays put while main scrolls */}
            <div className="relative hidden min-h-0 w-64 shrink-0 overflow-hidden border-r border-white/10 md:flex">
              <Sidebar />
            </div>

            <MobileNav />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
              <ShadowModeBanner />

              <header className="sticky top-0 z-20 hidden h-12 shrink-0 items-center justify-end border-b border-white/10 bg-zinc-950/90 px-6 backdrop-blur-md md:flex">
                <NotificationBell />
              </header>

              <main className="min-h-0 flex-1 p-4 pt-16 md:p-6 md:pt-6">
                <DemoVideoBanner />
                <PageTransition>{children}</PageTransition>
              </main>
            </div>

            <CommandPalette />
            <StaffCopilotWidget moduleContext="general" />
          </div>
        </div>
      </WebSocketProvider>
    </I18nProvider>
  );
}
