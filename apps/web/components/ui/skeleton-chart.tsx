import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonChartProps {
  /**
   * Chart type for skeleton rendering
   * @default "bar"
   */
  type?: "bar" | "line" | "pie" | "area";
  /**
   * Chart height
   * @default 300
   */
  height?: number;
  /**
   * Show chart header
   * @default true
   */
  showHeader?: boolean;
  /**
   * Show legend skeleton
   * @default false
   */
  showLegend?: boolean;
  /**
   * Additional className for the card
   */
  className?: string;
}

export function SkeletonChart({
  type = "bar",
  height = 300,
  showHeader = true,
  showLegend = false,
  className,
}: SkeletonChartProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
      )}
      <CardContent className={showHeader ? "" : "pt-6"}>
        <div className="space-y-4">
          {/* Chart area */}
          <div
            className="relative w-full rounded-lg bg-muted/20 border"
            style={{ height: `${height}px` }}
          >
            {type === "bar" && <BarChartSkeleton />}
            {type === "line" && <LineChartSkeleton />}
            {type === "area" && <AreaChartSkeleton />}
            {type === "pie" && <PieChartSkeleton />}
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="flex flex-wrap gap-4 justify-center">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BarChartSkeleton() {
  return (
    <div className="absolute inset-0 flex items-end justify-around p-6 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

function LineChartSkeleton() {
  return (
    <div className="absolute inset-0 p-6">
      <svg className="w-full h-full" viewBox="0 0 400 200">
        <defs>
          <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0,150 C 50,120 100,140 150,100 C 200,60 250,80 300,50 L 350,70 L 400,40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          opacity="0.3"
        />
        <path
          d="M 0,150 C 50,120 100,140 150,100 C 200,60 250,80 300,50 L 350,70 L 400,40 L 400,200 L 0,200 Z"
          fill="url(#skeleton-gradient)"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}

function AreaChartSkeleton() {
  return <LineChartSkeleton />;
}

function PieChartSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="relative" style={{ width: "200px", height: "200px" }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          {[
            { color: "hsl(var(--chart-1))", start: 0, end: 90 },
            { color: "hsl(var(--chart-2))", start: 90, end: 180 },
            { color: "hsl(var(--chart-3))", start: 180, end: 270 },
            { color: "hsl(var(--chart-4))", start: 270, end: 360 },
          ].map((slice, i) => {
            const startAngle = (slice.start * Math.PI) / 180;
            const endAngle = (slice.end * Math.PI) / 180;
            const x1 = 100 + 80 * Math.cos(startAngle);
            const y1 = 100 + 80 * Math.sin(startAngle);
            const x2 = 100 + 80 * Math.cos(endAngle);
            const y2 = 100 + 80 * Math.sin(endAngle);
            const largeArc = slice.end - slice.start > 180 ? 1 : 0;

            return (
              <path
                key={i}
                d={`M 100,100 L ${x1},${y1} A 80,80 0 ${largeArc},1 ${x2},${y2} Z`}
                fill={slice.color}
                opacity="0.3"
              />
            );
          })}
          <circle cx="100" cy="100" r="50" fill="hsl(var(--background))" />
        </svg>
      </div>
    </div>
  );
}
