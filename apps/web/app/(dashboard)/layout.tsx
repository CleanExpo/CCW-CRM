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
      <div className="flex min-h-screen">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Navigation */}
        <MobileNav />

        <div className="flex flex-1 flex-col">
          {/* Shadow Mode Banner — shown when shadow observation is active */}
          <ShadowModeBanner />

          {/* Desktop top bar with notification bell */}
          <header className="hidden h-12 shrink-0 items-center justify-end border-b px-6 md:flex">
            <NotificationBell />
          </header>

          <main className="flex-1 p-4 pt-16 md:p-6 md:pt-6">
            <DemoVideoBanner />
            <PageTransition>{children}</PageTransition>
          </main>
        </div>

        <ChatWidget />
        <CommandPalette />
        <StaffCopilotWidget moduleContext="general" />
      </div>
    </WebSocketProvider>
  );
}
