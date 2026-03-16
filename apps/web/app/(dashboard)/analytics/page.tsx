"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Package,
  Warehouse, Download, ArrowUpRight, ArrowDownRight,
  BarChart2, Calendar,
} from "lucide-react";
import {
  BentoGrid, BentoCard, BentoCardHeader, BentoCardTitle,
  BentoCardDescription, BentoCardContent,
} from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import { GlassButton } from "@/components/ui/glass-button";
import { Typewriter } from "@/components/ui/typewriter-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = "7d" | "30d" | "90d" | "12m";

interface KPIMetric {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

interface RevenuePoint {
  period: string;
  revenue: number;
  previousRevenue: number;
  orders: number;
}

interface ProductRow {
  name: string;
  revenue: number;
  units: number;
  margin: number;
  trend: "up" | "down" | "flat";
}

interface CustomerCohort {
  month: string;
  newCustomers: number;
  retained: number;
  churned: number;
  ltv: number;
}

interface WarehouseRow {
  category: string;
  turnover: number;
  accuracy: number;
  efficiency: number;
}

// ─── Static Mock Data ─────────────────────────────────────────────────────────

const REVENUE_12M: RevenuePoint[] = [
  { period: "Apr", revenue: 284000, previousRevenue: 241000, orders: 187 },
  { period: "May", revenue: 312000, previousRevenue: 268000, orders: 204 },
  { period: "Jun", revenue: 298000, previousRevenue: 271000, orders: 196 },
  { period: "Jul", revenue: 341000, previousRevenue: 298000, orders: 223 },
  { period: "Aug", revenue: 378000, previousRevenue: 341000, orders: 248 },
  { period: "Sep", revenue: 356000, previousRevenue: 361000, orders: 234 },
  { period: "Oct", revenue: 412000, previousRevenue: 356000, orders: 271 },
  { period: "Nov", revenue: 489000, previousRevenue: 412000, orders: 319 },
  { period: "Dec", revenue: 521000, previousRevenue: 489000, orders: 342 },
  { period: "Jan", revenue: 387000, previousRevenue: 521000, orders: 254 },
  { period: "Feb", revenue: 428000, previousRevenue: 387000, orders: 281 },
  { period: "Mar", revenue: 462000, previousRevenue: 428000, orders: 303 },
];

const REVENUE_7D: RevenuePoint[] = [
  { period: "Mon", revenue: 12400, previousRevenue: 10200, orders: 8 },
  { period: "Tue", revenue: 18600, previousRevenue: 15800, orders: 12 },
  { period: "Wed", revenue: 9800, previousRevenue: 11200, orders: 6 },
  { period: "Thu", revenue: 24100, previousRevenue: 19400, orders: 18 },
  { period: "Fri", revenue: 31200, previousRevenue: 27600, orders: 24 },
  { period: "Sat", revenue: 14800, previousRevenue: 12100, orders: 9 },
  { period: "Sun", revenue: 8200, previousRevenue: 9400, orders: 5 },
];

const REVENUE_30D: RevenuePoint[] = Array.from({ length: 10 }, (_, i) => ({
  period: `W${i + 1 <= 4 ? i + 1 : i + 1}`,
  revenue: 68000 + i * 8400,
  previousRevenue: 58000 + i * 7200,
  orders: 42 + i * 6,
}));

const REVENUE_90D: RevenuePoint[] = Array.from({ length: 13 }, (_, i) => ({
  period: `W${i + 1}`,
  revenue: 55000 + i * 11000,
  previousRevenue: 47000 + i * 9500,
  orders: 35 + i * 8,
}));

const REVENUE_DATA: Record<DateRange, RevenuePoint[]> = {
  "7d": REVENUE_7D,
  "30d": REVENUE_30D,
  "90d": REVENUE_90D,
  "12m": REVENUE_12M,
};

const TOP_PRODUCTS: ProductRow[] = [
  { name: "Makita 18V Drill Kit", revenue: 84200, units: 312, margin: 34.2, trend: "up" },
  { name: "Stanley FatMax Tape", revenue: 62100, units: 1840, margin: 41.8, trend: "up" },
  { name: "Bosch Circular Saw", revenue: 58400, units: 186, margin: 28.6, trend: "flat" },
  { name: "3M Safety Harness", revenue: 51900, units: 243, margin: 52.1, trend: "up" },
  { name: "Milwaukee Impact Driver", revenue: 47300, units: 164, margin: 31.4, trend: "down" },
  { name: "DeWalt Table Saw", revenue: 43800, units: 94, margin: 22.8, trend: "up" },
  { name: "Hilti Anchor Bolts", revenue: 38200, units: 4120, margin: 61.3, trend: "up" },
];

const SLOW_MOVERS: ProductRow[] = [
  { name: "Vintage Hand Plane", revenue: 840, units: 3, margin: 18.4, trend: "down" },
  { name: "Cast Iron Vise", revenue: 1240, units: 4, margin: 14.2, trend: "down" },
  { name: "Pneumatic Brad Nailer", revenue: 2100, units: 8, margin: 21.6, trend: "down" },
  { name: "4\" Angle Grinder Discs", revenue: 1680, units: 42, margin: 38.9, trend: "flat" },
  { name: "Cable Pulling Lubricant", revenue: 920, units: 18, margin: 55.2, trend: "down" },
];

const CUSTOMER_COHORTS: CustomerCohort[] = [
  { month: "Oct", newCustomers: 28, retained: 142, churned: 8, ltv: 4820 },
  { month: "Nov", newCustomers: 34, retained: 156, churned: 6, ltv: 5140 },
  { month: "Dec", newCustomers: 41, retained: 174, churned: 9, ltv: 5390 },
  { month: "Jan", newCustomers: 22, retained: 168, churned: 12, ltv: 5080 },
  { month: "Feb", newCustomers: 37, retained: 179, churned: 7, ltv: 5620 },
  { month: "Mar", newCustomers: 45, retained: 198, churned: 5, ltv: 5890 },
];

const CATEGORY_REVENUE = [
  { name: "Power Tools", value: 284200 },
  { name: "Hand Tools", value: 168400 },
  { name: "Safety Equip.", value: 142800 },
  { name: "Electrical", value: 98600 },
  { name: "Building Mats.", value: 87300 },
  { name: "Accessories", value: 61400 },
];

const WAREHOUSE_DATA: WarehouseRow[] = [
  { category: "Power Tools", turnover: 8.4, accuracy: 97.2, efficiency: 91 },
  { category: "Hand Tools", turnover: 12.1, accuracy: 98.8, efficiency: 96 },
  { category: "Safety Equip.", turnover: 6.8, accuracy: 99.1, efficiency: 88 },
  { category: "Electrical", turnover: 9.3, accuracy: 96.4, efficiency: 84 },
  { category: "Building Mats.", turnover: 4.2, accuracy: 94.8, efficiency: 79 },
  { category: "Accessories", turnover: 15.6, accuracy: 99.4, efficiency: 97 },
];

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", notation: "compact", compactDisplay: "short",
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function ChartTooltip({ active, payload, label, isCurrency = false }: {
  active?: boolean;
  payload?: ReadonlyArray<{ name: string; value: number; color: string }>;
  label?: string | number;
  isCurrency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md min-w-[150px]">
      <p className="text-xs text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
          <span className="text-xs font-semibold">
            {isCurrency ? fmtFull(entry.value) : entry.value.toLocaleString("en-AU")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("12m");
  const [activeTab, setActiveTab] = useState("revenue");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1100);
    return () => clearTimeout(t);
  }, []);

