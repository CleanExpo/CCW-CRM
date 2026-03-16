'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';

interface PendingFeed {
  feed_id: string;
  transaction_date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  bank_account_name: string;
  match_suggestions: Array<{
    pos_transaction_id: string;
    transaction_number: string;
    amount: number;
    date: string;
    payment_method: string;
    confidence: number;
    match_reasons: string[];
  }>;
  created_at: string;
}

interface PendingMatchesTableProps {
  onReconciled?: () => void;
}

interface BulkApprovalResponse {
  approved: number;
  failed: number;
}

export function PendingMatchesTable({ onReconciled }: PendingMatchesTableProps) {
  const [feeds, setFeeds] = useState<PendingFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedMatches, setSelectedMatches] = useState<Map<string, string>>(new Map()); // feed_id -> pos_transaction_id
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const { toast } = useToast();

  const fetchPendingFeeds = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<PendingFeed[]>(
        '/api/reconciliation/pending?with_suggestions_only=true&limit=50'
      );
      setFeeds(data);
    } catch (error: unknown) {
      toast({
        title: 'Error loading pending feeds',
        description: error instanceof Error ? error.message : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRow = (feedId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(feedId)) {
      newExpanded.delete(feedId);
    } else {
      newExpanded.add(feedId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSelectMatch = (feedId: string, posTransactionId: string) => {
    const newSelected = new Map(selectedMatches);
    if (newSelected.get(feedId) === posTransactionId) {
      // Deselect
      newSelected.delete(feedId);
    } else {
      // Select
      newSelected.set(feedId, posTransactionId);
    }
    setSelectedMatches(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedMatches.size === 0) {
      toast({
        title: 'No matches selected',
        description: 'Please select at least one match to approve',
        variant: 'destructive',
      });
      return;
    }

    setIsBulkApproving(true);

    try {
      const approvals = Array.from(selectedMatches.entries()).map(
        ([feed_id, pos_transaction_id]) => ({
          feed_id,
          pos_transaction_id,
        })
      );

      const result = await apiClient.post<BulkApprovalResponse>(
        '/api/reconciliation/bulk-approve',
        {
          approvals,
        }
      );

      toast({
        title: 'Bulk approval complete',
        description: `Approved ${result.approved} matches. ${
          result.failed > 0 ? `Failed: ${result.failed}` : ''
        }`,
      });

      // Clear selections and refresh
      setSelectedMatches(new Map());
      await fetchPendingFeeds();
      onReconciled?.();
    } catch (error: unknown) {
      toast({
        title: 'Bulk approval failed',
        description: error instanceof Error ? error.message : 'Failed to approve matches',
        variant: 'destructive',
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground text-center">Loading pending feeds...</div>
      </Card>
    );
  }

  if (feeds.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground text-center">
          No pending feeds with AI suggestions. All caught up! 🎉
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">Pending Matches with AI Suggestions</h3>
          <Badge variant="secondary">{feeds.length} items</Badge>
        </div>
        {selectedMatches.size > 0 && (
          <Button size="sm" onClick={handleBulkApprove} disabled={isBulkApproving}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isBulkApproving ? 'Approving...' : `Approve ${selectedMatches.size} Selected`}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Bank Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Suggestions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeds.map((feed) => (
              <>
                <TableRow key={feed.feed_id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(feed.feed_id)}
                      className="h-8 w-8 p-0"
                    >
                      {expandedRows.has(feed.feed_id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>{formatDate(feed.transaction_date)}</TableCell>
                  <TableCell>{feed.bank_account_name}</TableCell>
                  <TableCell className="max-w-md truncate">{feed.description || '-'}</TableCell>
                  <TableCell>{feed.reference || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${feed.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {feed.match_suggestions.length} suggestion
                      {feed.match_suggestions.length !== 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                </TableRow>

                {/* Expanded Row - Suggestions */}
                {expandedRows.has(feed.feed_id) && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30">
                      <div className="space-y-3 p-4">
                        <h4 className="text-sm font-medium">AI Match Suggestions</h4>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {feed.match_suggestions.map((suggestion) => (
                            <SuggestionCard
                              key={suggestion.pos_transaction_id}
                              suggestion={suggestion}
                              feedAmount={feed.amount}
                              isSelected={
                                selectedMatches.get(feed.feed_id) === suggestion.pos_transaction_id
                              }
                              onSelect={() =>
                                handleSelectMatch(feed.feed_id, suggestion.pos_transaction_id)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
