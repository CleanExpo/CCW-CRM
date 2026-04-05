'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  type Cin7BomMaster,
  type Cin7ProductionRun,
  createProductionRun,
  listBoms,
  listProductionRuns,
  syncBoms,
  updateProductionRunStatus,
} from '@/lib/api/cin7-bom';
import { ChevronDown, ChevronRight, Layers, Loader2, Plus, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Demo fallback data (used when backend is unavailable)
// ---------------------------------------------------------------------------

const DEMO_BOMS: Cin7BomMaster[] = [
  {
    id: 'demo-bom-1',
    cin7_bom_id: 'BOM-001',
    name: 'Industrial Pressure Washer Assembly',
    sku: 'FG-PWA-3000',
    version: '2',
    status: 'active',
    finished_good_sku: 'FG-PWA-3000',
    finished_good_name: 'Industrial Pressure Washer 3000 PSI',
    quantity_produced: '1.0000',
    uom: 'EA',
    notes: 'Assembled from pump unit, frame, and hose kit',
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    components: [
      {
        id: 'c1',
        bom_master_id: 'demo-bom-1',
        component_sku: 'RM-PUMP-3000',
        component_name: 'High-Pressure Pump Unit 3000 PSI',
        quantity: '1.0000',
        uom: 'EA',
        wastage_percent: '2.00',
        notes: null,
      },
      {
        id: 'c2',
        bom_master_id: 'demo-bom-1',
        component_sku: 'RM-FRAME-STL',
        component_name: 'Steel Frame Assembly',
        quantity: '1.0000',
        uom: 'EA',
        wastage_percent: '0.00',
        notes: null,
      },
      {
        id: 'c3',
        bom_master_id: 'demo-bom-1',
        component_sku: 'RM-HOSE-15M',
        component_name: 'High-Pressure Hose 15m',
        quantity: '2.0000',
        uom: 'EA',
        wastage_percent: '5.00',
        notes: 'One spare included',
      },
    ],
  },
  {
    id: 'demo-bom-2',
    cin7_bom_id: 'BOM-002',
    name: 'Safety Equipment Bundle — Site Pack',
    sku: 'FG-SAFE-SITE',
    version: '1',
    status: 'active',
    finished_good_sku: 'FG-SAFE-SITE',
    finished_good_name: 'Site Safety Equipment Pack',
    quantity_produced: '1.0000',
    uom: 'KIT',
    notes: 'Standard site safety pack for 1 worker',
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    components: [
      {
        id: 'c4',
        bom_master_id: 'demo-bom-2',
        component_sku: 'RM-HELMET-WHT',
        component_name: 'Safety Helmet White',
        quantity: '1.0000',
        uom: 'EA',
        wastage_percent: '0.00',
        notes: null,
      },
      {
        id: 'c5',
        bom_master_id: 'demo-bom-2',
        component_sku: 'RM-VEST-HI',
        component_name: 'Hi-Vis Safety Vest',
        quantity: '1.0000',
        uom: 'EA',
        wastage_percent: '3.00',
        notes: null,
      },
    ],
  },
  {
    id: 'demo-bom-3',
    cin7_bom_id: 'BOM-003',
    name: 'Electrical Maintenance Kit',
    sku: 'FG-ELEC-MAINT',
    version: '1',
    status: 'draft',
    finished_good_sku: 'FG-ELEC-MAINT',
    finished_good_name: 'Electrical Maintenance Tool Kit',
    quantity_produced: '1.0000',
    uom: 'KIT',
    notes: 'Draft — pending component cost review',
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    components: [
      {
        id: 'c6',
        bom_master_id: 'demo-bom-3',
        component_sku: 'RM-MULTIMETER',
        component_name: 'Digital Multimeter',
        quantity: '1.0000',
        uom: 'EA',
        wastage_percent: '0.00',
        notes: null,
      },
    ],
  },
];

const DEMO_RUNS: Cin7ProductionRun[] = [
  {
    id: 'demo-run-1',
    bom_master_id: 'demo-bom-1',
    bom_name: 'Industrial Pressure Washer Assembly',
    cin7_production_id: 'PROD-2024-001',
    quantity_planned: '10.0000',
    quantity_completed: '10.0000',
    status: 'completed',
    planned_date: '2024-02-15',
    completed_date: '2024-02-17',
    location_id: 'Brisbane',
    notes: null,
    cin7_synced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-run-2',
    bom_master_id: 'demo-bom-2',
    bom_name: 'Safety Equipment Bundle — Site Pack',
    cin7_production_id: null,
    quantity_planned: '50.0000',
    quantity_completed: '20.0000',
    status: 'in_progress',
    planned_date: '2024-03-01',
    completed_date: null,
    location_id: 'Sydney',
    notes: 'Delayed due to helmet stock shortage',
    cin7_synced: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-run-3',
    bom_master_id: 'demo-bom-1',
    bom_name: 'Industrial Pressure Washer Assembly',
    cin7_production_id: null,
    quantity_planned: '5.0000',
    quantity_completed: '0.0000',
    status: 'planned',
    planned_date: '2024-04-10',
    completed_date: null,
    location_id: 'Melbourne',
    notes: null,
    cin7_synced: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

function BomStatusBadge({ status }: { status: string }) {
  if (status === 'active')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  if (status === 'archived')
    return (
      <Badge variant="secondary" className="opacity-60">
        Archived
      </Badge>
    );
  return <Badge variant="secondary">Draft</Badge>;
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'completed')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
  if (status === 'in_progress')
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>;
  if (status === 'cancelled') return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="secondary">Planned</Badge>;
}

// ---------------------------------------------------------------------------
// New Production Run Dialog
// ---------------------------------------------------------------------------

interface NewRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boms: Cin7BomMaster[];
  onSuccess: () => void;
}

function NewRunDialog({ open, onOpenChange, boms, onSuccess }: NewRunDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bom_master_id: '',
    quantity_planned: '',
    planned_date: '',
    location_id: '',
    notes: '',
  });

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.bom_master_id || !form.quantity_planned) {
      toast({
        title: 'Validation error',
        description: 'Please select a BOM and enter a planned quantity.',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(form.quantity_planned);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Validation error',
        description: 'Planned quantity must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await createProductionRun({
        bom_master_id: form.bom_master_id,
        quantity_planned: qty,
        planned_date: form.planned_date || null,
        location_id: form.location_id || null,
        notes: form.notes || null,
      });
      toast({ title: 'Production run created' });
      onOpenChange(false);
      setForm({
        bom_master_id: '',
        quantity_planned: '',
        planned_date: '',
        location_id: '',
        notes: '',
      });
      onSuccess();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create production run.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const activeBoms = boms.filter((b) => b.status !== 'archived');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Production Run</DialogTitle>
          <DialogDescription>Schedule a production run against an existing BOM.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bom-select">Bill of Materials</Label>
            <select
              id="bom-select"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={form.bom_master_id}
              onChange={(e) => handleChange('bom_master_id', e.target.value)}
            >
              <option value="">Select a BOM…</option>
              {activeBoms.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty-planned">Planned Quantity</Label>
            <Input
              id="qty-planned"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 10"
              value={form.quantity_planned}
              onChange={(e) => handleChange('quantity_planned', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planned-date">Planned Date</Label>
            <Input
              id="planned-date"
              type="date"
              value={form.planned_date}
              onChange={(e) => handleChange('planned_date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. Brisbane, Sydney, Melbourne"
              value={form.location_id}
              onChange={(e) => handleChange('location_id', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BomPage() {
  const { toast } = useToast();

  // BOM state
  const [boms, setBoms] = useState<Cin7BomMaster[]>([]);
  const [bomsLoading, setBomsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedBoms, setExpandedBoms] = useState<Set<string>>(new Set());

  // Production run state
  const [runs, setRuns] = useState<Cin7ProductionRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [newRunOpen, setNewRunOpen] = useState(false);

  // Load BOMs
  const loadBoms = useCallback(async () => {
    setBomsLoading(true);
    try {
      const data = await listBoms(1, 50);
      setBoms(data.items);
    } catch {
      // Fallback to demo data when backend is unreachable
      setBoms(DEMO_BOMS);
    } finally {
      setBomsLoading(false);
    }
  }, []);

  // Load production runs
  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const data = await listProductionRuns(1, 50);
      setRuns(data.items);
    } catch {
      // Fallback to demo data when backend is unreachable
      setRuns(DEMO_RUNS);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoms();
    void loadRuns();
  }, [loadBoms, loadRuns]);

  // Sync from Cin7
  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncBoms();
      toast({
        title: 'Sync complete',
        description: result.message,
      });
      await loadBoms();
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Could not sync BOMs from Cin7. Check connection settings.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  // Toggle BOM row expansion
  function toggleExpanded(id: string) {
    setExpandedBoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Advance production run status
  async function handleAdvanceStatus(run: Cin7ProductionRun, newStatus: string) {
    try {
      await updateProductionRunStatus(run.id, { status: newStatus });
      toast({ title: 'Status updated', description: `Run moved to '${newStatus}'.` });
      await loadRuns();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update run status.',
        variant: 'destructive',
      });
    }
  }

  // Derive available next statuses for a run
  function nextStatuses(status: string): string[] {
    const transitions: Record<string, string[]> = {
      planned: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    return transitions[status] ?? [];
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-muted-foreground mb-1 text-sm">Inventory / Bill of Materials</nav>
          <h1 className="text-3xl font-bold tracking-tight">Bill of Materials</h1>
          <p className="text-muted-foreground">Manage BOM definitions and track production runs</p>
        </div>
      </div>

      <Tabs defaultValue="boms">
        <TabsList>
          <TabsTrigger value="boms">
            <Layers className="mr-2 h-4 w-4" />
            BOMs
          </TabsTrigger>
          <TabsTrigger value="runs">Production Runs</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------------
            BOMs Tab
        ---------------------------------------------------------------- */}
        <TabsContent value="boms" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Bill of Materials</CardTitle>
                <CardDescription>
                  BOM masters synced from Cin7 (v1 BomMasters / v2 FinishedGoods)
                </CardDescription>
              </div>
              <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync from Cin7
              </Button>
            </CardHeader>
            <CardContent>
              {bomsLoading ? (
                <div className="text-muted-foreground flex items-center justify-center py-12">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading BOMs…
                </div>
              ) : boms.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <Layers className="mx-auto mb-4 h-12 w-12 opacity-40" />
                  <p className="font-medium">No BOMs found</p>
                  <p className="mt-1 text-sm">Click "Sync from Cin7" to import your BOMs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Finished Good</TableHead>
                        <TableHead className="text-right">Qty Produced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boms.map((bom) => {
                        const isExpanded = expandedBoms.has(bom.id);
                        return (
                          <>
                            <TableRow
                              key={bom.id}
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleExpanded(bom.id)}
                            >
                              <TableCell className="text-muted-foreground">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{bom.name}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                {bom.sku}
                              </TableCell>
                              <TableCell>v{bom.version}</TableCell>
                              <TableCell>
                                <BomStatusBadge status={bom.status} />
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {bom.finished_good_name ?? bom.finished_good_sku ?? '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {parseFloat(bom.quantity_produced).toFixed(2)}{' '}
                                <span className="text-muted-foreground text-xs">{bom.uom}</span>
                              </TableCell>
                            </TableRow>

                            {/* Expanded component rows */}
                            {isExpanded && bom.components.length > 0 && (
                              <TableRow key={`${bom.id}-components`} className="bg-muted/20">
                                <TableCell colSpan={7} className="py-0 pr-4 pl-8">
                                  <div className="py-3">
                                    <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                                      Components ({bom.components.length})
                                    </p>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-muted-foreground text-xs">
                                          <th className="py-1 pr-4 text-left font-medium">SKU</th>
                                          <th className="py-1 pr-4 text-left font-medium">
                                            Component Name
                                          </th>
                                          <th className="py-1 pr-4 text-right font-medium">
                                            Quantity
                                          </th>
                                          <th className="py-1 pr-4 text-left font-medium">UOM</th>
                                          <th className="py-1 text-right font-medium">Wastage %</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bom.components.map((comp) => (
                                          <tr key={comp.id} className="border-border/50 border-t">
                                            <td className="text-muted-foreground py-1.5 pr-4 font-mono text-xs">
                                              {comp.component_sku}
                                            </td>
                                            <td className="py-1.5 pr-4">{comp.component_name}</td>
                                            <td className="py-1.5 pr-4 text-right font-mono">
                                              {parseFloat(comp.quantity).toFixed(2)}
                                            </td>
                                            <td className="text-muted-foreground py-1.5 pr-4">
                                              {comp.uom}
                                            </td>
                                            <td className="text-muted-foreground py-1.5 text-right">
                                              {parseFloat(comp.wastage_percent).toFixed(1)}%
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {comp_notes(bom) && (
                                      <p className="text-muted-foreground mt-2 text-xs italic">
                                        {comp_notes(bom)}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}

                            {isExpanded && bom.components.length === 0 && (
                              <TableRow key={`${bom.id}-empty`} className="bg-muted/20">
                                <TableCell
                                  colSpan={7}
                                  className="text-muted-foreground py-3 pl-8 text-sm italic"
                                >
                                  No components defined for this BOM.
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------------------
            Production Runs Tab
        ---------------------------------------------------------------- */}
        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Production Runs</CardTitle>
                <CardDescription>
                  Track manufacturing runs from planned through to completion
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setNewRunOpen(true)} disabled={boms.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                New Run
              </Button>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="text-muted-foreground flex items-center justify-center py-12">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading production runs…
                </div>
              ) : runs.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <Layers className="mx-auto mb-4 h-12 w-12 opacity-40" />
                  <p className="font-medium">No production runs yet</p>
                  <p className="mt-1 text-sm">Click "New Run" to schedule one.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>BOM Name</TableHead>
                        <TableHead className="text-right">Planned Qty</TableHead>
                        <TableHead className="text-right">Completed Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Planned Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        const next = nextStatuses(run.status);
                        return (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium">{run.bom_name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {parseFloat(run.quantity_planned).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {parseFloat(run.quantity_completed).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <RunStatusBadge status={run.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {run.planned_date ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {run.location_id ?? '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {next.length > 0 ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Advance Status
                                      <ChevronDown className="ml-2 h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {next.map((ns) => (
                                      <DropdownMenuItem
                                        key={ns}
                                        onClick={() => handleAdvanceStatus(run, ns)}
                                      >
                                        {ns === 'in_progress'
                                          ? 'Start (In Progress)'
                                          : ns === 'completed'
                                            ? 'Mark Completed'
                                            : 'Cancel Run'}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">
                                  Terminal
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Run Dialog */}
      <NewRunDialog
        open={newRunOpen}
        onOpenChange={setNewRunOpen}
        boms={boms}
        onSuccess={loadRuns}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility — collect notes from BOM components for display
// ---------------------------------------------------------------------------

function comp_notes(bom: Cin7BomMaster): string | null {
  const notes = bom.components.flatMap((c) => (c.notes ? [c.notes] : []));
  return notes.length > 0 ? notes.join(' | ') : null;
}