  const revenueData = REVENUE_DATA[dateRange];

  const kpiMetrics: KPIMetric[] = [
    { label: "Total Revenue", value: fmtCompact(4620000), change: 12.4, changeLabel: "vs prev period", icon: DollarSign, iconColor: "text-blue-600", iconBg: "bg-blue-500/10" },
    { label: "Active Customers", value: "2,847", change: 8.1, changeLabel: "new this period", icon: Users, iconColor: "text-purple-600", iconBg: "bg-purple-500/10" },
    { label: "Units Sold", value: "18,432", change: 15.3, changeLabel: "units shipped", icon: Package, iconColor: "text-teal-600", iconBg: "bg-teal-500/10" },
    { label: "Avg. Order Value", value: fmtCompact(1528), change: -2.8, changeLabel: "vs prev period", icon: BarChart2, iconColor: "text-amber-600", iconBg: "bg-amber-500/10" },
    { label: "Gross Margin", value: "38.4%", change: 3.2, changeLabel: "margin growth", icon: TrendingUp, iconColor: "text-green-600", iconBg: "bg-green-500/10" },
    { label: "Warehouse Eff.", value: "89.2%", change: 4.6, changeLabel: "accuracy score", icon: Warehouse, iconColor: "text-pink-600", iconBg: "bg-pink-500/10" },
  ];

