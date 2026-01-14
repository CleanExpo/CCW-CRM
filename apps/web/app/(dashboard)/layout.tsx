import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { PageTransition } from "@/components/transitions/PageTransition";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
    </div>
  );
}
