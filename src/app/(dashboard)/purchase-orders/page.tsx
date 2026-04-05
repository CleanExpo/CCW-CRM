'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
// PHASE 4: Search state persistence
import { useSearchState } from '@/hooks/use-search-state';
// PHASE 4: Last updated timestamps
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  MoreHorizontal,
  PackageCheck,
  X,
  Copy,
  Download,
  ScanLine,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { exportPurchaseOrdersToCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { PurchaseOrderForm } from './components/PurchaseOrderForm';
import { ReceiveGoodsDialog } from './components/ReceiveGoodsDialog';
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
import type { PurchaseOrder, PurchaseOrdersResponse } from './types';
import { STATUS_COLORS, STATUS_LABELS, LOCATION_LABELS } from './types';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp
  const [totalPages, setTotalPages] = useState(1);

  // PHASE 4: Search state persistence - remembers search/filters/pagination
  const { state: searchState, updateField } = useSearchState({
    key: 'purchase-orders-list',
    defaultState: {
      searchQuery: '',
      statusFilter: 'all',
      locationFilter: 'all',
      page: 1,
    },
  });

  const searchQuery = searchState.searchQuery || '';
  const statusFilter = searchState.statusFilter || 'all';
  const locationFilter = searchState.locationFilter || 'all';
  const page = searchState.page || 1;
  const setSearchQuery = (value: string) => updateField('searchQuery', value);
  const setStatusFilter = (value: string) => updateField('statusFilter', value);
  const setLocationFilter = (value: string) => updateField('locationFilter', value);
  const setPage = (value: number) => updateField('page', value);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrder | null>(null);

  // PO document scan
  const [scanOpen, setScanOpen] = useState(false);
  const [scanUrl, setScanUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const handleScanExtract = async () => {
    if (!scanUrl.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await apiClient.post<{ extracted_data: Record<string, unknown> }>(
        '/api/documents/extract-from-url',
        { image_url: scanUrl.trim(), document_type: 'purchase_order' }
      );
      setScanResult(result.extracted_data);
      toast({ title: 'Extraction Complete', description: 'Review and create draft PO.' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Extraction Failed',
        description: e instanceof Error ? e.message : 'Could not extract PO data.',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleScanCreate = async () => {
    if (!scanResult) return;
    setCreating(true);
    try {
      await apiClient.post('/api/documents/create-from-url', {
        image_url: scanUrl.trim(),
        document_type: 'purchase_order',
      });
      toast({ title: 'Draft PO Created', description: 'Check Purchase Orders list.' });
      setScanOpen(false);
      setScanUrl('');
      setScanResult(null);
      loadPurchaseOrders();
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Create Failed',
        description: e instanceof Error ? e.message : 'Could not create draft PO.',
      });
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadPurchaseOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, statusFilter, locationFilter]);

  async function loadPurchaseOrders() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '50',
      });

      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (locationFilter && locationFilter !== 'all') params.append('location', locationFilter);

      const response = await apiClient.get<PurchaseOrdersResponse>(
        `/api/purchase-orders?${params.toString()}`
      );

      setPurchaseOrders(response.items || []);
      setTotalPages(response.total_pages || 1);
    } catch (error: unknown) {
      console.error('Failed to load purchase orders:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load purchase orders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLastUpdated(new Date()); // PHASE 4: Track last update time
    }
  }

  async function handleCancelPO() {
    if (!cancellingPO) return;

    try {
      await apiClient.put(`/api/purchase-orders/${cancellingPO.id}`, {
        status: 'cancelled',
      });

      toast({
        title: 'Success',
        description: 'Purchase order cancelled successfully',
      });

      loadPurchaseOrders();
      setCancellingPO(null);
    } catch (error: unknown) {
      console.error('Failed to cancel purchase order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel purchase order',
        variant: 'destructive',
      });
    }
  }

  // PHASE 4: Duplicate PO - quickly create copy with same items
  async function handleDuplicatePO(po: PurchaseOrder) {
    try {
      const fullPO = await apiClient.get<PurchaseOrder>(`/api/purchase-orders/${po.id}`);
      // Create a copy without id (will be treated as new PO)
      const poCopy = {
        ...fullPO,
        id: undefined, // Remove id to create new PO
        po_number: undefined, // Will be auto-generated
        status: 'draft', // Reset to draft
        notes: fullPO.notes
          ? `Copy of ${fullPO.po_number}\n\n${fullPO.notes}`
          : `Copy of ${fullPO.po_number}`,
      };
      setEditingPO(poCopy as unknown as PurchaseOrder);
      setIsCreateOpen(true);
      toast({
        title: 'Purchase Order Duplicated',
        description: 'Review and modify the copy before saving',
      });
    } catch (error: unknown) {
      console.error('Failed to duplicate purchase order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate purchase order',
        variant: 'destructive',
      });
    }
  }

  function canReceiveGoods(po: PurchaseOrder): boolean {
    return po.status === 'ordered' || po.status === 'in_transit' || po.status === 'approved';
  }

  function canCancel(po: PurchaseOrder): boolean {
    return po.status === 'draft' || po.status === 'pending_approval' || po.status === 'approved';
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">
              Manage supplier orders and goods receiving
              {lastUpdated && (
                <span className="ml-2 text-xs">
                  • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                exportPurchaseOrdersToCSV(purchaseOrders as unknown as Record<string, unknown>[]);
                toast({
                  title: 'Export Successful',
                  description: 'Purchase orders exported to CSV',
                });
              }}
              disabled={purchaseOrders.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <ScanLine className="mr-2 h-4 w-4" />
              Scan PO Image
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by PO number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={locationFilter}
            onValueChange={(value) => {
              setLocationFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="brisbane">Brisbane</SelectItem>
              <SelectItem value="sydney">Sydney</SelectItem>
              <SelectItem value="melbourne">Melbourne</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{po.supplier_name}</div>
                      <div className="text-muted-foreground text-sm">{po.supplier_code}</div>
                    </TableCell>
                    <TableCell>{LOCATION_LABELS[po.delivery_location]}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[po.status]}>
                        {STATUS_LABELS[po.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{po.items?.length || 0} items</TableCell>
                    <TableCell className="text-right font-medium">${po.total.toFixed(2)}</TableCell>
                    <TableCell>
                      {po.order_date ? new Date(po.order_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEditingPO(po)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicatePO(po)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          {canReceiveGoods(po) && (
                            <DropdownMenuItem onClick={() => setReceivingPO(po)}>
                              <PackageCheck className="mr-2 h-4 w-4" />
                              Receive Goods
                            </DropdownMenuItem>
                          )}
                          {canCancel(po) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setCancellingPO(po)}
                                className="text-destructive"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel Order
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {/* Create/Edit Dialog */}
        {isCreateOpen && (
          <PurchaseOrderForm
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) loadPurchaseOrders();
            }}
            mode="create"
          />
        )}

        {editingPO && (
          <PurchaseOrderForm
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setEditingPO(null);
                loadPurchaseOrders();
              }
            }}
            purchaseOrder={editingPO}
            mode="edit"
          />
        )}

        {/* Receive Goods Dialog */}
        {receivingPO && (
          <ReceiveGoodsDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setReceivingPO(null);
                loadPurchaseOrders();
              }
            }}
            purchaseOrder={receivingPO}
          />
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!cancellingPO} onOpenChange={(open) => !open && setCancellingPO(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel purchase order{' '}
                <span className="font-medium">{cancellingPO?.po_number}</span>? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, keep it</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelPO} className="bg-destructive">
                Yes, cancel order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* PO Document Scan Dialog */}
      <Dialog
        open={scanOpen}
        onOpenChange={(open) => {
          setScanOpen(open);
          if (!open) {
            setScanUrl('');
            setScanResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Scan Purchase Order Image
            </DialogTitle>
            <DialogDescription>
              Paste a URL of a supplier PO or handwritten order. Claude Vision will extract
              supplier, items, and totals automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="po-scan-url">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="po-scan-url"
                  type="url"
                  placeholder="https://... (image of PO)"
                  value={scanUrl}
                  onChange={(e) => setScanUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanExtract()}
                />
                <Button onClick={handleScanExtract} disabled={scanning || !scanUrl.trim()}>
                  <ScanLine className={`mr-2 h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
                  {scanning ? 'Extracting…' : 'Extract'}
                </Button>
              </div>
            </div>

            {scanResult && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Extracted PO Data</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {(scanResult.supplier_name as string) && (
                    <>
                      <dt className="text-muted-foreground">Supplier</dt>
                      <dd>{scanResult.supplier_name as string}</dd>
                    </>
                  )}
                  {(scanResult.po_number as string) && (
                    <>
                      <dt className="text-muted-foreground">PO Number</dt>
                      <dd>{scanResult.po_number as string}</dd>
                    </>
                  )}
                  {(scanResult.total_amount as number) != null && (
                    <>
                      <dt className="text-muted-foreground">Total</dt>
                      <dd>${Number(scanResult.total_amount).toFixed(2)}</dd>
                    </>
                  )}
                  {(scanResult.line_items as unknown[])?.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Line Items</dt>
                      <dd>{(scanResult.line_items as unknown[]).length} item(s)</dd>
                    </>
                  )}
                </dl>
                <Button className="mt-2 w-full" onClick={handleScanCreate} disabled={creating}>
                  {creating ? 'Creating…' : 'Create Draft Purchase Order'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
