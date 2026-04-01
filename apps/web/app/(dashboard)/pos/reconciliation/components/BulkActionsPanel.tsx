'use client';

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
import { CheckSquare, XSquare, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bulkReconcile } from '@/lib/api/pos';

interface BulkActionsPanelProps {
  selectedItems: Set<string>;
  onClearSelection: () => void;
  onSuccess: () => void;
  bankFeedData: Array<{
    id: string;
    amount: number;
  }>;
  posTransactionData: Array<{
    id: string;
    amount: number;
  }>;
}

export function BulkActionsPanel({
  selectedItems,
  onClearSelection,
  onSuccess,
  bankFeedData,
  posTransactionData,
}: BulkActionsPanelProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showAutoMatchDialog, setShowAutoMatchDialog] = useState(false);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);

  const selectedCount = selectedItems.size;

  const handleAutoMatch = async () => {
    setIsLoading(true);
    try {
      // Find potential matches for selected bank feeds
      const matches: Array<{ bank_feed_id: string; pos_transaction_id: string }> = [];

      selectedItems.forEach((bankFeedId) => {
        const bankFeed = bankFeedData.find((bf) => bf.id === bankFeedId);
        if (!bankFeed) return;

        // Find POS transaction with matching amount (within $0.10)
        const potentialMatch = posTransactionData.find(
          (pos) => Math.abs(pos.amount - Math.abs(bankFeed.amount)) <= 0.1
        );

        if (potentialMatch) {
          matches.push({
            bank_feed_id: bankFeedId,
            pos_transaction_id: potentialMatch.id,
          });
        }
      });

      if (matches.length === 0) {
        toast({
          title: 'No Matches Found',
          description: 'Could not find any matching POS transactions for the selected items.',
          variant: 'destructive',
        });
        setShowAutoMatchDialog(false);
        return;
      }

      // Bulk reconcile
      const result = await bulkReconcile(matches);

      toast({
        title: 'Auto-Match Complete',
        description: `Successfully matched ${result.matched_count} of ${selectedCount} transactions. ${result.failed_count} failed.`,
      });

      onClearSelection();
      onSuccess();
      setShowAutoMatchDialog(false);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to auto-match transactions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReconcile = async () => {
    // For manual bulk reconcile, we need user to have already paired them
    // This is just a placeholder - in real implementation, user would select pairs
    toast({
      title: 'Not Implemented',
      description:
        'Manual bulk reconcile requires pre-paired transactions. Use auto-match instead.',
      variant: 'destructive',
    });
    setShowReconcileDialog(false);
  };

  if (selectedCount === 0) {
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
                  {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAutoMatchDialog(true)}
                disabled={isLoading}
              >
                <Zap className="mr-2 h-4 w-4" />
                Auto-Match Selected
              </Button>

              <Button variant="outline" size="sm" onClick={onClearSelection} disabled={isLoading}>
                <XSquare className="mr-2 h-4 w-4" />
                Clear Selection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Match Confirmation Dialog */}
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
              Matches found will be automatically reconciled. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAutoMatch} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Auto-Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reconcile Confirmation Dialog */}
      <AlertDialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Reconcile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reconcile {selectedCount} selected transaction
              {selectedCount === 1 ? '' : 's'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkReconcile} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Reconcile'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
