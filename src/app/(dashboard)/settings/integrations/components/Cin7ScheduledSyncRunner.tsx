'use client';

import { useEffect, useRef } from 'react';

import { getCin7ScheduledSyncStatus, type Cin7ScheduledSyncStatus } from '@/lib/api/cin7';
import {
  CIN7_LIVE_RECON_REFRESHED_EVENT,
  cin7EntityCompletionFingerprint,
  cin7ScheduleStatusPollDelayMs,
} from '@/lib/integrations/cin7-scheduled-sync';

type Props = {
  isConnected: boolean;
  manualBusy?: boolean;
  onScheduledBusyChange?: (busy: boolean) => void;
  onLogsMayHaveChanged?: () => void;
  onLiveEntities?: (status: Cin7ScheduledSyncStatus) => void;
};

function completionKey(status: Cin7ScheduledSyncStatus): string {
  const fromLedger = Object.entries(status.last_run?.entity_results ?? {}).map(([entity, row]) => ({
    entity,
    status: row.complete ? 'complete' : (row.status ?? ''),
  }));
  const fromLive = (status.live_entities ?? []).map((row) => ({
    entity: row.entity,
    status: row.status,
  }));
  return cin7EntityCompletionFingerprint({
    running: status.running,
    currentEntity: status.current_entity,
    lastRunId: status.last_run?.id ?? null,
    lastRunStatus: status.last_run?.overall_status ?? null,
    entityStatuses: fromLedger.length > 0 ? fromLedger : fromLive,
  });
}

/**
 * Quiet schedule note plus background status pulls so Recent sync still
 * updates when an entity finishes. Does not render a live progress banner.
 */
export function Cin7ScheduledSyncRunner({
  isConnected,
  onScheduledBusyChange,
  onLogsMayHaveChanged,
  onLiveEntities,
}: Props) {
  const wasRunningRef = useRef(false);
  const completionRef = useRef<string>('');
  const onBusyRef = useRef(onScheduledBusyChange);
  const onLogsRef = useRef(onLogsMayHaveChanged);
  const onLiveRef = useRef(onLiveEntities);
  onBusyRef.current = onScheduledBusyChange;
  onLogsRef.current = onLogsMayHaveChanged;
  onLiveRef.current = onLiveEntities;

  useEffect(() => {
    if (!isConnected) {
      onBusyRef.current?.(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async () => {
      try {
        const next = await getCin7ScheduledSyncStatus();
        if (cancelled) return;
        onBusyRef.current?.(next.running);
        onLiveRef.current?.(next);

        const key = completionKey(next);
        const finished = wasRunningRef.current && !next.running;
        if (key !== completionRef.current) {
          completionRef.current = key;
          if (next.running || wasRunningRef.current) {
            onLogsRef.current?.();
          }
        }
        if (finished && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(CIN7_LIVE_RECON_REFRESHED_EVENT));
        }
        wasRunningRef.current = next.running;

        const delay = cin7ScheduleStatusPollDelayMs({
          running: next.running,
          nextFireAt: next.next_fire_at ? new Date(next.next_fire_at) : null,
        });
        timer = setTimeout(() => {
          void pull();
        }, delay);
      } catch {
        if (cancelled) return;
        timer = setTimeout(
          () => {
            void pull();
          },
          cin7ScheduleStatusPollDelayMs({ running: false, nextFireAt: null })
        );
      }
    };

    void pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isConnected]);

  if (!isConnected) return null;

  return (
    <p className="text-muted-foreground text-xs">
      Scheduled sync: 5:00 AM and 9:00 PM Australia/Sydney.
    </p>
  );
}
