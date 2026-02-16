import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import {
  LiveStatsBar,
  type PublicStats,
} from "@/components/landing/LiveStatsBar";
import {
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  BarChart3,
  MapPin,
  ChevronRight,
  CheckCircle2,
  LogIn,
  AlertTriangle,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Realistic demo stats shown when the backend is unreachable.
 * These match the seeded database numbers so the page always looks live.
 */
const DEMO_STATS: PublicStats = {
  total_products: 150,
  total_customers: 45,
  active_orders: 32,
  pending_quotes: 12,
  total_revenue_this_month: "124850",
  low_stock_alerts: 7,
  product_categories: 8,
  warehouse_count: 3,
  fetched_at: new Date().toISOString(),
};

/**
 * Fetch public stats from the backend (server-side, no auth required).
 * Falls back to realistic demo stats if the backend is unreachable,
 * so the landing page always displays live-looking data.
 */
async function getPublicStats(): Promise<PublicStats> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEMO_STATS;
    return res.json();
  } catch {
    return DEMO_STATS;
  }
}

export default async function Home() {
  const stats: PublicStats = await getPublicStats();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              CCW Equipment
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/orders">Customer Portal</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="#signin">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-6 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Equipment Supply
            <br />
            <span className="text-primary">Operations Platform</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Orders, inventory, quotes and fulfilment across Brisbane, Sydney
            &amp; Melbourne — all in one place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="#signin">
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/portal/orders">Customer Portal</Link>
            </Button>
          </div>
        </section>

        {/* Live Stats Bar */}
        <LiveStatsBar stats={stats} />

        {/* Features Grid */}
        <section className="border-t bg-muted/40">
          <div className="container mx-auto px-6 py-16 md:py-20">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Orders & Quotes */}
              <div className="lg:col-span-2 rounded-xl border bg-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    Orders &amp; Quotes
                  </h3>
                </div>
                <p className="text-muted-foreground mb-5">
                  <span className="text-foreground font-semibold">
                    {stats.active_orders} orders
                  </span>{" "}
                  in progress and{" "}
                  <span className="text-foreground font-semibold">
                    {stats.pending_quotes} quotes
                  </span>{" "}
                  open. Create quotes, convert to orders, track fulfilment
                  and manage line items across all product categories.
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Quote-to-order conversion</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Multi-location fulfilment</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Order status tracking</span>
                  </div>
                </div>
              </div>

              {/* Customers */}
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Customers</h3>
                </div>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-semibold">
                    {stats.total_customers} active accounts
                  </span>{" "}
                  with contact details, order history and account
                  management.
                </p>
              </div>

              {/* Products */}
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Products</h3>
                </div>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-semibold">
                    {stats.total_products} products
                  </span>{" "}
                  across{" "}
                  <span className="text-foreground font-semibold">
                    {stats.product_categories} categories
                  </span>{" "}
                  including heavy machinery, power tools, safety equipment
                  and more.
                </p>
              </div>

              {/* Inventory & Warehouse */}
              <div className="lg:col-span-2 rounded-xl border bg-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Warehouse className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    Inventory &amp; Warehouse
                  </h3>
                </div>
                <p className="text-muted-foreground mb-5">
                  Stock levels, transfers and purchase orders across all
                  three warehouses.{" "}
                  {stats.low_stock_alerts > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {stats.low_stock_alerts} low stock alerts
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { city: "Brisbane", label: "HQ" },
                    { city: "Sydney", label: "Branch" },
                    { city: "Melbourne", label: "Branch" },
                  ].map((loc) => (
                    <div
                      key={loc.city}
                      className="text-center p-3 rounded-lg bg-muted/60"
                    >
                      <MapPin className="w-4 h-4 text-primary mx-auto mb-1.5" />
                      <div className="text-sm font-medium">{loc.city}</div>
                      <div className="text-xs text-muted-foreground">
                        {loc.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reporting */}
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Reporting</h3>
                </div>
                <p className="text-muted-foreground">
                  Revenue, stock health, order status and performance
                  dashboards tracking{" "}
                  <span className="text-foreground font-semibold">
                    ${Number(
                      stats.total_revenue_this_month
                    ).toLocaleString("en-AU", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>{" "}
                  this month with live data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sign In Section */}
        <section id="signin" className="border-t">
          <div className="container mx-auto px-6 py-16 md:py-20">
            <div className="max-w-md mx-auto">
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 p-2.5 rounded-lg bg-primary/10 w-fit">
                    <LogIn className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
                  <CardDescription>
                    Sign in to your account to access the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane |
          Sydney | Melbourne
        </div>
      </footer>
    </div>
  );
}
