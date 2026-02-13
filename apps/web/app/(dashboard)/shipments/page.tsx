"use client";

import { useState, useEffect } from "react";
import { shipmentsApi, type Shipment, type ShipmentStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { ShipmentForm } from "./components/ShipmentForm";

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending: "bg-yellow-500",
  in_transit: "bg-blue-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  returned: "bg-orange-500",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchShipments();
  }, [page, searchTerm, statusFilter]);

  async function fetchShipments() {
    try {
      setLoading(true);
      const response = await shipmentsApi.list({
        page,
        page_size: 50,
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setShipments(response.items);
      setTotalPages(response.total_pages);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load shipments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, shipmentNumber: string) {
    try {
      await shipmentsApi.delete(id);
      toast({
        title: "Success",
        description: `Shipment "${shipmentNumber}" deleted successfully`,
      });
      fetchShipments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete shipment",
        variant: "destructive",
      });
    }
  }

  function handleCreateShipment() {
    setEditingShipment(null);
    setFormDialogOpen(true);
  }

  function handleEditShipment(shipment: Shipment) {
    setEditingShipment(shipment);
    setFormDialogOpen(true);
  }

  function handleFormSuccess() {
    fetchShipments();
    setFormDialogOpen(false);
    setEditingShipment(null);
  }

  function formatDate(dateString: string | undefined) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8" />
            Shipments
          </h1>
          <p className="text-muted-foreground">
            Track and manage shipments and deliveries
          </p>
        </div>
        <Button onClick={handleCreateShipment}>
          <Plus className="mr-2 h-4 w-4" />
          Create Shipment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by shipment number or tracking..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value: any) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment #</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Tracking Number</TableHead>
              <TableHead>Shipped Date</TableHead>
              <TableHead>Est. Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Loading shipments...
                </TableCell>
              </TableRow>
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-medium">
                    {shipment.shipment_number}
                  </TableCell>
                  <TableCell>{shipment.order_number || "N/A"}</TableCell>
                  <TableCell>{shipment.customer_name || "N/A"}</TableCell>
                  <TableCell>{shipment.carrier_name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {shipment.tracking_number}
                  </TableCell>
                  <TableCell>{formatDate(shipment.shipped_date)}</TableCell>
                  <TableCell>{formatDate(shipment.estimated_delivery_date)}</TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[shipment.status]}
                      variant="default"
                    >
                      {shipment.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditShipment(shipment)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete shipment "
                              {shipment.shipment_number}"? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDelete(
                                  shipment.id,
                                  shipment.shipment_number
                                )
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Shipment Form */}
      <ShipmentForm
        shipment={editingShipment}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
