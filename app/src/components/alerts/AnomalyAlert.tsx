'use client';

/**
 * PHASE AI: Anomaly Alert Component
 *
 * Displays anomaly detection warnings with severity levels
 * and recommended actions.
 */

import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AnomalyAlertProps {
  /** Whether anomaly was detected */
  isAnomaly: boolean;

  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Human-readable description */
  description: string;

  /** Recommended action */
  recommendedAction: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Additional details */
  details?: Record<string, unknown>;

  /** Callback when user acknowledges */
  onAcknowledge?: () => void;

  /** Callback when user dismisses */
  onDismiss?: () => void;

  /** Callback when user proceeds anyway */
  onProceedAnyway?: () => void;
}

export function AnomalyAlert({
  isAnomaly,
  severity,
  description,
  recommendedAction,
  confidence,
  details,
  onAcknowledge,
  onDismiss,
  onProceedAnyway,
}: AnomalyAlertProps) {
  if (!isAnomaly || severity === 'low') {
    return null;
  }

  // Icon based on severity
  const Icon =
    severity === 'critical'
      ? XCircle
      : severity === 'high'
        ? AlertTriangle
        : severity === 'medium'
          ? AlertCircle
          : Info;

  // Color theme based on severity
  const colorClass =
    severity === 'critical'
      ? 'border-red-300 bg-red-50'
      : severity === 'high'
        ? 'border-orange-300 bg-orange-50'
        : 'border-yellow-300 bg-yellow-50';

  const iconColor =
    severity === 'critical'
      ? 'text-red-600'
      : severity === 'high'
        ? 'text-orange-600'
        : 'text-yellow-600';

  const titleColor =
    severity === 'critical'
      ? 'text-red-900'
      : severity === 'high'
        ? 'text-orange-900'
        : 'text-yellow-900';

  const textColor =
    severity === 'critical'
      ? 'text-red-800'
      : severity === 'high'
        ? 'text-orange-800'
        : 'text-yellow-800';

  const badgeVariant =
    severity === 'critical' ? 'destructive' : severity === 'high' ? 'destructive' : 'secondary';

  const confidencePercent = Math.round(confidence * 100);

  return (
    <Card className={`border-2 ${colorClass}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-6 w-6 flex-shrink-0 ${iconColor}`} />

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <AlertTitle className={`text-base font-semibold ${titleColor} mb-0`}>
                ⚠️ Anomaly Detected
              </AlertTitle>
              <Badge variant={badgeVariant} className="capitalize">
                {severity}
              </Badge>
              <Badge variant="outline" className="bg-white/50">
                {confidencePercent}% confident
              </Badge>
            </div>

            <AlertDescription className={`text-sm ${textColor} mb-3`}>
              <div className="mb-1 font-medium">{description}</div>
              <div className="mt-2">
                <span className="font-semibold">Recommended:</span> {recommendedAction}
              </div>
            </AlertDescription>

            {details && Object.keys(details).length > 0 && (
              <details className="mb-3">
                <summary className={`text-xs ${textColor} cursor-pointer hover:underline`}>
                  View technical details
                </summary>
                <div className="mt-2 rounded bg-white/50 p-2 font-mono text-xs">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                </div>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              {onAcknowledge && (
                <Button size="sm" variant="outline" onClick={onAcknowledge} className="bg-white">
                  Acknowledge
                </Button>
              )}

              {onProceedAnyway && (
                <Button
                  size="sm"
                  variant={severity === 'critical' ? 'destructive' : 'outline'}
                  onClick={onProceedAnyway}
                  className={severity !== 'critical' ? 'bg-white' : ''}
                >
                  {severity === 'critical' ? 'Proceed Anyway (Risky)' : 'Proceed Anyway'}
                </Button>
              )}

              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline Anomaly Warning
 *
 * Smaller version for inline display during form validation
 */
interface InlineAnomalyWarningProps {
  severity: 'medium' | 'high' | 'critical';
  description: string;
  onDetails?: () => void;
}

export function InlineAnomalyWarning({
  severity,
  description,
  onDetails,
}: InlineAnomalyWarningProps) {
  const Icon = severity === 'critical' ? XCircle : AlertTriangle;

  const colorClass =
    severity === 'critical'
      ? 'border-red-200 bg-red-50 text-red-800'
      : severity === 'high'
        ? 'border-orange-200 bg-orange-50 text-orange-800'
        : 'border-yellow-200 bg-yellow-50 text-yellow-800';

  return (
    <div className={`flex items-start gap-2 rounded-md border p-2 ${colorClass} text-sm`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">Warning:</span> {description}
        {onDetails && (
          <button type="button" onClick={onDetails} className="ml-2 underline hover:no-underline">
            Details
          </button>
        )}
      </div>
    </div>
  );
}
