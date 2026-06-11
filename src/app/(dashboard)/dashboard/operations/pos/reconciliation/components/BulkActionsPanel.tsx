'use client';

/**
 * BulkActionsPanel — UNI-2113
 *
 * Provides two bulk-match modes:
 *
 * 1. Auto-Match: for each selected bank-feed, find a POS transaction whose
 *    amount matches within $0.10 tolerance, then call POST /api/bank-feeds/bulk-reconcile.
 *
 * 2. Manual Bulk Match: user explicitly selects N bank-feed IDs AND N POS
 *    transaction IDs (passed in via props from the parent page), pairs them
 *    positionally (index 0 ↔ index 0, etc.), then submits to the same endpoint.
 *    The response itemises any partial failures so the user knows exactly
 *    which pairs did not reconcile.
 *
 * Both paths call the same endpoint which enforces auth/workspace scoping and
 * writes an immutable audit record for every pair (success or failure).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, XSquare, Zap, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bulkReconcile, type ReconcileMatch } from '@/lib/api/pos';

// ── Failure detail returned by the endpoint ─────────────────────────────────

interface MatchFailure {
  bank_feed_id: string;
  pos_transaction_id: string;
  reason: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface BulkActionsPanelProps {
  /** Currently selected bank-feed IDs (for auto-match mode). */
  selectedItems: Set<string>;
  onClearSelection: () => void;
  onSuccess: () => void;
  bankFeedData: Array<{ id: string; amount: number }>;
  posTransactionData: Array<{ id: string; amount: number }>;
  /**
   * Explicit pairs provided by the parent page for manual bulk-match mode.
   * When present the "Manual Bulk Match" button is enabled and submits these
   * exact pairs rather than deriving them from selectedItems.
   */
  manualPairs?: ReconcileMatch[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkActionsPanel({
  selectedItems,
  onClearSelection,
  onSuccess,
  bankFeedData,
  posTransactionData,
  manualPairs,
}: BulkActionsPanelProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showAutoMatchDialog, setShowAutoMatchDialog] = useState(false);
  const [showManualMatchDialog, setShowManualMatchDialog] = useState(false);

  // ── Partial-failure result state ─────────────────────────────────────────
  const [partialFailures, setPartialFailures] = useState<MatchFailure[]>([]);
  const [showFailuresDialog, setShowFailuresDialog] = useState(false);

  const selectedCount = selectedItems.size;
  const manualPairCount = manualPairs?.length ?? 0;

  // ── Submit helper ────────────────────────────────────────────────────────

  async function submitMatches(matches: ReconcileMatch[], mode: 'auto' | 'manual') {
    setIsLoading(true);
    try {
      const result = await bulkReconcile(matches);

      // Surface partial failures explicitly
      const failures = (result as typeof result & { failures?: MatchFailure[] }).failures ?? [];

      if (result.failed_count > 0 && failures.length > 0) {
        setPartialFailures(failures);
        setShowFailuresDialog(true);
        toast({
          title: `${mode === 'auto' ? 'Auto-Match' : 'Manual Match'} — partial success`,
          description: `${result.matched_count} succeeded, ${result.failed_count} failed. See details below.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: `${mode === 'auto' ? 'Auto-Match' : 'Manual Match'} Complete`,
          description: `Successfully matched ${result.matched_count} transaction${result.matched_count === 1 ? '' : 's'}.`,
        });
        onClearSelection();
        onSuccess();
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process matches',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowAutoMatchDialog(false);
      setShowManualMatchDialog(false);
    }
  }

  // ── Auto-match handler ───────────────────────────────────────────────────

  async function handleAutoMatch() {
    const matches: ReconcileMatch[] = [];

    selectedItems.forEach((bankFeedId) => {
      const bankFeed = bankFeedData.find((bf) => bf.id === bankFeedId);
      if (!bankFeed) return;

      // Find POS transaction with matching amount within $0.10 tolerance
      const potentialMatch = posTransactionData.find(
        (pos) => Math.abs(pos.amount - Math.abs(bankFeed.amount)) <= 0.1
      );

      if (potentialMatch) {
        matches.push({ bank_feed_id: bankFeedId, pos_transaction_id: potentialMatch.id });
      }
    });

    if (matches.length === 0) {
      toast({
        title: 'No Matches Found',
        description: 'Could not find any POS transactions within $0.10 of the selected bank feeds.',
        variant: 'destructive',
      });
      setShowAutoMatchDialog(false);
      return;
    }

    await submitMatches(matches, 'auto');
  }

  // ── Manual bulk-match handler ────────────────────────────────────────────

  async function handleManualMatch() {
    if (!manualPairs || manualPairs.length === 0) return;
    await submitMatches(manualPairs, 'manual');
  }

  // ── Render guard ─────────────────────────────────────────────────────────

  if (selectedCount === 0 && manualPairCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-primary h-5 w-5" />
                <span className="font-medium">
                  {selectedCount > 0 && (
                    <>
                      {selectedCount} bank feed{selectedCount === 1 ? '' : 's'} selected
                    </>
                  )}
                  {selectedCount > 0 && manualPairCount > 0 && ' · '}
                  {manualPairCount > 0 && (
                    <>
                      {manualPairCount} manual pair{manualPairCount === 1 ? '' : 's'} ready
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAutoMatchDialog(true)}
                  disabled={isLoading}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Auto-Match Selected
                </Button>
              )}

              {manualPairCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowManualMatchDialog(true)}
                  disabled={isLoading}
                >
                  <Link className="mr-2 h-4 w-4" />
                  Bulk Match ({manualPairCount} pairs)
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={onClearSelection} disabled={isLoading}>
                <XSquare className="mr-2 h-4 w-4" />
                Clear Selection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Auto-Match Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={showAutoMatchDialog} onOpenChange={setShowAutoMatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auto-Match Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to automatically match {selectedCount} selected bank feed
              {selectedCount === 1 ? '' : 's'} with POS transactions based on amount (within $0.10
              tolerance).
              <br />
              <br />
              Matches that pass validation will be reconciled. Any failures will be listed without
              affecting the successful matches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAutoMatch} disabled={isLoading}>
              {isLoading ? 'Processing…' : 'Auto-Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Manual Bulk-Match Confirmation ──────────────────────────────── */}
      <AlertDialog open={showManualMatchDialog} onOpenChange={setShowManualMatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Match {manualPairCount} Pairs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reconcile {manualPairCount} explicitly paired bank feed → POS transaction
              {manualPairCount === 1 ? '' : 's'}. Pairs that fail validation are reported without
              blocking the successful ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualMatch} disabled={isLoading}>
              {isLoading ? 'Processing…' : 'Confirm Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Partial-Failure Report ───────────────────────────────────────── */}
      <AlertDialog open={showFailuresDialog} onOpenChange={setShowFailuresDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Some Matches Failed</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  The following {partialFailures.length} pair
                  {partialFailures.length === 1 ? '' : 's'} could not be reconciled. All other
                  pairs succeeded.
                </p>
                <ul className="space-y-2 text-sm">
                  {partialFailures.map((f, i) => (
                    <li key={i} className="rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Failed</Badge>
                        <span className="font-mono text-xs truncate">{f.bank_feed_id}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{f.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowFailuresDialog(false);
                onClearSelection();
                onSuccess();
              }}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
