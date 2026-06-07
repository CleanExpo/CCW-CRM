'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { OperationsPageHeader } from '@/components/operations/OperationsPageHeader';
import {
  createTradeFinanceAdvance,
  createTradeFinanceFacility,
  createLetterOfCredit,
  listLettersOfCredit,
  listTradeFinanceFacilities,
  recordAdvanceRepayment,
  getTradeFinanceSummary,
  type TradeFinanceFacilityRow,
  type TradeFinanceLcRow,
  type TradeFinanceSummary,
} from '@/lib/api/trade-finance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { opCardClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';
import { AlertTriangle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function formatMoney(n: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n);
}

export default function TradeFinancePage() {
  const { toast } = useToast();
  const [facilities, setFacilities] = useState<TradeFinanceFacilityRow[]>([]);
  const [letters, setLetters] = useState<TradeFinanceLcRow[]>([]);
  const [summary, setSummary] = useState<TradeFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [lcOpen, setLcOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
  const [repayAdvanceId, setRepayAdvanceId] = useState<string | null>(null);
  const [repayAdvanceLabel, setRepayAdvanceLabel] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [advanceFacilityId, setAdvanceFacilityId] = useState<string | null>(null);
  const [facilityForm, setFacilityForm] = useState({ name: 'CBA Trade Facility', limit: '500000' });
  const [advanceForm, setAdvanceForm] = useState({
    advance_number: 'TF-000001',
    principal_amount: '80000',
    drawdown_date: new Date().toISOString().slice(0, 10),
    maturity_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    security_ref: '',
  });
  const [lcForm, setLcForm] = useState({
    lc_number: 'LC-000001',
    amount: '100000',
    lc_type: 'usance',
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    facility_id: '',
    bank_ref: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fac, lcs, sum] = await Promise.all([
        listTradeFinanceFacilities(),
        listLettersOfCredit(),
        getTradeFinanceSummary(),
      ]);
      setFacilities(fac);
      setLetters(lcs);
      setSummary(sum);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateFacility = async () => {
    try {
      await createTradeFinanceFacility({
        name: facilityForm.name,
        facility_limit: Number(facilityForm.limit),
        provider: 'CBA',
      });
      toast({ title: 'Facility created' });
      setFacilityOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    }
  };

  const handleCreateAdvance = async () => {
    if (!advanceFacilityId) return;
    try {
      await createTradeFinanceAdvance({
        facility_id: advanceFacilityId,
        advance_number: advanceForm.advance_number,
        drawdown_date: advanceForm.drawdown_date,
        maturity_date: advanceForm.maturity_date,
        principal_amount: Number(advanceForm.principal_amount),
        security_ref: advanceForm.security_ref || undefined,
      });
      toast({ title: 'Advance recorded' });
      setAdvanceOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    }
  };

  const handleCreateLc = async () => {
    try {
      await createLetterOfCredit({
        lc_number: lcForm.lc_number,
        amount: Number(lcForm.amount),
        lc_type: lcForm.lc_type,
        issue_date: lcForm.issue_date,
        expiry_date: lcForm.expiry_date,
        facility_id: lcForm.facility_id || undefined,
        bank_ref: lcForm.bank_ref || undefined,
      });
      toast({ title: 'Letter of credit issued' });
      setLcOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    }
  };

  const handleRecordRepayment = async () => {
    if (!repayAdvanceId) return;
    try {
      await recordAdvanceRepayment(repayAdvanceId, { amount: Number(repayAmount) });
      toast({ title: 'Repayment recorded' });
      setRepayOpen(false);
      setRepayAmount('');
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    }
  };

  const openRepayDialog = (advanceId: string, label: string) => {
    setRepayAdvanceId(advanceId);
    setRepayAdvanceLabel(label);
    setRepayAmount('');
    setRepayOpen(true);
  };

  const alerts = facilities.flatMap((f) => {
    const out: string[] = [];
    if (f.available < f.facility_limit * 0.1) {
      out.push(`${f.name}: facility limit nearly max`);
    }
    for (const a of f.advances) {
      const due = new Date(a.due);
      const days = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days <= 14 && days >= 0) out.push(`${a.advance_number}: maturity in ${Math.ceil(days)} days`);
      if (a.balance > 0 && a.status === 'overdue') out.push(`${a.advance_number}: repayment overdue`);
    }
    return out;
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <OperationsPageHeader
          title="Trade finance"
          description="CBA facilities, drawdowns, and advances linked to supplier invoices and POs — separate from daily bank rec."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLcOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Issue LC
              </Button>
              <Button onClick={() => setFacilityOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add facility
              </Button>
            </div>
          }
        />

        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className={opCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Facility limit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatMoney(summary.total_limit)}</p>
              </CardContent>
            </Card>
            <Card className={opCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatMoney(summary.total_outstanding)}</p>
              </CardContent>
            </Card>
            <Card className={opCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatMoney(summary.total_available)}</p>
              </CardContent>
            </Card>
            <Card className={opCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active LCs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.active_letters_of_credit}</p>
                <p className="text-muted-foreground text-xs">
                  {summary.advances_overdue} overdue · {summary.advances_maturing_14d} due in 14d
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {alerts.length > 0 && (
          <Card className={cn('border-amber-500/40', opCardClass)}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {alerts.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="facilities">
          <TabsList>
            <TabsTrigger value="facilities">Facilities & advances</TabsTrigger>
            <TabsTrigger value="lc">Letters of credit</TabsTrigger>
          </TabsList>

          <TabsContent value="facilities" className="mt-4 space-y-4">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : facilities.length === 0 ? (
          <Card className={opCardClass}>
            <CardContent className="text-muted-foreground py-12 text-center">
              No trade finance facilities yet. Add a CBA facility to track drawdowns and maturities.
            </CardContent>
          </Card>
        ) : (
          facilities.map((f) => (
            <Card key={f.id} className={opCardClass}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">
                    {f.name}{' '}
                    <Badge variant="outline" className="ml-2">
                      {f.provider}
                    </Badge>
                  </CardTitle>
                  <div className="text-sm">
                    Limit {formatMoney(f.facility_limit, f.currency)} · Available{' '}
                    {formatMoney(f.available, f.currency)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdvanceFacilityId(f.id);
                      setAdvanceForm((s) => ({
                        ...s,
                        advance_number: `TF-${String(f.advances.length + 1).padStart(6, '0')}`,
                      }));
                      setAdvanceOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add advance
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left">
                      <th className="pb-2 pr-4">Advance</th>
                      <th className="pb-2 pr-4">Supplier / Shipment</th>
                      <th className="pb-2 pr-4 text-right">Drawn</th>
                      <th className="pb-2 pr-4">Due</th>
                      <th className="pb-2 pr-4 text-right">Balance</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {f.advances.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-muted-foreground py-6 text-center">
                          No advances on this facility
                        </td>
                      </tr>
                    ) : (
                      f.advances.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{a.advance_number}</td>
                          <td className="py-3 pr-4">
                            {[a.supplier, a.shipment].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="py-3 pr-4 text-right">{formatMoney(a.drawn, f.currency)}</td>
                          <td className="py-3 pr-4">{a.due}</td>
                          <td className="py-3 pr-4 text-right">{formatMoney(a.balance, f.currency)}</td>
                          <td className="py-3">
                            <Badge
                              variant={
                                a.status === 'overdue'
                                  ? 'destructive'
                                  : a.status === 'repaid'
                                    ? 'secondary'
                                    : 'default'
                              }
                            >
                              {a.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            {a.balance > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRepayDialog(a.id, a.advance_number)}
                              >
                                Repay
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))
        )}
          </TabsContent>

          <TabsContent value="lc" className="mt-4">
            <Card className={opCardClass}>
              <CardHeader>
                <CardTitle className="text-lg">Letters of credit</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left">
                      <th className="pb-2 pr-4">LC number</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Beneficiary</th>
                      <th className="pb-2 pr-4 text-right">Amount</th>
                      <th className="pb-2 pr-4">Expiry</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {letters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-muted-foreground py-8 text-center">
                          No letters of credit — issue an LC to secure supplier shipments
                        </td>
                      </tr>
                    ) : (
                      letters.map((lc) => (
                        <tr key={lc.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{lc.lc_number}</td>
                          <td className="py-3 pr-4 capitalize">{lc.lc_type}</td>
                          <td className="py-3 pr-4">{lc.beneficiary ?? '—'}</td>
                          <td className="py-3 pr-4 text-right">
                            {formatMoney(lc.amount, lc.currency)}
                          </td>
                          <td className="py-3 pr-4">{lc.expiry_date}</td>
                          <td className="py-3">
                            <Badge variant={lc.status === 'expired' ? 'destructive' : 'outline'}>
                              {lc.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={facilityOpen} onOpenChange={setFacilityOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New trade finance facility</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={facilityForm.name}
                  onChange={(e) => setFacilityForm((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Facility limit (AUD)</Label>
                <Input
                  value={facilityForm.limit}
                  onChange={(e) => setFacilityForm((s) => ({ ...s, limit: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateFacility}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record trade finance advance</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Advance number</Label>
                <Input
                  value={advanceForm.advance_number}
                  onChange={(e) => setAdvanceForm((s) => ({ ...s, advance_number: e.target.value }))}
                />
              </div>
              <div>
                <Label>Principal (AUD)</Label>
                <Input
                  value={advanceForm.principal_amount}
                  onChange={(e) =>
                    setAdvanceForm((s) => ({ ...s, principal_amount: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Drawdown date</Label>
                <Input
                  type="date"
                  value={advanceForm.drawdown_date}
                  onChange={(e) => setAdvanceForm((s) => ({ ...s, drawdown_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Maturity date</Label>
                <Input
                  type="date"
                  value={advanceForm.maturity_date}
                  onChange={(e) => setAdvanceForm((s) => ({ ...s, maturity_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Security / document ref</Label>
                <Input
                  value={advanceForm.security_ref}
                  onChange={(e) => setAdvanceForm((s) => ({ ...s, security_ref: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAdvance}>Save advance</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={lcOpen} onOpenChange={setLcOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue letter of credit</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>LC number</Label>
                <Input
                  value={lcForm.lc_number}
                  onChange={(e) => setLcForm((s) => ({ ...s, lc_number: e.target.value }))}
                />
              </div>
              <div>
                <Label>Amount (AUD)</Label>
                <Input
                  value={lcForm.amount}
                  onChange={(e) => setLcForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>LC type</Label>
                <Select
                  value={lcForm.lc_type}
                  onValueChange={(v) => setLcForm((s) => ({ ...s, lc_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sight">Sight</SelectItem>
                    <SelectItem value="usance">Usance</SelectItem>
                    <SelectItem value="standby">Standby</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facility (optional)</Label>
                <Select
                  value={lcForm.facility_id}
                  onValueChange={(v) => setLcForm((s) => ({ ...s, facility_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Issue date</Label>
                <Input
                  type="date"
                  value={lcForm.issue_date}
                  onChange={(e) => setLcForm((s) => ({ ...s, issue_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={lcForm.expiry_date}
                  onChange={(e) => setLcForm((s) => ({ ...s, expiry_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Bank reference</Label>
                <Input
                  value={lcForm.bank_ref}
                  onChange={(e) => setLcForm((s) => ({ ...s, bank_ref: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateLc}>Issue LC</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record repayment — {repayAdvanceLabel}</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Amount (AUD)</Label>
              <Input
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleRecordRepayment}>Record repayment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
