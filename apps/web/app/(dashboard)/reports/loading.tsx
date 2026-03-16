import { SkeletonCard } from "@/components/ui/skeleton-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>

        {/* Report templates skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={9} variant="medium" />
        </div>
      </div>
    </div>
  );
}
