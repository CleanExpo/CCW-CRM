"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  outboundShipmentsApi,
  type OutboundShipment,
  type OutboundShipmentCreate,
  type OutboundShipmentStatus,
} from "@/lib/api/shipments-outbound";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { DraftRecoveryAlert } from "@/components/ui/draft-recovery-alert";

// Validation schema (for create)
const createFormSchema = z.object({
  order_id: z.string().uuid("Valid order ID required"),
  carrier_name: z.string().max(100, "Maximum 100 characters").optional(),
  carrier_service: z.string().max(100, "Maximum 100 characters").optional(),
  tracking_number: z.string().max(100, "Maximum 100 characters").optional(),
  origin_location: z.enum(["brisbane", "sydney", "melbourne"], {
    required_error: "Origin warehouse location is required",
  }),
  destination_address: z.string().optional(),
  shipped_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  notes: z.string().optional(),
});

// Validation schema (for update - includes status field)
const updateFormSchema = z.object({
  carrier_name: z.string().max(100, "Maximum 100 characters").optional(),
  carrier_service: z.string().max(100, "Maximum 100 characters").optional(),
  tracking_number: z.string().max(100, "Maximum 100 characters").optional(),
  status: z
    .enum(["pending", "in_transit", "out_for_delivery", "delivered", "exception", "returned"])
    .optional(),
  shipped_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  notes: z.string().optional(),
});

type CreateFormData = z.infer<typeof createFormSchema>;
type UpdateFormData = z.infer<typeof updateFormSchema>;

interface OutboundShipmentFormProps {
  mode: "create" | "edit";
  initialData?: OutboundShipment;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Common carriers for dropdown
const CARRIERS = [
  { value: "australia-post", label: "Australia Post" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "tnt", label: "TNT" },
  { value: "ups", label: "UPS" },
  { value: "startrack", label: "StarTrack" },
  { value: "toll", label: "Toll" },
  { value: "other", label: "Other" },
];

// Warehouse locations
const WAREHOUSE_LOCATIONS = [
  { value: "brisbane", label: "Brisbane Warehouse" },
  { value: "sydney", label: "Sydney Warehouse" },
  { value: "melbourne", label: "Melbourne Warehouse" },
];

// Shipment statuses for edit mode
const SHIPMENT_STATUSES: { value: OutboundShipmentStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "exception", label: "Exception" },
  { value: "returned", label: "Returned" },
];

export function OutboundShipmentForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: OutboundShipmentFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateFormData | UpdateFormData>({
    resolver: zodResolver(mode === "create" ? createFormSchema : updateFormSchema),
    defaultValues:
      mode === "edit" && initialData
        ? {
            carrier_name: initialData.carrier_name || "",
            carrier_service: initialData.carrier_service || "",
            tracking_number: initialData.tracking_number || "",
            status: initialData.status,
            shipped_date: initialData.shipped_date
              ? new Date(initialData.shipped_date).toISOString().split("T")[0]
              : "",
            expected_delivery_date: initialData.expected_delivery_date
              ? new Date(initialData.expected_delivery_date).toISOString().split("T")[0]
              : "",
            actual_delivery_date: initialData.actual_delivery_date
              ? new Date(initialData.actual_delivery_date).toISOString().split("T")[0]
              : "",
            notes: initialData.notes || "",
          }
        : {
            order_id: "",
            carrier_name: "",
            carrier_service: "",
            tracking_number: "",
            origin_location: "brisbane",
            destination_address: "",
            shipped_date: "",
            expected_delivery_date: "",
            notes: "",
          },
  });

  // Autosave hook - prevents data loss on dialog close/navigation
  const draftKey = mode === "edit" ? `shipment-form-${initialData?.id}` : "shipment-form-new";
  const { hasDraft, draftMetadata, loadDraft, clearDraft } = useAutosave({
    key: draftKey,
    formValues: form.watch(),
    onRestore: (draft) => {
      Object.keys(draft).forEach((key) => {
        form.setValue(key as keyof (CreateFormData | UpdateFormData), draft[key]);
      });
    },
    enabled: open && mode === "create",
    debounceMs: 2000,
  });

  async function onSubmit(values: CreateFormData | UpdateFormData) {
    setIsLoading(true);

    try {
      if (mode === "create") {
        await outboundShipmentsApi.create(values as OutboundShipmentCreate);
        toast({
          title: "Success",
          description: "Shipment created successfully",
        });
      } else if (initialData) {
        await outboundShipmentsApi.update(initialData.id, values);
        toast({
          title: "Success",
          description: "Shipment updated successfully",
        });
      }

      clearDraft(); // Clear autosave draft on success
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      toast({
        variant: "destructive",
        title: mode === "create" ? "Create Failed" : "Update Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Draft Recovery Alert */}
        {hasDraft && mode === "create" && draftMetadata && (
          <DraftRecoveryAlert
            savedAt={draftMetadata.savedAt}
            onRestore={loadDraft}
            onDiscard={clearDraft}
          />
        )}

        {/* Create-only fields */}
        {mode === "create" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Order & Location</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00000000-0000-0000-0000-000000000000"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>UUID of the customer order</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="origin_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin Warehouse *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WAREHOUSE_LOCATIONS.map((location) => (
                          <SelectItem key={location.value} value={location.value}>
                            {location.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="destination_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Shipping address (optional if already on order)"
                      className="min-h-[60px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Edit-only fields */}
        {mode === "edit" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipment Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SHIPMENT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Carrier Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Carrier Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="carrier_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carrier</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CARRIERS.map((carrier) => (
                        <SelectItem key={carrier.value} value={carrier.value}>
                          {carrier.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="carrier_service"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Level</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Express, Standard" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tracking_number"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Tracking Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter tracking number"
                      className="font-mono"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Shipping Dates</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="shipped_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipped Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="date" {...field} disabled={isLoading} />
                      <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expected_delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Delivery</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="date" {...field} disabled={isLoading} />
                      <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "edit" && (
              <FormField
                control={form.control}
                name="actual_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Delivery</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="date" {...field} disabled={isLoading} />
                        <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormDescription>Auto-filled on delivered status</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional shipping notes..."
                  className="min-h-[100px]"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Shipment" : "Update Shipment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
