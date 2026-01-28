import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  BarChart3,
  MapPin,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
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
              <Link href="/login">Sign In</Link>
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
              <Link href="/login">
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/portal/orders">Customer Portal</Link>
            </Button>
          </div>
        </section>

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
                  <h3 className="text-xl font-semibold">Orders &amp; Quotes</h3>
                </div>
                <p className="text-muted-foreground mb-5">
                  Create quotes, convert to orders, track fulfilment and manage
                  line items across all product categories.
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
                  Customer directory with contact details, order history and
                  account management.
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
                  Full product catalogue covering heavy machinery, power tools,
                  safety equipment and more.
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
                  Stock levels, transfers between locations, purchase orders and
                  backorder management across all three warehouses.
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
                  Revenue, stock health, order status and performance dashboards
                  with live data.
                </p>
              </div>
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
