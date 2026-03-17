'use client';

import * as React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  onError?: (error: unknown, info: React.ErrorInfo) => void;
  onReset?: () => void;
}

function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-destructive h-5 w-5" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
          {isDev && errorStack && (
            <details className="mt-2">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                Show error details
              </summary>
              <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">{errorStack}</pre>
            </details>
          )}
          <Button onClick={resetErrorBoundary} className="w-full">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorBoundary({
  children,
  fallback: FallbackComponent,
  onError,
  onReset,
}: ErrorBoundaryProps) {
  const handleError = React.useCallback(
    (error: unknown, info: React.ErrorInfo) => {
      // Log to console in all environments
      console.error('ErrorBoundary caught error:', error, info);

      // Call custom error handler if provided
      onError?.(error, info);
    },
    [onError]
  );

  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent || DefaultErrorFallback}
      onError={handleError}
      onReset={onReset}
    >
      {children}
    </ReactErrorBoundary>
  );
}
