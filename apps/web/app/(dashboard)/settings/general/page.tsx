'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AU_TIMEZONE, formatDateTimeAU, getAuTimezoneLabel } from '@/lib/australian-context';

export default function GeneralSettingsPage() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-muted-foreground text-sm font-semibold uppercase">Timezone</h3>
            <p className="mt-1 text-2xl font-semibold" data-testid="timezone-label">
              {getAuTimezoneLabel(now)}
            </p>
            <p className="text-muted-foreground text-sm">
              IANA zone: <span className="font-mono">{AU_TIMEZONE}</span>
            </p>
          </div>

          <div>
            <h3 className="text-muted-foreground text-sm font-semibold uppercase">Current time</h3>
            <p className="mt-1 font-mono text-lg" data-testid="current-time">
              {formatDateTimeAU(now)}
            </p>
            <p className="text-muted-foreground text-sm">
              All scheduled jobs (Xero sync, BAS reports, backups) run against this zone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
