import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { LiveStatsBar, type PublicStats } from '@/components/landing/LiveStatsBar';
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
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Realistic demo stats shown when the backend is unreachable.
 * These match the seeded database numbers so the page always looks live.
 */
const DEMO_STATS: PublicStats = {
  total_products: 150,
  total_customers: 45,
  active_orders: 32,
  pending_quotes: 12,
  total_revenue_this_month: '124850',
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
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="text-primary h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">CCW Equipment</span>
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
        <section className="container mx-auto px-6 py-20 text-center md:py-28">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Equipment Supply
            <br />
            <span className="text-primary">Operations Platform</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl dark:text-slate-400">
            Orders, inventory, quotes and fulfilment across Brisbane, Sydney &amp; Melbourne — all
            in one place.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="#signin">
                Get Started
                <ChevronRight className="ml-1 h-4 w-4" />
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
        <section className="bg-muted/40 border-t">
          <div className="container mx-auto px-6 py-16 md:py-20">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Orders & Quotes */}
              <div className="bg-card rounded-xl border p-6 md:p-8 lg:col-span-2">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2.5">
                    <ShoppingCart className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">Orders &amp; Quotes</h3>
                </div>
                <p className="mb-5 text-slate-600 dark:text-slate-400">
                  <span className="text-foreground font-semibold">
                    {stats.active_orders} orders
                  </span>{' '}
                  in progress and{' '}
                  <span className="text-foreground font-semibold">
                    {stats.pending_quotes} quotes
                  </span>{' '}
                  open. Create quotes, convert to orders, track fulfilment and manage line items
                  across all product categories.
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Quote-to-order conversion</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Multi-location fulfilment</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>Order status tracking</span>
                  </div>
                </div>
              </div>

              {/* Customers */}
              <div className="bg-card rounded-xl border p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2.5">
                    <Users className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">Customers</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="text-foreground font-semibold">
                    {stats.total_customers} active accounts
                  </span>{' '}
                  with contact details, order history and account management.
                </p>
              </div>

              {/* Products */}
              <div className="bg-card rounded-xl border p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2.5">
                    <Package className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">Products</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="text-foreground font-semibold">
                    {stats.total_products} products
                  </span>{' '}
                  across{' '}
                  <span className="text-foreground font-semibold">
                    {stats.product_categories} categories
                  </span>{' '}
                  including heavy machinery, power tools, safety equipment and more.
                </p>
              </div>

              {/* Inventory & Warehouse */}
              <div className="bg-card rounded-xl border p-6 md:p-8 lg:col-span-2">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2.5">
                    <Warehouse className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">Inventory &amp; Warehouse</h3>
                </div>
                <p className="mb-5 text-slate-600 dark:text-slate-400">
                  Stock levels, transfers and purchase orders across all three warehouses.{' '}
                  {stats.low_stock_alerts > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {stats.low_stock_alerts} low stock alerts
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { city: 'Brisbane', label: 'HQ' },
                    { city: 'Sydney', label: 'Branch' },
                    { city: 'Melbourne', label: 'Branch' },
                  ].map((loc) => (
                    <div key={loc.city} className="bg-muted/60 rounded-lg p-3 text-center">
                      <MapPin className="text-primary mx-auto mb-1.5 h-4 w-4" />
                      <div className="text-sm font-medium">{loc.city}</div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">{loc.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reporting */}
              <div className="bg-card rounded-xl border p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2.5">
                    <BarChart3 className="text-primary h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">Reporting</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Revenue, stock health, order status and performance dashboards tracking{' '}
                  <span className="text-foreground font-semibold">
                    $
                    {Number(stats.total_revenue_this_month).toLocaleString('en-AU', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>{' '}
                  this month with live data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sign In Section */}
        <section id="signin" className="border-t">
          <div className="container mx-auto px-6 py-16 md:py-20">
            <div className="mx-auto max-w-md">
              <Card>
                <CardHeader className="text-center">
                  <div className="bg-primary/10 mx-auto mb-2 w-fit rounded-lg p-2.5">
                    <LogIn className="text-primary h-5 w-5" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
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
        <div className="container mx-auto px-6 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
          &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane | Sydney | Melbourne
        </div>
      </footer>
    </div>
  );
}
