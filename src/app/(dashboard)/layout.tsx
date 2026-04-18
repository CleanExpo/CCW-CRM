import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { PageTransition } from '@/components/transitions/PageTransition';
import { CommandPalette } from '@/components/ui/command-palette';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { StaffCopilotWidget } from '@/components/ai/StaffCopilotWidget';
import { ShadowModeBanner } from '@/components/layout/ShadowModeBanner';
import { DemoVideoBanner } from '@/components/dashboard/DemoVideoBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      {/* Match marketing home: dark zinc/black shell */}
      <div className="dark dashboard-app flex h-dvh min-h-0 flex-col overflow-hidden bg-gradient-to-br from-black via-zinc-950 to-black text-foreground antialiased">
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

          <ChatWidget />
          <CommandPalette />
          <StaffCopilotWidget moduleContext="general" />
        </div>
      </div>
    </WebSocketProvider>
  );
}
