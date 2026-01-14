'use client';

import { useState } from 'react';

interface PendingApproval {
    id: string;
    toolName: string;
    agentName: string;
    parameters: Record<string, unknown>;
    timestamp: string;
    state: string; // Serialized agent state JSON
}

interface HumanApprovalProps {
    pendingApprovals?: PendingApproval[];
    onApprove: (id: string) => void;
    onReject: (id: string, reason?: string) => void;
}

/**
 * Human-in-the-Loop Approval Dashboard
 * Displays pending agent actions that require human approval.
 */
export function HumanApproval({
    pendingApprovals = [],
    onApprove,
    onReject,
}: HumanApprovalProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    if (pendingApprovals.length === 0) {
        return (
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-center text-gray-500">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p className="mt-2 text-sm">No pending approvals</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full">
                    {pendingApprovals.length}
                </span>
                Pending Approvals
            </h2>

            {pendingApprovals.map((approval) => (
                <div
                    key={approval.id}
                    className="bg-white border border-amber-200 rounded-lg shadow-sm overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                        <div>
                            <span className="font-medium text-gray-900">{approval.toolName}</span>
                            <span className="ml-2 text-sm text-gray-500">
                                from {approval.agentName}
                            </span>
                        </div>
                        <span className="text-xs text-gray-400">
                            {new Date(approval.timestamp).toLocaleString()}
                        </span>
                    </div>

                    {/* Parameters */}
                    <div className="px-4 py-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Parameters:</h4>
                        <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(approval.parameters, null, 2)}
                        </pre>
                    </div>

                    {/* Expandable State */}
                    <div className="px-4 py-2 border-t border-gray-100">
                        <button
                            onClick={() =>
                                setExpandedId(expandedId === approval.id ? null : approval.id)
                            }
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            {expandedId === approval.id ? '▼ Hide' : '▶ Show'} Agent State
                        </button>
                        {expandedId === approval.id && (
                            <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto max-h-40">
                                {approval.state}
                            </pre>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
                        <button
                            onClick={() => onApprove(approval.id)}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                        >
                            ✓ Approve
                        </button>
                        <button
                            onClick={() => {
                                const reason = prompt('Rejection reason (optional):');
                                onReject(approval.id, reason || undefined);
                            }}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                        >
                            ✕ Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default HumanApproval;
