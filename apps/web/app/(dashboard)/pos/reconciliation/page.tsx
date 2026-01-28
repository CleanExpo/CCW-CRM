"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  location_code: string;
  feed_provider: string;
  last_feed_sync_at: string | null;
}

interface BankFeed {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string;
  credit: number | null;
  debit: number | null;
  balance: number | null;
}

interface POSTransaction {
  id: string;
  transaction_number: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  location_code: string;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [unreconciledFeeds, setUnreconciledFeeds] = useState<BankFeed[]>([]);
  const [unreconciledPOS, setUnreconciledPOS] = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<BankFeed | null>(null);
  const [selectedPOS, setSelectedPOS] = useState<POSTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  // Load bank accounts
  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiClient.get<BankAccount[]>("/api/bank-feeds/accounts");
      setAccounts(data);
      if (data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
  }, [selectedAccount]);

  // Load unreconciled data
  const loadUnreconciledData = useCallback(async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const [feeds, transactions] = await Promise.all([
        apiClient.get<BankFeed[]>(
          `/api/bank-feeds/unreconciled?account_id=${selectedAccount}`
        ),
        apiClient.get<{ items: POSTransaction[] }>(
          `/api/pos/transactions?reconciliation_status=pending&page_size=100`
        ),
      ]);

      setUnreconciledFeeds(feeds);
      setUnreconciledPOS(transactions.items || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reconciliation data",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, toast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccount) {
      loadUnreconciledData();
    }
  }, [selectedAccount, loadUnreconciledData]);

  // Sync bank feeds
  const handleSync = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      await apiClient.post("/api/bank-feeds/sync", {
        account_id: selectedAccount,
        start_date: thirtyDaysAgo.toISOString().split("T")[0],
        end_date: today.toISOString().split("T")[0],
      });

      toast({
        title: "Sync Complete",
        description: "Bank feeds have been synchronized",
      });

      await loadUnreconciledData();
    } catch (error) {
      console.error("Sync failed:", error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to sync bank feeds",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Open match dialog
  const handleMatchClick = (feed: BankFeed) => {
    setSelectedFeed(feed);
    setSelectedPOS(null);
    setMatchDialogOpen(true);
  };

  // Confirm reconciliation
  const handleConfirmMatch = async () => {
    if (!selectedFeed || !selectedPOS) return;

    try {
      await apiClient.post("/api/bank-feeds/reconcile", {
        feed_id: selectedFeed.id,
        pos_transaction_id: selectedPOS.id,
      });

      toast({
        title: "Reconciled",
        description: `Matched ${selectedFeed.reference} to ${selectedPOS.transaction_number}`,
      });

      setMatchDialogOpen(false);
      await loadUnreconciledData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Match Failed",
        description: error.message || "Failed to reconcile transactions",
      });
    }
  };

  // Filter POS transactions for matching
  const filteredPOS = unreconciledPOS.filter((t) => {
    if (!searchTerm) return true;
    return (
      t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.amount.toString().includes(searchTerm)
    );
  });

  // Find potential matches based on amount
  const findPotentialMatches = (feed: BankFeed) => {
    const feedAmount = feed.credit || 0;
    return unreconciledPOS.filter((t) => Math.abs(t.amount - feedAmount) < 0.11);
  };

  const selectedAccountData = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
          <p className="text-muted-foreground">
            Match bank transactions to POS sales
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !selectedAccount}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Bank Feeds"}
        </Button>
      </div>

      {/* Account Selector */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name} (****{account.account_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccountData && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedAccountData.bank_name}</span>
                {selectedAccountData.last_feed_sync_at && (
                  <span className="ml-4">
                    Last sync:{" "}
                    {format(new Date(selectedAccountData.last_feed_sync_at), "PP p")}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{unreconciledFeeds.length}</div>
                <div className="text-sm text-muted-foreground">
                  Unreconciled Bank Transactions
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Link2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{unreconciledPOS.length}</div>
                <div className="text-sm text-muted-foreground">
                  Unmatched POS Transactions
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {unreconciledFeeds.filter((f) => findPotentialMatches(f).length > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Potential Auto-Matches</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unreconciled Bank Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Unreconciled Bank Transactions</CardTitle>
          <CardDescription>
            Click "Match" to link a bank transaction to a POS sale
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : unreconciledFeeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>All bank transactions are reconciled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unreconciledFeeds.map((feed) => {
                  const matches = findPotentialMatches(feed);
                  return (
                    <TableRow key={feed.id}>
                      <TableCell>
                        {format(new Date(feed.transaction_date), "PP")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {feed.reference || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {feed.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(feed.credit)}
                      </TableCell>
                      <TableCell>
                        {matches.length > 0 ? (
                          <Badge variant="default" className="bg-green-500">
                            {matches.length} match{matches.length > 1 ? "es" : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No matches</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMatchClick(feed)}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Match Bank Transaction</DialogTitle>
            <DialogDescription>
              Select a POS transaction to match with this bank feed
            </DialogDescription>
          </DialogHeader>

          {selectedFeed && (
            <div className="space-y-4">
              {/* Bank Transaction Info */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reference:</span>{" "}
                      <span className="font-medium">{selectedFeed.reference}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      <span className="font-medium text-green-600">
                        {formatCurrency(selectedFeed.credit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(selectedFeed.transaction_date), "PP")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>{" "}
                      <span className="font-medium">{selectedFeed.description}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* POS Transaction Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by transaction number or amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* POS Transactions List */}
              <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOS.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          No matching transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPOS.map((t) => {
                        const isMatch =
                          selectedFeed.credit &&
                          Math.abs(t.amount - selectedFeed.credit) < 0.11;
                        return (
                          <TableRow
                            key={t.id}
                            className={`cursor-pointer ${
                              selectedPOS?.id === t.id ? "bg-primary/10" : ""
                            } ${isMatch ? "bg-green-50" : ""}`}
                            onClick={() => setSelectedPOS(t)}
                          >
                            <TableCell>
                              <input
                                type="radio"
                                checked={selectedPOS?.id === t.id}
                                onChange={() => setSelectedPOS(t)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-mono">
                              {t.transaction_number}
                              {isMatch && (
                                <Badge className="ml-2 bg-green-500" variant="default">
                                  Match
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(new Date(t.created_at), "PP")}
                            </TableCell>
                            <TableCell className="uppercase">{t.payment_method}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(t.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMatch} disabled={!selectedPOS}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
