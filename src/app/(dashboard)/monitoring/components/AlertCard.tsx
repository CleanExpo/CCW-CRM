'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { acknowledgeAlert, resolveAlert, type Alert } from '@/lib/api/monitoring';
import { useToast } from '@/hooks/use-toast';

interface AlertCardProps {
  alert: Alert;
  onUpdate: () => void;
}

export function AlertCard({ alert, onUpdate }: AlertCardProps) {
  const { toast } = useToast();
  const [acknowledging, setAcknowledging] = useState(false);
  const [resolving, setResolving] = useState(false);

  const severityConfig = {
    critical: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'border-red-500/50 bg-red-500/5',
      badgeVariant: 'destructive' as const,
    },
    error: {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      bgColor: 'border-orange-500/50 bg-orange-500/5',
      badgeVariant: 'destructive' as const,
    },
    warning: {
      icon: Clock,
      iconColor: 'text-yellow-500',
      bgColor: 'border-yellow-500/50 bg-yellow-500/5',
      badgeVariant: 'secondary' as const,
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      bgColor: 'border-blue-500/50 bg-blue-500/5',
      badgeVariant: 'secondary' as const,
    },
  };

  const config = severityConfig[alert.severity] || severityConfig.info;
  const Icon = config.icon;

  async function handleAcknowledge() {
    setAcknowledging(true);
    try {
      await acknowledgeAlert(alert.id);
      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been marked as acknowledged.',
      });
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    } finally {
      setAcknowledging(false);
    }
  }

  async function handleResolve() {
    setResolving(true);
    try {
      await resolveAlert(alert.id);
      toast({
        title: 'Alert Resolved',
        description: 'The alert has been marked as resolved.',
      });
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve alert',
        variant: 'destructive',
      });
    } finally {
      setResolving(false);
    }
  }

  return (
    <Card className={config.bgColor}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{alert.title}</p>
            <Badge variant={config.badgeVariant} className="px-1.5 py-0 text-[10px]">
              {alert.severity.toUpperCase()}
            </Badge>
            {alert.acknowledged && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Acknowledged
              </Badge>
            )}
            {alert.resolved && (
              <Badge
                variant="outline"
                className="border-green-500 px-1.5 py-0 text-[10px] text-green-600"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Resolved
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm">{alert.message}</p>

          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div className="text-muted-foreground bg-muted/50 rounded p-2 text-xs">
              <p className="mb-1 font-medium">Details:</p>
              <ul className="space-y-0.5">
                {Object.entries(alert.metadata).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{key}:</span> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <p className="text-muted-foreground text-xs">
              {new Date(alert.created_at).toLocaleString('en-AU')}
            </p>
            {alert.acknowledged_at && (
              <p className="text-muted-foreground text-xs">
                • Acknowledged: {new Date(alert.acknowledged_at).toLocaleString('en-AU')}
              </p>
            )}
            {alert.resolved_at && (
              <p className="text-muted-foreground text-xs">
                • Resolved: {new Date(alert.resolved_at).toLocaleString('en-AU')}
              </p>
            )}
          </div>

          {!alert.resolved && (
            <div className="flex items-center gap-2 pt-2">
              {!alert.acknowledged && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                >
                  {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                </Button>
              )}
              <Button size="sm" variant="default" onClick={handleResolve} disabled={resolving}>
                {resolving ? 'Resolving...' : 'Resolve'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
