import { ChatWidget } from "@/components/chat/ChatWidget";
import { PortalNav } from "@/components/portal/PortalNav";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Simple header bar */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">CCW Equipment</h1>
          </div>
          <PortalNav />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1">{children}</main>

      {/* Chat widget for customer support */}
      <ChatWidget />
    </div>
  );
}
