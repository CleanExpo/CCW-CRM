"use client";

// Force dynamic rendering for all dashboard pages
export const dynamic = 'force-dynamic';

import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { PageTransition } from "@/components/transitions/PageTransition";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { useSequentialShortcuts } from "@/hooks/use-sequential-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts/KeyboardShortcutsHelp";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize sequential keyboard shortcuts (G+O, C+P, etc.)
  useSequentialShortcuts();

  return (
    <WebSocketProvider>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Navigation */}
        <MobileNav />

        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>

        <ChatWidget />

        {/* Command Palette (Cmd+K / Ctrl+K) */}
        <CommandPalette />

        {/* Keyboard Shortcuts Help (?) */}
        <KeyboardShortcutsHelp />
      </div>
    </WebSocketProvider>
  );
}
