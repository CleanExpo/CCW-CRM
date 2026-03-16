import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonCardProps {
  /**
   * Number of skeleton cards to render
   * @default 1
   */
  count?: number;
  /**
   * Show header skeleton
   * @default true
   */
  showHeader?: boolean;
  /**
   * Content height variant
   * @default "medium"
   */
  variant?: "small" | "medium" | "large";
  /**
   * Additional className for the card container
   */
  className?: string;
}

const HEIGHT_MAP = {
  small: "h-24",
  medium: "h-32",
  large: "h-48",
} as const;

export function SkeletonCard({
  count = 1,
  showHeader = true,
  variant = "medium",
  className,
}: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className={className}>
          {showHeader && (
            <CardHeader>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
          )}
          <CardContent className={showHeader ? "" : "pt-6"}>
            <div className="space-y-3">
              <Skeleton className={`w-full ${HEIGHT_MAP[variant]}`} />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
