import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SkeletonChart } from "@/components/ui/skeleton-chart";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-primary/10 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="space-y-6">
        <SkeletonChart type="area" height={400} showLegend showHeader />
        <SkeletonChart type="bar" height={300} showHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonChart type="pie" height={350} showLegend showHeader />
          <SkeletonCard variant="large" />
        </div>
      </div>
    </div>
  );
}
