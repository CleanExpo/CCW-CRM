/**
 * PHASE 4: Draft Recovery Alert Component
 *
 * Shows a banner when a draft is available, with options to restore or discard.
 */

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface DraftRecoveryAlertProps {
  /** When the draft was saved */
  savedAt: string;

  /** Callback to restore the draft */
  onRestore: () => void;

  /** Callback to discard the draft */
  onDiscard: () => void;

  /** Optional custom message */
  message?: string;
}

export function DraftRecoveryAlert({
  savedAt,
  onRestore,
  onDiscard,
  message,
}: DraftRecoveryAlertProps) {
  const timeAgo = formatDistanceToNow(new Date(savedAt), { addSuffix: true });

  return (
    <Alert className="mb-4 border-blue-500 bg-blue-50">
      <AlertCircle className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-900">Draft Available</AlertTitle>
      <AlertDescription className="text-blue-800">
        {message || `You have unsaved work from ${timeAgo}.`}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={onRestore}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Restore Draft
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
