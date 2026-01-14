/**
 * Pending Approvals Page
 *
 * Displays all agent decisions that require human approval.
 * Allows reviewing decision details and approving/rejecting them.
 */

import { Metadata } from 'next';
import { PendingDecisionsList } from '@/components/autonomy/pending-decisions-list';

export const metadata: Metadata = {
  title: 'Pending Approvals | CCW ERP',
  description: 'Review and approve pending agent decisions',
};

export default function PendingApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve decisions from AI agents that require human oversight.
        </p>
      </div>

      <PendingDecisionsList />
    </div>
  );
}
