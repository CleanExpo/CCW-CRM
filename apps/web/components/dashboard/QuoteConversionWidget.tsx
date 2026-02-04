"use client";

import { useState, useEffect, memo } from "react";
import { FileText, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface QuoteConversionData {
  total_quotes: number;
  accepted: number;
  rejected: number;
  pending: number;
  expired: number;
  conversion_rate: number; // percentage
  average_quote_value: number;
  total_converted_revenue: number;
}

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const QuoteConversionWidget = memo(function QuoteConversionWidget() {
  const [data, setData] = useState<QuoteConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuoteConversion() {
      try {
        setLoading(true);
        const response = await apiClient.get<QuoteConversionData>("/api/dashboard/quote-conversion");
        setData(response);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load quote conversion data";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchQuoteConversion();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quote Conversion
          </CardTitle>
          <CardDescription>Loading quote conversion data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quote Conversion
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasQuotes = data && data.total_quotes > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quote Conversion
            </CardTitle>
            <CardDescription>
              {hasQuotes ? `${data.total_quotes} quotes sent` : "No quotes yet"}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/quotes">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasQuotes ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No quotes have been created yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Conversion Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Conversion Rate</span>
                <span className="text-2xl font-bold text-green-600">
                  {data.conversion_rate.toFixed(1)}%
                </span>
              </div>
              <Progress value={data.conversion_rate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {data.accepted} of {data.total_quotes} quotes converted to orders
              </p>
            </div>

            {/* Revenue Impact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 mb-1">Avg Quote Value</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(data.average_quote_value)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-700 mb-1">Converted Revenue</p>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(data.total_converted_revenue)}
                </p>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-medium mb-3">Quote Status Breakdown</p>

              <div className="flex items-center justify-between p-2 rounded bg-green-50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Accepted</span>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  {data.accepted}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-yellow-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Pending</span>
                </div>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  {data.pending}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-red-50">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Rejected</span>
                </div>
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                  {data.rejected}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">Expired</span>
                </div>
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                  {data.expired}
                </Badge>
              </div>
            </div>

            {/* Insights */}
            {data.conversion_rate >= 50 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Strong Performance</p>
                  <p className="text-xs text-green-700">
                    Your quote conversion rate is above industry average (30-40%)
                  </p>
                </div>
              </div>
            )}

            {data.pending > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Action Required</p>
                  <p className="text-xs text-yellow-700">
                    {data.pending} quote{data.pending > 1 ? "s" : ""} awaiting customer response
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
