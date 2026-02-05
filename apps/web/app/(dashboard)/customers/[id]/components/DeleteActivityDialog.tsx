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
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Activity } from "./ActivityTimeline";

interface DeleteActivityDialogProps {
  activity: Activity;
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
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/activities/${activity.id}`);
      toast({
        title: "Activity deleted",
        description: "The activity has been deleted successfully.",
      });
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete activity";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Activity</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this activity?
            <br />
            <span className="font-semibold">{activity.subject}</span>
            <br />
            <span className="text-xs text-muted-foreground capitalize">
              Type: {activity.activity_type}
            </span>
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
