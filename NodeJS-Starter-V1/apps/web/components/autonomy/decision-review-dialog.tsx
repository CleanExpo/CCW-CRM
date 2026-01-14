'use client';

/**
 * Decision Review Dialog Component
 *
 * Modal dialog for reviewing agent decision details.
 * Allows approving or rejecting the decision with a reason.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import {
  approveDecision,
  rejectDecision,
  formatConfidence,
  getRiskColor,
} from '@/lib/api/autonomy';
import type { AgentDecision } from '@/lib/types/autonomy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DecisionReviewDialogProps {
  decision: AgentDecision;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export function DecisionReviewDialog({
  decision,
  isOpen,
  onClose,
  onResolved,
}: DecisionReviewDialogProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      // TODO: Get actual user ID from auth context
      const userId = '00000000-0000-0000-0000-000000000000';
      await approveDecision(decision.decision_id, userId);

      toast({
        title: 'Decision Approved',
        description: 'The decision has been approved and will be executed.',
      });

      onResolved();
    } catch (error) {
      console.error('Failed to approve decision:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve decision',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRejecting(true);
      // TODO: Get actual user ID from auth context
      const userId = '00000000-0000-0000-0000-000000000000';
      await rejectDecision(decision.decision_id, userId, rejectionReason);

      toast({
        title: 'Decision Rejected',
        description: 'The decision has been rejected.',
      });

      onResolved();
    } catch (error) {
      console.error('Failed to reject decision:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject decision',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const createdAt = new Date(decision.created_at);
  const expiresAt = decision.expires_at ? new Date(decision.expires_at) : null;
  const isExpiringSoon =
    expiresAt && expiresAt.getTime() - Date.now() < 3600000; // < 1 hour

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {decision.decision_type.replace(/_/g, ' ').toUpperCase()}
            <Badge className={getRiskColor(decision.risk_level)}>
              {decision.risk_level.toUpperCase()} RISK
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Agent: {decision.agent_id} • Confidence:{' '}
            {formatConfidence(decision.confidence)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expiration warning */}
          {isExpiringSoon && expiresAt && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Expiring Soon</AlertTitle>
              <AlertDescription>
                This decision will expire{' '}
                {formatDistanceToNow(expiresAt, { addSuffix: true })}. Please review
                and approve/reject before it expires.
              </AlertDescription>
            </Alert>
          )}

          {/* Decision Details */}
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold text-sm">Decision Details</h3>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <div className="font-medium">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </div>
              </div>
              {expiresAt && (
                <div>
                  <span className="text-muted-foreground">Expires:</span>
                  <div className="font-medium">
                    {formatDistanceToNow(expiresAt, { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>

            {/* Financial Impact */}
            {(decision.estimated_value !== undefined ||
              decision.estimated_quantity !== undefined) && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Estimated Impact:
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {decision.estimated_value !== undefined && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        ${decision.estimated_value.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {decision.estimated_quantity !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Quantity: </span>
                      <span className="font-medium">
                        {decision.estimated_quantity}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context */}
          {decision.context && Object.keys(decision.context).length > 0 && (
            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold text-sm">Context</h3>
              <div className="space-y-1">
                {Object.entries(decision.context).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}: </span>
                    <span className="font-medium">
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {decision.recommendation && (
            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold text-sm">Recommendation</h3>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(decision.recommendation, null, 2)}
              </pre>
            </div>
          )}

          {/* Rejection form */}
          {showRejectForm && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Provide a detailed reason for rejecting this decision..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This feedback will be used to improve the agent's future decisions.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center gap-2">
          {!showRejectForm ? (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isApproving || isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
                disabled={isApproving || isRejecting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
              >
                {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isApproving && <CheckCircle className="mr-2 h-4 w-4" />}
                Approve
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isRejecting && <XCircle className="mr-2 h-4 w-4" />}
                Confirm Rejection
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
