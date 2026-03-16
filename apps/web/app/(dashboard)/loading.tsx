import { SkeletonCard } from "@/components/ui/skeleton-card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-10 w-64 bg-primary/10 rounded animate-pulse" />
        <div className="h-6 w-96 bg-primary/10 rounded animate-pulse" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-primary/10 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <SkeletonCard count={4} variant="large" />
    </div>
  );
}
