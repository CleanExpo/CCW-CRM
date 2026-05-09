import { Suspense } from 'react';
import { SettingsHubClient } from './settings-hub-client';

function HubFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
      Loading settings…
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<HubFallback />}>
      <SettingsHubClient />
    </Suspense>
  );
}
