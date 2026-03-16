import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonTableProps {
  /**
   * Number of rows to render
   * @default 5
   */
  rows?: number;
  /**
   * Number of columns to render
   * @default 5
   */
  columns?: number;
  /**
   * Show table header
   * @default true
   */
  showHeader?: boolean;
  /**
   * Show card wrapper
   * @default false
   */
  showCard?: boolean;
  /**
   * Show search bar skeleton
   * @default false
   */
  showSearch?: boolean;
  /**
   * Additional className for the container
   */
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 5,
  showHeader = true,
  showCard = false,
  showSearch = false,
  className,
}: SkeletonTableProps) {
  const content = (
    <div className={className}>
      {showSearch && (
        <div className="mb-4">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      )}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            {showHeader && (
              <thead className="border-b bg-muted/50">
                <tr>
                  {Array.from({ length: columns }).map((_, i) => (
                    <th key={i} className="h-12 px-4 text-left">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-0">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <td key={colIndex} className="h-14 px-4">
                      <Skeleton
                        className={`h-4 ${
                          colIndex === 0
                            ? "w-24"
                            : colIndex === columns - 1
                              ? "w-16"
                              : "w-32"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </div>
  );

  if (showCard) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return content;
}
