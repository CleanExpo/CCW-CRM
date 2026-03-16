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
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ServiceRequest } from '@/lib/api/service-requests';

interface DeleteServiceRequestDialogProps {
  serviceRequest: ServiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteServiceRequestDialog({
  serviceRequest,
  open,
  onOpenChange,
  onSuccess,
}: DeleteServiceRequestDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    if (!serviceRequest) return;

    setIsLoading(true);
    try {
      await apiClient.delete(`/api/service-requests/${serviceRequest.id}`);
      toast({ title: 'Success', description: 'Service request deleted successfully' });
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete service request';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  if (!serviceRequest) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Service Request?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the service request for{' '}
            <span className="text-foreground font-semibold">
              {serviceRequest.equipment_description.slice(0, 60)}
              {serviceRequest.equipment_description.length > 60 ? '...' : ''}
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Deleting...' : 'Delete Request'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
