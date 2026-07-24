/**
 * Approval Gate Dialog Component
 *
 * Shows approval gate details and allows user to approve or reject.
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle } from 'lucide-react';
import { autonomousApi, type ApprovalGate } from '@/lib/api/autonomous';
import { useToast } from '@/hooks/use-toast';

interface ApprovalGateDialogProps {
  taskId: string;
  gate: ApprovalGate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
  onRejected: () => void;
}

export function ApprovalGateDialog({
  taskId,
  gate,
  open,
  onOpenChange,
  onApproved,
  onRejected,
}: ApprovalGateDialogProps) {
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await autonomousApi.approveGate(taskId, {
        gate_id: gate.gate_id,
        approved_by: 'user',
      });

      toast({
        title: 'Gate Approved',
        description: `${gate.name} has been approved. Execution will proceed.`,
      });

      onApproved();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve gate',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please provide feedback for rejection',
        variant: 'destructive',
      });
      return;
    }

    setIsRejecting(true);
    try {
      await autonomousApi.rejectGate(taskId, {
        gate_id: gate.gate_id,
        feedback: feedback.trim(),
        rejected_by: 'user',
      });

      toast({
        title: 'Gate Rejected',
        description: `${gate.name} has been rejected. Agent will revise and re-present.`,
      });

      onRejected();
      onOpenChange(false);
      setShowFeedbackForm(false);
      setFeedback('');
    } catch (error: unknown) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject gate',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🚪</span>
            Gate {gate.gate_id}: {gate.name}
          </DialogTitle>
          <DialogDescription>
            Phase {gate.phase} Complete. Approval Required to Proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h4 className="mb-2 font-semibold">What was accomplished:</h4>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">
                {gate.gate_id === 1 &&
                  'Codebase has been analyzed. Patterns, constraints, and relevant files have been identified.'}
                {gate.gate_id === 2 &&
                  'Architecture has been designed. Component specifications and file list are ready for implementation.'}
                {gate.gate_id === 3 &&
                  'Implementation is complete and all tests pass. Code is ready for deployment.'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Key artifacts:</h4>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Handoff document: phase-{gate.phase}-handoff.json</li>
              <li>Validation report: phase-{gate.phase}-validation.json</li>
            </ul>
          </div>

          {showFeedbackForm && (
            <div className="space-y-2">
              <Label htmlFor="feedback">Rejection Feedback *</Label>
              <Textarea
                id="feedback"
                placeholder="Explain what needs to be changed or improved..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-muted-foreground text-xs">
                The agent will use your feedback to revise Phase {gate.phase} and re-present at this
                gate.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!showFeedbackForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowFeedbackForm(true)}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isApproving ? 'Approving...' : 'Approve & Proceed'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeedbackForm(false);
                  setFeedback('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={isRejecting || !feedback.trim()}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                {isRejecting ? 'Rejecting...' : 'Submit Rejection'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
