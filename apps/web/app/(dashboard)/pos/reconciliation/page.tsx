"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api/client";
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";

interface POSTransaction {
  id: string;
  transaction_number: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  location_code: string;
  bank_statement_ref: string | null;
  reconciliation_status: string;
  created_at: string;
}

interface BankFeed {
  id: string;
  transaction_date: string;
  description: string;
  reference: string;
  credit: number;
  debit: number;
  balance: number;
  match_status: string;
  match_confidence: number | null;
  matched_pos_transaction_id: string | null;
}

interface ReconciliationPair {
  pos: POSTransaction;
  bankFeed: BankFeed;
  confidence: number;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [unreconciledPOS, setUnreconciledPOS] = useState<POSTransaction[]>([]);
  const [unreconciledBankFeeds, setUnreconciledBankFeeds] = useState<BankFeed[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<ReconciliationPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPOS, setSelectedPOS] = useState<POSTransaction | null>(null);
  const [selectedBankFeed, setSelectedBankFeed] = useState<BankFeed | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    loadUnreconciledData();
  }, [locationFilter]);

  async function loadUnreconciledData() {
    setIsLoading(true);
    try {
      // Load unreconciled POS transactions
      const posParams = new URLSearchParams({
        reconciliation_status: "pending",
      });
      if (locationFilter !== "all") {
        posParams.append("location_code", locationFilter);
      }

      const posResponse = await apiClient.get<{ data: POSTransaction[] }>(
        `/api/pos/transactions?${posParams.toString()}`
      );
      setUnreconciledPOS(posResponse.data || []);

      // Load unreconciled bank feeds
      const bankResponse = await apiClient.get<{ data: BankFeed[] }>(
        "/api/bank-feeds/unreconciled"
      );
      setUnreconciledBankFeeds(bankResponse.data || []);

      // Find suggested matches (client-side matching algorithm)
      const matches = findSuggestedMatches(
        posResponse.data || [],
        bankResponse.data || []
      );
      setSuggestedMatches(matches);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load reconciliation data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function findSuggestedMatches(
    posTransactions: POSTransaction[],
    bankFeeds: BankFeed[]
  ): ReconciliationPair[] {
    const matches: ReconciliationPair[] = [];
    const tolerance = 0.10; // ±10 cents

    for (const pos of posTransactions) {
      for (const bank of bankFeeds) {
        // Only match credits (money in)
        if (!bank.credit || bank.credit <= 0) continue;

        // Check amount match (within tolerance)
        const amountDiff = Math.abs(bank.credit - pos.amount);
        if (amountDiff > tolerance) continue;

        // Calculate confidence score
        let confidence = 0;

        // Amount exact match: +50%
        if (amountDiff === 0) {
          confidence += 0.5;
        } else if (amountDiff <= tolerance) {
          confidence += 0.3;
        }

        // Date match: +30% (within ±3 days)
        const posDate = new Date(pos.created_at);
        const bankDate = new Date(bank.transaction_date);
        const daysDiff = Math.abs(
          (posDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 0) {
          confidence += 0.3;
        } else if (daysDiff <= 1) {
          confidence += 0.2;
        }

        // Reference match: +20%
        if (
          bank.reference &&
          pos.transaction_number &&
          (bank.reference.includes(pos.transaction_number) ||
            pos.transaction_number.includes(bank.reference))
        ) {
          confidence += 0.2;
        }

        // Only suggest if confidence > 60%
        if (confidence >= 0.6) {
          matches.push({ pos, bankFeed: bank, confidence });
        }
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  async function handleManualMatch(pos: POSTransaction, bankFeed: BankFeed) {
    setSelectedPOS(pos);
    setSelectedBankFeed(bankFeed);
    setShowMatchDialog(true);
  }

  async function confirmMatch() {
    if (!selectedPOS || !selectedBankFeed) return;

    try {
      await apiClient.post("/api/bank-feeds/reconcile", {
        bank_feed_id: selectedBankFeed.id,
        pos_transaction_id: selectedPOS.id,
      });

      toast({
        title: "Success",
        description: "Transactions matched successfully",
      });

      // Reload data
      loadUnreconciledData();
      setShowMatchDialog(false);
      setSelectedPOS(null);
      setSelectedBankFeed(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to match transactions",
        variant: "destructive",
      });
    }
  }

  async function handleAutoReconcile() {
    try {
      const response = await apiClient.post<{ auto_matched: number }>(
        "/api/bank-feeds/auto-reconcile"
      );

      toast({
        title: "Auto-Reconciliation Complete",
        description: `Matched ${response.auto_matched} transactions automatically`,
      });

      loadUnreconciledData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Auto-reconciliation failed",
        variant: "destructive",
      });
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
          <p className="text-muted-foreground">
            Match POS transactions with bank feed data
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="brisbane">Brisbane</SelectItem>
              <SelectItem value="sydney">Sydney</SelectItem>
              <SelectItem value="melbourne">Melbourne</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleAutoReconcile}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Auto-Reconcile
          </Button>

          <Button variant="outline" onClick={loadUnreconciledData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unreconciled POS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreconciledPOS.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unmatched Bank Feeds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreconciledBankFeeds.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suggested Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suggestedMatches.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto-Match Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suggestedMatches.length > 0
                ? Math.round(
                    (suggestedMatches.filter((m) => m.confidence >= 0.8).length /
                      suggestedMatches.length) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suggested Matches */}
      {suggestedMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Matches</CardTitle>
            <CardDescription>
              High-confidence matches ready for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suggestedMatches.slice(0, 10).map((match, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* POS Transaction */}
                  <div className="flex-1">
                    <p className="font-medium">{match.pos.transaction_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(match.pos.created_at)} · {match.pos.location_code}
                    </p>
                    <p className="text-sm font-bold">
                      {formatCurrency(match.pos.amount)}
                    </p>
                  </div>

                  {/* Match Indicator */}
                  <div className="flex items-center gap-2 px-4">
                    <Badge
                      variant={
                        match.confidence >= 0.8
                          ? "default"
                          : match.confidence >= 0.7
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {Math.round(match.confidence * 100)}% match
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Bank Feed */}
                  <div className="flex-1">
                    <p className="font-medium">{match.bankFeed.reference}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(match.bankFeed.transaction_date)}
                    </p>
                    <p className="text-sm font-bold">
                      {formatCurrency(match.bankFeed.credit)}
                    </p>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => handleManualMatch(match.pos, match.bankFeed)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Match
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unreconciled Transactions - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* POS Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Unreconciled POS Transactions</CardTitle>
            <CardDescription>
              {unreconciledPOS.length} pending reconciliation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {unreconciledPOS.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All POS transactions reconciled
                </p>
              ) : (
                unreconciledPOS.map((pos) => (
                  <div
                    key={pos.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPOS(pos)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{pos.transaction_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(pos.created_at)} · {pos.location_code}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {pos.payment_method}
                        </Badge>
                      </div>
                      <p className="font-bold">{formatCurrency(pos.amount)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bank Feeds */}
        <Card>
          <CardHeader>
            <CardTitle>Unmatched Bank Feeds</CardTitle>
            <CardDescription>
              {unreconciledBankFeeds.length} unmatched deposits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {unreconciledBankFeeds.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All bank feeds matched
                </p>
              ) : (
                unreconciledBankFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedBankFeed(feed)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{feed.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(feed.transaction_date)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {feed.description}
                        </p>
                      </div>
                      <p className="font-bold">{formatCurrency(feed.credit)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match Confirmation Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Match</DialogTitle>
            <DialogDescription>
              Review and confirm this transaction match
            </DialogDescription>
          </DialogHeader>

          {selectedPOS && selectedBankFeed && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    POS Transaction
                  </p>
                  <p className="font-medium">{selectedPOS.transaction_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedPOS.created_at)}
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {formatCurrency(selectedPOS.amount)}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Bank Feed
                  </p>
                  <p className="font-medium">{selectedBankFeed.reference}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedBankFeed.transaction_date)}
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {formatCurrency(selectedBankFeed.credit)}
                  </p>
                </div>
              </div>

              {Math.abs(selectedPOS.amount - selectedBankFeed.credit) > 0.01 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-600">
                    Amount difference:{" "}
                    {formatCurrency(
                      Math.abs(selectedPOS.amount - selectedBankFeed.credit)
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMatch}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
