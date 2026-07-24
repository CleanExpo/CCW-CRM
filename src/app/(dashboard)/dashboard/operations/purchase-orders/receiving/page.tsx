'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, PackageCheck, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import {
  goodsReceiptStatusTone,
  lineConditionTone,
  opCardClass,
  opHeroSurfaceClass,
  opInsetClass,
} from '@/lib/operations/ui';
import type {
  GoodsReceipt,
  GoodsReceiptLine,
  CreateGoodsReceiptRequest,
  AddGoodsReceiptLineRequest,
} from '@/lib/api/cin7-grn';
import { cin7GrnApi } from '@/lib/api/cin7-grn';

// ---------------------------------------------------------------------------
// Demo fallback data
// ---------------------------------------------------------------------------

const DEMO_GRNS: GoodsReceipt[] = [
  {
    id: 'demo-grn-1',
    cin7_po_mapping_id: null,
    po_reference: 'PO-2026-001',
    supplier_name: 'TruckMount Supplies Co',
    received_by: 'John Smith',
    received_date: '2026-03-01',
    location_id: 'Brisbane Warehouse',
    notes: 'Partial shipment - remaining items on backorder',
    status: 'synced',
    cin7_receipt_id: 'DEMO-GRN-PO-2026-001-143022',
    total_items_received: 25,
    created_at: '2026-03-01T14:30:00Z',
    confirmed_at: '2026-03-01T15:00:00Z',
    synced_at: '2026-03-01T15:00:05Z',
    lines: [
      {
        id: 'demo-line-1',
        goods_receipt_id: 'demo-grn-1',
        product_id: null,
        sku: 'TM-500',
        product_name: 'TruckMount 500 PSI Pump',
        ordered_qty: 10,
        received_qty: 10,
        put_away_location: 'Aisle A - Bay 3',
        batch_number: 'B2026-0301',
        expiry_date: null,
        condition: 'good',
        notes: null,
      },
      {
        id: 'demo-line-2',
        goods_receipt_id: 'demo-grn-1',
        product_id: null,
        sku: 'HE-200',
        product_name: 'Heat Exchanger 200kW',
        ordered_qty: 20,
        received_qty: 15,
        put_away_location: 'Aisle B - Bay 1',
        batch_number: null,
        expiry_date: null,
        condition: 'good',
        notes: '5 units on backorder',
      },
    ],
  },
  {
    id: 'demo-grn-2',
    cin7_po_mapping_id: null,
    po_reference: 'PO-2026-002',
    supplier_name: 'Safety Equipment Wholesale',
    received_by: null,
    received_date: '2026-03-03',
    location_id: 'Brisbane Warehouse',
    notes: null,
    status: 'draft',
    cin7_receipt_id: null,
    total_items_received: 0,
    created_at: '2026-03-03T09:00:00Z',
    confirmed_at: null,
    synced_at: null,
    lines: [],
  },
];

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function GoodsReceivingPage() {
  const { toast } = useToast();
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // New GRN dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateGoodsReceiptRequest>({
    po_reference: '',
    supplier_name: '',
    received_date: new Date().toISOString().split('T')[0],
    location_id: 'Brisbane Warehouse',
    notes: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Add line dialog
  const [addLineGrnId, setAddLineGrnId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState<AddGoodsReceiptLineRequest>({
    sku: '',
    product_name: '',
    ordered_qty: undefined,
    received_qty: 0,
    condition: 'good',
    put_away_location: '',
  });
  const [isAddingLine, setIsAddingLine] = useState(false);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const loadGrns = useCallback(async () => {
    try {
      setLoading(true);
      const filterStatus = statusFilter === 'all' ? undefined : statusFilter;
      const response = await cin7GrnApi.listGoodsReceipts(filterStatus);
      setGrns(response.items);
    } catch {
      setGrns([]);
      toast({
        title: 'Error',
        description: 'Failed to load goods receiving records.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadGrns();
  }, [loadGrns]);

  // ---------------------------------------------------------------------------
  // Create GRN
  // ---------------------------------------------------------------------------

  async function handleCreateGrn() {
    if (!createForm.po_reference.trim()) {
      toast({ title: 'Error', description: 'PO Reference is required', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    try {
      await cin7GrnApi.createGoodsReceipt(createForm);
      toast({ title: 'Success', description: 'Goods receipt created' });
      setIsCreateOpen(false);
      setCreateForm({
        po_reference: '',
        supplier_name: '',
        received_date: new Date().toISOString().split('T')[0],
        location_id: 'Brisbane Warehouse',
        notes: '',
      });
      loadGrns();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create receipt',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Add Line
  // ---------------------------------------------------------------------------

  async function handleAddLine() {
    if (!addLineGrnId) return;
    if (!lineForm.sku.trim() || !lineForm.product_name.trim()) {
      toast({
        title: 'Error',
        description: 'SKU and Product Name are required',
        variant: 'destructive',
      });
      return;
    }
    if (lineForm.received_qty <= 0) {
      toast({
        title: 'Error',
        description: 'Received quantity must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    setIsAddingLine(true);
    try {
      await cin7GrnApi.addGoodsReceiptLine(addLineGrnId, lineForm);
      toast({ title: 'Success', description: 'Line added' });
      setAddLineGrnId(null);
      setLineForm({
        sku: '',
        product_name: '',
        ordered_qty: undefined,
        received_qty: 0,
        condition: 'good',
        put_away_location: '',
      });
      loadGrns();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add line',
        variant: 'destructive',
      });
    } finally {
      setIsAddingLine(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove Line
  // ---------------------------------------------------------------------------

  async function handleRemoveLine(grnId: string, lineId: string) {
    try {
      await cin7GrnApi.removeGoodsReceiptLine(grnId, lineId);
      toast({ title: 'Success', description: 'Line removed' });
      loadGrns();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove line',
        variant: 'destructive',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm GRN
  // ---------------------------------------------------------------------------

  async function handleConfirm(grnId: string) {
    try {
      await cin7GrnApi.confirmGoodsReceipt(grnId);
      toast({ title: 'Success', description: 'Goods receipt confirmed and synced' });
      loadGrns();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to confirm receipt',
        variant: 'destructive',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <OperationsPageLayout className="space-y-6">
      <OperationsPageHeader
        accent="lagoon"
        title="Goods receiving"
        description="Record inbound stock, verify quantities, put-away locations, and confirm receipts into inventory."
        icon={PackageCheck}
        breadcrumbs={[
          { label: 'Purchase orders', href: '/dashboard/operations/purchase-orders' },
          { label: 'Receiving' },
        ]}
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New receipt
          </Button>
        }
      />

      <div className={cn('flex items-center gap-4', opCardClass, opHeroSurfaceClass, 'p-4')}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GRN List with inline expansion */}
      {loading ? (
        <div className="text-muted-foreground py-12 text-center dark:text-foreground/70">
          Loading receipts…
        </div>
      ) : grns.length === 0 ? (
        <div
          className={cn(
            'text-muted-foreground py-14 text-center text-sm dark:text-foreground/70',
            opInsetClass
          )}
        >
          No goods receipts yet. Create a new receipt to record an inbound delivery.
        </div>
      ) : (
        <div className="space-y-3">
          {grns.map((grn) => {
            const isExpanded = expandedIds.has(grn.id);
            return (
              <div
                key={grn.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card/70 shadow-sm dark:bg-card/85"
              >
                <button
                  type="button"
                  className="hover:bg-muted/40 flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors"
                  onClick={() => toggleExpanded(grn.id)}
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    <PackageCheck className="text-primary h-5 w-5 shrink-0 opacity-90" />
                    <div>
                      <div className="text-foreground font-semibold">{grn.po_reference}</div>
                      <div className="text-muted-foreground text-sm dark:text-foreground/65">
                        {grn.supplier_name || 'No supplier'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <span className="text-muted-foreground text-sm tabular-nums dark:text-foreground/65">
                      {new Date(grn.received_date).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground text-sm tabular-nums dark:text-foreground/65">
                      {grn.total_items_received} items
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border font-medium capitalize',
                        goodsReceiptStatusTone(grn.status)
                      )}
                    >
                      {grn.status}
                    </Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-border/60 px-4 pb-4">
                    <div
                      className={cn(
                        'mt-3 grid grid-cols-2 gap-3 p-3 text-sm md:grid-cols-4',
                        opInsetClass
                      )}
                    >
                      <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Location
                        </div>
                        <div className="text-foreground mt-0.5 font-medium">{grn.location_id}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Received by
                        </div>
                        <div className="text-foreground mt-0.5 font-medium">
                          {grn.received_by || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Receipt ID
                        </div>
                        <div className="text-foreground mt-0.5 font-medium font-mono text-xs">
                          {grn.cin7_receipt_id || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Notes
                        </div>
                        <div className="text-foreground mt-0.5 font-medium">{grn.notes || '—'}</div>
                      </div>
                    </div>

                    {/* Lines table */}
                    {grn.lines.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Ordered</TableHead>
                            <TableHead className="text-right">Received</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Put-Away</TableHead>
                            {grn.status === 'draft' && <TableHead className="w-[50px]"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grn.lines.map((line: GoodsReceiptLine) => (
                            <TableRow key={line.id}>
                              <TableCell className="font-mono text-sm">{line.sku}</TableCell>
                              <TableCell>{line.product_name}</TableCell>
                              <TableCell className="text-right">
                                {line.ordered_qty ?? '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {line.received_qty}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'border font-medium capitalize',
                                    lineConditionTone(line.condition)
                                  )}
                                >
                                  {line.condition}
                                </Badge>
                              </TableCell>
                              <TableCell>{line.put_away_location || '-'}</TableCell>
                              {grn.status === 'draft' && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLine(grn.id, line.id)}
                                  >
                                    <Trash2 className="text-destructive h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-muted-foreground py-4 text-center text-sm">
                        No line items yet. Add items to this receipt.
                      </div>
                    )}

                    {/* Actions for draft GRNs */}
                    {grn.status === 'draft' && (
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setAddLineGrnId(grn.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Line
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(grn.id)}
                          disabled={grn.lines.length === 0}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Confirm Receipt
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create GRN Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Goods Receipt</DialogTitle>
            <DialogDescription>
              Create a new goods receipt note for an incoming purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="po_reference">PO Reference</Label>
              <Input
                id="po_reference"
                placeholder="e.g. PO-2026-003"
                value={createForm.po_reference}
                onChange={(e) => setCreateForm({ ...createForm, po_reference: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="supplier_name">Supplier Name</Label>
              <Input
                id="supplier_name"
                placeholder="e.g. TruckMount Supplies Co"
                value={createForm.supplier_name || ''}
                onChange={(e) => setCreateForm({ ...createForm, supplier_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="received_date">Received Date</Label>
              <Input
                id="received_date"
                type="date"
                value={createForm.received_date || ''}
                onChange={(e) => setCreateForm({ ...createForm, received_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location_id">Receiving Location</Label>
              <Select
                value={createForm.location_id}
                onValueChange={(v) => setCreateForm({ ...createForm, location_id: v })}
              >
                <SelectTrigger id="location_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Brisbane Warehouse">Brisbane Warehouse</SelectItem>
                  <SelectItem value="Sydney Distribution">Sydney Distribution</SelectItem>
                  <SelectItem value="Melbourne Depot">Melbourne Depot</SelectItem>
                  <SelectItem value="Returns Bay">Returns Bay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes..."
                value={createForm.notes || ''}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateGrn} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={!!addLineGrnId} onOpenChange={(open) => !open && setAddLineGrnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>Add a received item to this goods receipt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="line_sku">SKU</Label>
                <Input
                  id="line_sku"
                  placeholder="e.g. TM-500"
                  value={lineForm.sku}
                  onChange={(e) => setLineForm({ ...lineForm, sku: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="line_product_name">Product Name</Label>
                <Input
                  id="line_product_name"
                  placeholder="e.g. TruckMount 500 PSI Pump"
                  value={lineForm.product_name}
                  onChange={(e) => setLineForm({ ...lineForm, product_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="line_ordered_qty">Ordered Qty</Label>
                <Input
                  id="line_ordered_qty"
                  type="number"
                  min="0"
                  placeholder="Optional"
                  value={lineForm.ordered_qty ?? ''}
                  onChange={(e) =>
                    setLineForm({
                      ...lineForm,
                      ordered_qty: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="line_received_qty">Received Qty</Label>
                <Input
                  id="line_received_qty"
                  type="number"
                  min="0"
                  value={lineForm.received_qty}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, received_qty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="line_condition">Condition</Label>
              <Select
                value={lineForm.condition || 'good'}
                onValueChange={(v) =>
                  setLineForm({ ...lineForm, condition: v as 'good' | 'damaged' | 'short' })
                }
              >
                <SelectTrigger id="line_condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="line_put_away">Put-Away Location</Label>
              <Input
                id="line_put_away"
                placeholder="e.g. Aisle A - Bay 3"
                value={lineForm.put_away_location || ''}
                onChange={(e) => setLineForm({ ...lineForm, put_away_location: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineGrnId(null)} disabled={isAddingLine}>
              Cancel
            </Button>
            <Button onClick={handleAddLine} disabled={isAddingLine}>
              {isAddingLine ? 'Adding...' : 'Add Line'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationsPageLayout>
  );
}
