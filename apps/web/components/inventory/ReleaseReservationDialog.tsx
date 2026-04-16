'use client';

import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { inventoryApi } from '@/lib/api/inventory';
import type { StockReservation } from '@/lib/types/inventory';

interface ReleaseReservationDialogProps {
  reservation: StockReservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReleaseReservationDialog({
  reservation,
  open,
  onOpenChange,
  onSuccess,
}: ReleaseReservationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleRelease() {
    if (!reservation) return;

    setIsLoading(true);
    try {
      await inventoryApi.releaseReservation(reservation.id);

      toast({
        title: 'Success',
        description: 'Reservation released successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to release reservation';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!reservation) return null;

  const formatLocation = (location: string) => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release Reservation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will release <span className="font-semibold">{reservation.quantity} units</span> of{' '}
            <span className="font-semibold">{reservation.product_name || 'this product'}</span>
            {reservation.product_sku && (
              <span className="font-mono"> ({reservation.product_sku})</span>
            )}{' '}
            at <span className="font-semibold">{formatLocation(reservation.location)}</span>{' '}
            reserved for order{' '}
            <span className="font-semibold">
              {reservation.order_number || reservation.order_id}
            </span>
            .
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRelease} disabled={isLoading}>
            {isLoading ? 'Releasing...' : 'Release'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
