import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function QuotesLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-primary/10 rounded animate-pulse" />
          <div className="h-5 w-64 bg-primary/10 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-primary/10 rounded animate-pulse" />
          <div className="h-10 w-32 bg-primary/10 rounded animate-pulse" />
        </div>
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={10} columns={8} showSearch showCard />
    </div>
  );
}