  function handleExportCSV() {
    const rows = ["Period,Revenue,PrevRevenue,Orders", ...revenueData.map(d => `${d.period},${d.revenue},${d.previousRevenue},${d.orders}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
      >
        <div className="space-y-2">
          <Badge variant="outline">
            <BarChart2 className="w-3 h-3 mr-2" />Analytics
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight">Business Analytics</h1>
          <Typewriter
            text={[
              "Tracking $4.62M revenue across 6 product categories",
              "2,847 active customers · 38.4% gross margin",
              "18,432 units sold · 89.2% warehouse efficiency",
            ]}
            speed={45} loop deleteSpeed={25} delay={3000}
            className="text-muted-foreground text-base"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <GlassButton size="sm" contentClassName="flex items-center gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />Export CSV
          </GlassButton>
          <GlassButton size="sm" contentClassName="flex items-center gap-2" onClick={() => window.print()}>
            <Download className="w-4 h-4" />Export PDF
          </GlassButton>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiMetrics.map((m, i) => {
          const Icon = m.icon;
          const pos = m.change >= 0;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${m.iconBg}`}>
                      <Icon className={`h-4 w-4 ${m.iconColor}`} />
                    </div>
                    <Badge variant="outline" className={`text-xs ${pos ? "text-green-600 border-green-200" : "text-red-600 border-red-200"}`}>
                      {pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(m.change)}%
                    </Badge>
                  </div>
                  <p className="text-xl font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.changeLabel}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="warehouse">Warehouse</TabsTrigger>
          </TabsList>

          {/* Revenue */}
          <TabsContent value="revenue">
            <BentoGrid columns={3} gap="lg">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="col-span-2">
                <BorderBeam>
                  <BentoCard variant="glass" span={2} className="min-h-[380px]">
                    <BentoCardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <BentoCardTitle>Revenue Trend</BentoCardTitle>
                          <BentoCardDescription>Current vs previous period</BentoCardDescription>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <TrendingUp className="h-3 w-3 mr-1" />+12.4%
                        </Badge>
                      </div>
                    </BentoCardHeader>
                    <BentoCardContent>
                      <ResponsiveContainer width="100%" height={275}>
                        <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="agCur" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="agPrev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={fmtCompact} />
                          <Tooltip content={(p) => <ChartTooltip {...p} isCurrency />} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="revenue" name="Current" stroke="hsl(var(--primary))" fill="url(#agCur)" strokeWidth={2} />
                          <Area type="monotone" dataKey="previousRevenue" name="Previous" stroke="hsl(var(--chart-2))" fill="url(#agPrev)" strokeWidth={2} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </BentoCardContent>
                  </BentoCard>
                </BorderBeam>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="col-span-1">
                <BentoCard variant="elevated" span={1} className="min-h-[380px]">
                  <BentoCardHeader>
                    <BentoCardTitle>By Category</BentoCardTitle>
                    <BentoCardDescription>Revenue split</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={CATEGORY_REVENUE} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
                          {CATEGORY_REVENUE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {CATEGORY_REVENUE.map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-muted-foreground truncate max-w-[100px]">{cat.name}</span>
                          </div>
                          <span className="font-medium">{fmtCompact(cat.value)}</span>
                        </div>
                      ))}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.15 }} className="col-span-3">
                <BentoCard variant="glass" span={3} className="min-h-[260px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Order Volume</BentoCardTitle>
                    <BentoCardDescription>Orders processed per period</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={185}>
                      <BarChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip content={(p) => <ChartTooltip {...p} />} />
                        <Bar dataKey="orders" name="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>
            </BentoGrid>
          </TabsContent>

          {/* Products */}
          <TabsContent value="products">
            <BentoGrid columns={3} gap="lg">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="col-span-2">
                <BentoCard variant="glass" span={2} className="min-h-[440px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Top Sellers by Revenue</BentoCardTitle>
                    <BentoCardDescription>Current period performance</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={TOP_PRODUCTS} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={fmtCompact} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={140} />
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2 border-t pt-4">
                      {TOP_PRODUCTS.slice(0, 4).map((p, i) => (
                        <div key={p.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-4">{i + 1}.</span>
                            <span className="font-medium">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{p.units.toLocaleString()} units</span>
                            <span className="text-green-600 font-medium">{p.margin}% margin</span>
                            {p.trend === "up" ? <TrendingUp className="h-3 w-3 text-green-600" /> : p.trend === "down" ? <TrendingDown className="h-3 w-3 text-red-500" /> : <span className="h-3 w-3" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="col-span-1">
                <BentoCard variant="elevated" span={1} className="min-h-[440px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Slow Movers</BentoCardTitle>
                    <BentoCardDescription>Requires attention</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <div className="space-y-5">
                      {SLOW_MOVERS.map((p) => (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate mr-2 flex-1">{p.name}</span>
                            <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={(p.revenue / 2100) * 100} className="flex-1 h-1.5" />
                            <span className="text-xs text-muted-foreground w-14 text-right">{fmtCompact(p.revenue)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{p.units} units · {p.margin}% margin</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Recommendation</p>
                      <p className="text-xs text-muted-foreground mt-1">Consider clearance pricing or supplier return on these 5 SKUs to free warehouse space.</p>
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>
            </BentoGrid>
          </TabsContent>

          {/* Customers */}
          <TabsContent value="customers">
            <BentoGrid columns={3} gap="lg">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="col-span-2">
                <BentoCard variant="glass" span={2} className="min-h-[380px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Acquisition & Retention</BentoCardTitle>
                    <BentoCardDescription>New, retained, and churned customers per month</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={275}>
                      <BarChart data={CUSTOMER_COHORTS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip content={(p) => <ChartTooltip {...p} />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Bar dataKey="retained" name="Retained" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="newCustomers" name="New" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="churned" name="Churned" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="col-span-1">
                <BentoCard variant="gradient" span={1} className="min-h-[380px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Customer LTV</BentoCardTitle>
                    <BentoCardDescription>Average lifetime value trend</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={190}>
                      <LineChart data={CUSTOMER_COHORTS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                        <Line type="monotone" dataKey="ltv" name="Avg LTV" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2.5">
                      {[
                        { label: "Current Avg. LTV", value: "$5,890", color: "text-brand-primary" },
                        { label: "Retention Rate", value: "97.5%", color: "text-green-600" },
                        { label: "LTV Growth", value: "+22.1%", color: "text-green-600" },
                        { label: "Avg. Orders/Customer", value: "3.86", color: "" },
                      ].map((s) => (
                        <div key={s.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className={`font-bold ${s.color}`}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>
            </BentoGrid>
          </TabsContent>

          {/* Warehouse */}
          <TabsContent value="warehouse">
            <BentoGrid columns={3} gap="lg">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="col-span-2">
                <BentoCard variant="glass" span={2} className="min-h-[380px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Stock Turnover Rate</BentoCardTitle>
                    <BentoCardDescription>Inventory turns per year by category</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <ResponsiveContainer width="100%" height={275}>
                      <BarChart data={WAREHOUSE_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip content={(p) => <ChartTooltip {...p} />} />
                        <Bar dataKey="turnover" name="Turns/yr" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="col-span-1">
                <BentoCard variant="elevated" span={1} className="min-h-[380px]">
                  <BentoCardHeader>
                    <BentoCardTitle>Efficiency Scores</BentoCardTitle>
                    <BentoCardDescription>Target: 90% threshold</BentoCardDescription>
                  </BentoCardHeader>
                  <BentoCardContent>
                    <div className="space-y-4">
                      {WAREHOUSE_DATA.map((m) => (
                        <div key={m.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium truncate mr-2">{m.category}</span>
                            <span className={m.efficiency >= 90 ? "text-green-600" : "text-red-500"}>
                              {m.efficiency}%
                            </span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
                            <div
                              className={`h-full rounded-full transition-all ${m.efficiency >= 90 ? "bg-green-500" : "bg-red-500"}`}
                              style={{ width: `${m.efficiency}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{m.accuracy}% stock accuracy</p>
                        </div>
                      ))}
                    </div>
                  </BentoCardContent>
                </BentoCard>
              </motion.div>
            </BentoGrid>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
