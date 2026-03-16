"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { SkeletonChart } from "@/components/ui/skeleton-chart";
import { Play, Code2, Eye, Check } from "lucide-react";

export default function SuspenseShowcasePage() {
  const [activeTab, setActiveTab] = useState("cards");
  const [cardCount, setCardCount] = useState(3);
  const [cardVariant, setCardVariant] = useState<"small" | "medium" | "large">("medium");
  const [tableRows, setTableRows] = useState(5);
  const [tableColumns, setTableColumns] = useState(5);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie" | "area">("bar");

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-3">
        <Badge variant="outline">
          <Eye className="w-3 h-3 mr-2" />
          Demo Showcase
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">Suspense Skeleton Components</h1>
        <p className="text-muted-foreground text-base">
          Interactive demonstration of loading skeletons for streaming SSR.
          Adjust parameters and preview the components in action.
        </p>
      </div>

      {/* Implementation Status */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-500/10 p-2">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                Phase 1 Complete
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✅ SkeletonCard component (3 variants)</li>
                <li>✅ SkeletonTable component (configurable)</li>
                <li>✅ SkeletonChart component (4 types)</li>
                <li>✅ Loading.tsx files (7 pages)</li>
                <li>✅ Error.tsx files (7 pages)</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/SUSPENSE_ARCHITECTURE.md")}
              >
                <Code2 className="h-4 w-4 mr-2" />
                Architecture Guide
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Demos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="cards">Skeleton Cards</TabsTrigger>
          <TabsTrigger value="tables">Skeleton Tables</TabsTrigger>
          <TabsTrigger value="charts">Skeleton Charts</TabsTrigger>
          <TabsTrigger value="code">Code Examples</TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Controls</CardTitle>
                <CardDescription>Adjust skeleton card parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Count: {cardCount}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 6].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={cardCount === n ? "default" : "outline"}
                        onClick={() => setCardCount(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Variant</label>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map((v) => (
                      <Button
                        key={v}
                        size="sm"
                        variant={cardVariant === v ? "default" : "outline"}
                        onClick={() => setCardVariant(v)}
                        className="capitalize"
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
                  {`<SkeletonCard
  count={${cardCount}}
  variant="${cardVariant}"
  showHeader
/>`}
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Preview</CardTitle>
                      <CardDescription>Live skeleton rendering</CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Animating
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SkeletonCard count={cardCount} variant={cardVariant} showHeader />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tables Tab */}
        <TabsContent value="tables">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Controls</CardTitle>
                <CardDescription>Adjust skeleton table parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rows: {tableRows}</label>
                  <div className="flex gap-2">
                    {[3, 5, 10, 20].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={tableRows === n ? "default" : "outline"}
                        onClick={() => setTableRows(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns: {tableColumns}</label>
                  <div className="flex gap-2">
                    {[3, 5, 7, 9].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={tableColumns === n ? "default" : "outline"}
                        onClick={() => setTableColumns(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
                  {`<SkeletonTable
  rows={${tableRows}}
  columns={${tableColumns}}
  showSearch
  showCard
/>`}
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Preview</CardTitle>
                      <CardDescription>Live skeleton rendering</CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Animating
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <SkeletonTable rows={tableRows} columns={tableColumns} showSearch />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Controls</CardTitle>
                <CardDescription>Adjust skeleton chart parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chart Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bar", "line", "area", "pie"] as const).map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={chartType === t ? "default" : "outline"}
                        onClick={() => setChartType(t)}
                        className="capitalize"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
                  {`<SkeletonChart
  type="${chartType}"
  height={300}
  showLegend
  showHeader
/>`}
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
                    Use Cases
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• <strong>Bar:</strong> Revenue charts, order volume</li>
                    <li>• <strong>Line:</strong> Trend analysis, time series</li>
                    <li>• <strong>Area:</strong> Cumulative metrics</li>
                    <li>• <strong>Pie:</strong> Category distribution</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Preview</CardTitle>
                      <CardDescription>Live skeleton rendering</CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Animating
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <SkeletonChart type={chartType} height={300} showLegend showHeader />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Code Examples Tab */}
        <TabsContent value="code">
          <div className="space-y-6">
            {/* Example 1: Page-Level Loading */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Example 1: Page-Level Loading</CardTitle>
                <CardDescription>
                  Next.js automatically wraps pages with loading.tsx in Suspense
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground font-medium">
                    apps/web/app/(dashboard)/products/loading.tsx
                  </div>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                    <code>{`import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function ProductsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="h-8 w-48 bg-primary/10 rounded animate-pulse" />

      {/* Table skeleton */}
      <SkeletonTable rows={10} columns={7} showSearch showCard />
    </div>
  );
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Example 2: Nested Suspense */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Example 2: Nested Suspense (Phase 2)</CardTitle>
                <CardDescription>
                  Granular loading states for independent widgets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground font-medium">
                    apps/web/app/(dashboard)/dashboard/page.tsx
                  </div>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                    <code>{`import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SkeletonChart } from "@/components/ui/skeleton-chart";

export default async function DashboardPage() {
  return (
    <>
      <PageHeader /> {/* Renders immediately */}

      {/* KPIs - Independent loading */}
      <Suspense fallback={<SkeletonCard count={6} variant="small" />}>
        <KPIMetrics />
      </Suspense>

      {/* Revenue Chart - Independent loading */}
      <Suspense fallback={<SkeletonChart type="area" height={400} />}>
        <RevenueChart />
      </Suspense>

      {/* AI Insights - Slowest, doesn't block other widgets */}
      <Suspense fallback={<SkeletonCard count={3} variant="large" />}>
        <AIInsights />
      </Suspense>
    </>
  );
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Example 3: Error Boundary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Example 3: Error Boundary</CardTitle>
                <CardDescription>
                  Graceful error handling with retry functionality
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground font-medium">
                    apps/web/app/(dashboard)/products/error.tsx
                  </div>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                    <code>{`"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ProductsError({ error, reset }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h2 className="text-xl font-semibold">Products Error</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Failed to load products"}
          </p>
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps (Phase 2)</CardTitle>
          <CardDescription>Migrate to Server Components for true streaming SSR</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Week 1: Static Pages</h4>
                <p className="text-xs text-muted-foreground">
                  Convert Reports and Analytics to Server Components
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Week 2: Hybrid Pattern</h4>
                <p className="text-xs text-muted-foreground">
                  Implement Products page with Server/Client hybrid approach
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Week 3: Dashboard Nested Suspense</h4>
                <p className="text-xs text-muted-foreground">
                  Add 10+ Suspense boundaries for independent widget streaming
                </p>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Button onClick={() => window.open("/SUSPENSE_ARCHITECTURE.md")} className="w-full">
                <Code2 className="h-4 w-4 mr-2" />
                Read Full Architecture Guide
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
