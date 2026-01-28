"use client";

import { useState, useEffect } from "react";
import { ArrowRight, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";

interface TransferSuggestion {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  from_location: string;
  to_location: string;
  suggested_quantity: number;
  priority: "high" | "medium" | "low";
  reason: string;
  current_stock_from: number;
  current_stock_to: number;
  projected_stock_from: number;
  projected_stock_to: number;
  estimated_cost: number;
  potential_revenue_impact: number;
}

interface TransferSuggestionsData {
  suggestions: TransferSuggestion[];
  total_potential_revenue: number;
  total_estimated_cost: number;
}

export function TransferSuggestionsWidget() {
  const [data, setData] = useState<TransferSuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransferSuggestions() {
      try {
        setLoading(true);
        const response = await apiClient.get<TransferSuggestionsData>("/api/inventory/transfer-suggestions");
        setData(response);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load transfer suggestions";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchTransferSuggestions();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatLocation = (location: string): string => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transfer Suggestions
          </CardTitle>
          <CardDescription>Loading transfer suggestions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transfer Suggestions
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasSuggestions = data && data.suggestions.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Transfer Suggestions
            </CardTitle>
            <CardDescription>
              {hasSuggestions
                ? `${data.suggestions.length} recommended transfer${data.suggestions.length > 1 ? "s" : ""} to optimize stock distribution`
                : "No transfers recommended at this time"}
            </CardDescription>
          </div>
          {hasSuggestions && (
            <Button asChild variant="outline" size="sm">
              <Link href={"/inventory/transfers" as any}>View All</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasSuggestions ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
            <p className="text-sm">Stock distribution is optimized</p>
            <p className="text-xs mt-1">No transfers recommended at this time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Potential Revenue Impact</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(data.total_potential_revenue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-900">Estimated Transfer Cost</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(data.total_estimated_cost)}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800">Net Benefit:</span>
                  <span className="text-lg font-bold text-green-700">
                    {formatCurrency(data.total_potential_revenue - data.total_estimated_cost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transfer Suggestions List */}
            <div className="space-y-3">
              {data.suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={`rounded-lg border p-4 ${getPriorityColor(suggestion.priority)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold">
                          {suggestion.product_sku}
                        </span>
                        <Badge variant={getPriorityBadgeVariant(suggestion.priority)}>
                          {suggestion.priority.toUpperCase()} PRIORITY
                        </Badge>
                      </div>
                      <p className="font-medium">{suggestion.product_name}</p>
                    </div>
                  </div>

                  {/* Transfer Flow */}
                  <div className="flex items-center gap-3 my-3 p-3 bg-white rounded border">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">From</p>
                      <p className="font-semibold">{formatLocation(suggestion.from_location)}</p>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.current_stock_from} → {suggestion.projected_stock_from}
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      <ArrowRight className="h-5 w-5 text-blue-600" />
                      <Badge className="mt-1 bg-blue-600 text-white">
                        {suggestion.suggested_quantity} units
                      </Badge>
                    </div>

                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">To</p>
                      <p className="font-semibold">{formatLocation(suggestion.to_location)}</p>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.current_stock_to} → {suggestion.projected_stock_to}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{suggestion.reason}</p>
                  </div>

                  {/* Cost-Benefit */}
                  <div className="flex items-center justify-between text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Transfer Cost: </span>
                      <span className="font-semibold">{formatCurrency(suggestion.estimated_cost)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Revenue Impact: </span>
                      <span className="font-semibold text-green-700">
                        {formatCurrency(suggestion.potential_revenue_impact)}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button asChild size="sm" className="w-full">
                    <Link
                      href={`/inventory/transfers/create?product=${suggestion.product_id}&from=${suggestion.from_location}&to=${suggestion.to_location}&quantity=${suggestion.suggested_quantity}` as any}
                    >
                      Create Transfer
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
