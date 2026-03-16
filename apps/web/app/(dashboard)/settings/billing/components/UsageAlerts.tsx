"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import { billingUsageApi, type UsageLimits } from "@/lib/api/billing-usage";
import Link from "next/link";

export function UsageAlerts() {
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLimits();
  }, []);

  async function fetchLimits() {
    try {
      setLoading(true);
      const data = await billingUsageApi.checkUsageLimits();
      setLimits(data);
    } catch (error) {
      console.error("Failed to fetch usage limits:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !limits) {
    return null;
  }

  // No alerts to show
  if (limits.within_limits && limits.warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Exceeded Limits - Critical */}
      {limits.exceeded.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Usage Limit Reached</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>You've reached the following limits on your current plan:</p>
              <ul className="list-disc list-inside space-y-1">
                {limits.exceeded.map((message, index) => (
                  <li key={index} className="text-sm">
                    {message}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/settings/billing#plans">Upgrade Plan</Link>
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings - Approaching Limits */}
      {limits.warnings.length > 0 && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Approaching Usage Limits</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>You're approaching limits on your current plan:</p>
              <ul className="list-disc list-inside space-y-1">
                {limits.warnings.map((message, index) => (
                  <li key={index} className="text-sm">
                    {message}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" asChild size="sm">
                  <Link href="/settings/billing#plans">View Plans</Link>
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info - Within Limits */}
      {limits.within_limits && limits.warnings.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Usage Healthy</AlertTitle>
          <AlertDescription>
            You're well within your plan limits. Keep up the great work!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
