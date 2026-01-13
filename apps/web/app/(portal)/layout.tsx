import { ChatWidget } from "@/components/chat/ChatWidget";
import { DemoRequestForm } from "@/components/portal/DemoRequestForm";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

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
          <nav className="flex items-center gap-4">
            <a
              href="/portal/walk-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Walk-In
            </a>
            <a
              href="/portal/phone"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Phone Orders
            </a>
            <a
              href="/portal/internet"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Internet
            </a>
            <a
              href="/portal/service"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Service
            </a>
            <DemoRequestForm
              triggerButton={
                <Button variant="default" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Request Demo
                </Button>
              }
            />
          </nav>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1">{children}</main>

      {/* Chat widget for customer support */}
      <ChatWidget />
    </div>
  );
}
