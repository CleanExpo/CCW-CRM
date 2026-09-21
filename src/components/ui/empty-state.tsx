import * as React from 'react';
import { AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center',
        className
      )}
      {...props}
    >
      <Icon className="text-muted-foreground mb-4 h-12 w-12" aria-hidden="true" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-sm text-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Short statement of what failed, e.g. "Couldn't load customers". */
  title: string;
  description?: string;
  /** Re-runs the failed read. The Retry button is only shown when this is set. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * The failed-read counterpart to EmptyState. A read that failed must never
 * render as a read that succeeded and found nothing, so list pages show this
 * in place of their "No X found" message when the load errored.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  className,
  ...props
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={className} {...props}>
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <AlertTitle>{title}</AlertTitle>
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
      </div>
    </Alert>
  );
}
