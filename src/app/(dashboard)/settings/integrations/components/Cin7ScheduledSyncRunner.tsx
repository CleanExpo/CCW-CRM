'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/hooks/use-toast';
import { getCin7SyncLogs, syncCin7EntityUntilComplete, type Cin7SyncLog } from '@/lib/api/cin7';
import {
  CIN7_CLIENT_SYNC_ENTITY_ORDER,
  formatCountdownUntil,
  formatScheduledFireAt,
  getCin7ScheduledSyncEnv,
  getNextCin7ScheduledFireAt,
  hasScheduledRunCompleted,
  markScheduledRunCompleted,
  parseCin7ScheduledSyncAt,
  scheduledRunStorageKey,
  type Cin7ClientSyncEntity,
} from '@/lib/integrations/cin7-client-sync-scheduler';

type Props = {
  isConnected: boolean;
  /** True while a manual sync/poll is in progress — scheduled run waits. */
  manualBusy: boolean;
  onScheduledBusyChange?: (busy: boolean) => void;
  onLogsMayHaveChanged?: () => void;
};

/**
 * Client-only scheduler: when NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT is due,
 * clicks through each sync entity one-by-one (same APIs as the Sync buttons).
 * Keep the Integrations page open for the run to fire.
 */
export function Cin7ScheduledSyncRunner({
  isConnected,
  manualBusy,
  onScheduledBusyChange,
  onLogsMayHaveChanged,
}: Props) {
  const { toast } = useToast();
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [activeEntity, setActiveEntity] = useState<string | null>(null);
  const runningRef = useRef(false);
  const manualBusyRef = useRef(manualBusy);
  manualBusyRef.current = manualBusy;

  const syncOneEntityLikeButtonClick = useCallback(
    async (entityType: Cin7ClientSyncEntity, prior: Cin7SyncLog | undefined) => {
      // Same rules as Sync buttons — resume incomplete; restart after complete.
      const restart = !prior || prior.status === 'complete';
      const contactFull =
        entityType === 'customers' ||
        entityType === 'internal-customers' ||
        entityType === 'suppliers';

      setActiveEntity(entityType);
      setStatusLine(`Syncing ${entityType.replace(/-/g, ' ')}…`);

      const result = await syncCin7EntityUntilComplete(entityType, {
        restart,
        full: contactFull,
        maxRounds: contactFull ? 60 : 40,
        maxChunksPerRound: 8,
        onProgress: (partial) => {
          const count = partial.records_processed ?? 0;
          setStatusLine(
            `Syncing ${entityType.replace(/-/g, ' ')}… ${count.toLocaleString()} records`
          );
          onLogsMayHaveChanged?.();
        },
      });

      onLogsMayHaveChanged?.();

      if (result.status === 'complete' || result.complete === true) {
        return { ok: true as const, result };
      }
      return { ok: false as const, result };
    },
    [onLogsMayHaveChanged]
  );

  const runSequentialSync = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    onScheduledBusyChange?.(true);
    toast({
      title: 'Scheduled Cin7 sync started',
      description: 'Running each entity one-by-one (same as Sync buttons). Keep this page open.',
    });

    const outcomes: string[] = [];
    try {
      for (const entity of CIN7_CLIENT_SYNC_ENTITY_ORDER) {
        // Wait out any manual sync the user started.
        while (manualBusyRef.current) {
          setStatusLine('Waiting for manual sync to finish…');
          await new Promise((r) => setTimeout(r, 2000));
        }

        let prior: Cin7SyncLog | undefined;
        try {
          const { logs } = await getCin7SyncLogs();
          prior = logs.find((l) => l.entity_type === entity);
        } catch {
          prior = undefined;
        }

        try {
          const { ok, result } = await syncOneEntityLikeButtonClick(entity, prior);
          const count = result.records_processed ?? 0;
          outcomes.push(
            ok ? `${entity}: complete (${count})` : `${entity}: ${result.status ?? 'failed'}`
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          outcomes.push(`${entity}: error (${message})`);
        }

        onLogsMayHaveChanged?.();
      }

      toast({
        title: 'Scheduled Cin7 sync finished',
        description: outcomes.slice(0, 4).join(' · ') + (outcomes.length > 4 ? ' …' : ''),
      });
      setStatusLine('Scheduled sync finished.');
    } finally {
      setActiveEntity(null);
      runningRef.current = false;
      onScheduledBusyChange?.(false);
    }
  }, [onScheduledBusyChange, onLogsMayHaveChanged, syncOneEntityLikeButtonClick, toast]);

  useEffect(() => {
    if (!isConnected) {
      setStatusLine(null);
      return;
    }

    const raw = getCin7ScheduledSyncEnv();
    const spec = parseCin7ScheduledSyncAt(raw);
    if (!spec) {
      setStatusLine(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const waitingLine = (fireAt: Date) =>
      `Next scheduled sync: ${formatScheduledFireAt(fireAt)} · starts in ${formatCountdownUntil(fireAt)}. Keep this page open.`;

    const arm = () => {
      if (cancelled) return;
      const fireAt = getNextCin7ScheduledFireAt(spec);
      if (!fireAt) {
        if (spec.kind === 'once') {
          setStatusLine(`Scheduled sync for ${formatScheduledFireAt(spec.at)} has already passed.`);
        } else {
          setStatusLine(null);
        }
        return;
      }

      const key = scheduledRunStorageKey(spec, fireAt);
      if (hasScheduledRunCompleted(key)) {
        if (spec.kind === 'once') {
          setStatusLine(`Scheduled sync completed (${formatScheduledFireAt(fireAt)}).`);
          return;
        }
        // Daily: re-arm for tomorrow.
        const tomorrow = new Date(fireAt.getTime() + 24 * 60 * 60 * 1000);
        const next = getNextCin7ScheduledFireAt(spec, tomorrow);
        if (!next) return;
        const delay = Math.max(0, next.getTime() - Date.now());
        setStatusLine(waitingLine(next));
        timer = setTimeout(() => {
          void (async () => {
            const k = scheduledRunStorageKey(spec, next);
            if (hasScheduledRunCompleted(k) || runningRef.current) {
              arm();
              return;
            }
            markScheduledRunCompleted(k);
            await runSequentialSync();
            arm();
          })();
        }, delay);
        return;
      }

      const delayMs = Math.max(0, fireAt.getTime() - Date.now());
      setStatusLine(waitingLine(fireAt));

      timer = setTimeout(() => {
        void (async () => {
          if (cancelled || runningRef.current) return;
          if (hasScheduledRunCompleted(key)) {
            arm();
            return;
          }
          markScheduledRunCompleted(key);
          await runSequentialSync();
          arm();
        })();
      }, delayMs);
    };

    arm();
    const tick = setInterval(() => {
      // Refresh countdown text while waiting.
      if (runningRef.current || cancelled) return;
      const fireAt = getNextCin7ScheduledFireAt(spec);
      if (!fireAt) return;
      const key = scheduledRunStorageKey(spec, fireAt);
      if (hasScheduledRunCompleted(key)) return;
      setStatusLine(waitingLine(fireAt));
    }, 5_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(tick);
    };
  }, [isConnected, runSequentialSync]);

  if (!statusLine && !activeEntity) return null;

  return (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
      {activeEntity ? (
        <>
          Scheduled run in progress:{' '}
          <span className="font-medium">{activeEntity.replace(/-/g, ' ')}</span>
          {statusLine ? ` — ${statusLine}` : null}
        </>
      ) : (
        statusLine
      )}
    </p>
  );
}
