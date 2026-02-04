"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface CoverageData {
  language_code: string;
  language_name: string;
  total_products: number;
  translated_products: number;
  pending_products: number;
  ai_generated: number;
  human_reviewed: number;
  approved: number;
  coverage_percentage: number;
}

interface CoverageStatsProps {
  data: CoverageData[];
}

export function CoverageStats({ data }: CoverageStatsProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No coverage data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.map((lang) => (
        <div key={lang.language_code} className="space-y-3">
          {/* Language Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">{lang.language_name}</h3>
              <Badge variant="outline" className="font-mono text-xs">
                {lang.language_code}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{lang.coverage_percentage.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                {lang.translated_products} / {lang.total_products} products
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <Progress value={lang.coverage_percentage} className="h-2" />

          {/* Status Breakdown */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {lang.pending_products}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {lang.ai_generated}
              </div>
              <div className="text-xs text-muted-foreground">AI Generated</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {lang.human_reviewed}
              </div>
              <div className="text-xs text-muted-foreground">Human Reviewed</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {lang.approved}
              </div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
