"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { activitiesApi } from "@/lib/api/activities";
import type { ActivityWithRelations } from "@/types/activities";

interface DeleteActivityDialogProps {
  activity: ActivityWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteActivityDialog({
  activity,
  open,
  onOpenChange,
  onSuccess,
}: DeleteActivityDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    if (!activity) return;

    setIsLoading(true);
    try {
      await activitiesApi.delete(activity.id);

      toast({
        title: "Success",
        description: "Activity deleted successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete activity";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!activity) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the{" "}
            <span className="font-semibold">{activity.activity_type}</span> activity{" "}
            <span className="font-semibold">&quot;{activity.subject}&quot;</span>.
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
