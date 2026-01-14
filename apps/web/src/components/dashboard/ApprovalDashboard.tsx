'use client';

import { useState, useEffect } from 'react';

interface PendingApproval {
    id: string;
    agentName: string;
    toolName: string;
    content: unknown;
    rationale: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
    interruptionMessage: string;
}

/**
 * CCW Approval Dashboard
 * Displays pending agent approvals with CCW Navy/Gold branding
 */
export function ApprovalDashboard() {
    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchApprovals();
        // Poll for new approvals every 5 seconds
        const interval = setInterval(fetchApprovals, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchApprovals = async () => {
        try {
            const res = await fetch('/api/approvals');
            const data = await res.json();
            setApprovals(data.pendingApprovals?.filter((a: PendingApproval) => a.status === 'pending') || []);
        } catch (error) {
            console.error('Failed to fetch approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        try {
            await fetch(`/api/approvals/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            fetchApprovals();
        } catch (error) {
            console.error(`Failed to ${action}:`, error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#003366' }} />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ backgroundColor: '#003366' }}
            >
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">CCW Approval Dashboard</h2>
                    {approvals.length > 0 && (
                        <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: '#FFCC00', color: '#003366' }}
                        >
                            {approvals.length} Pending
                        </span>
                    )}
                </div>
                <button
                    onClick={fetchApprovals}
                    className="text-white/70 hover:text-white text-sm"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {approvals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-2">No pending approvals</p>
                        <p className="text-xs text-gray-400">Agent actions will appear here when they need review</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {approvals.map((approval) => (
                            <div
                                key={approval.id}
                                className="border rounded-lg overflow-hidden"
                                style={{ borderColor: '#FFCC00' }}
                            >
                                {/* Approval Header */}
                                <div
                                    className="px-4 py-3 flex items-center justify-between"
                                    style={{ backgroundColor: '#FFCC0020' }}
                                >
                                    <div>
                                        <span className="font-semibold" style={{ color: '#003366' }}>
                                            {approval.agentName}
                                        </span>
                                        <span className="mx-2 text-gray-400">→</span>
                                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                                            {approval.toolName}
                                        </code>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(approval.createdAt).toLocaleString('en-AU')}
                                    </span>
                                </div>

                                {/* Message */}
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <p className="text-sm font-medium text-gray-700">
                                        {approval.interruptionMessage}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{approval.rationale}</p>
                                </div>

                                {/* Expandable Content */}
                                <div className="px-4 py-2">
                                    <button
                                        onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                                        className="text-sm hover:underline"
                                        style={{ color: '#003366' }}
                                    >
                                        {expandedId === approval.id ? '▼ Hide Content' : '▶ View Content'}
                                    </button>
                                    {expandedId === approval.id && (
                                        <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-48">
                                            {JSON.stringify(approval.content, null, 2)}
                                        </pre>
                                    )}
                                </div>

                                {/* Actions */}
                                <div
                                    className="px-4 py-3 flex gap-3"
                                    style={{ backgroundColor: '#f8f9fa' }}
                                >
                                    <button
                                        onClick={() => handleAction(approval.id, 'approve')}
                                        className="px-4 py-2 text-sm font-medium rounded transition-colors"
                                        style={{
                                            backgroundColor: '#003366',
                                            color: 'white',
                                        }}
                                    >
                                        ✓ Approve
                                    </button>
                                    <button
                                        onClick={() => handleAction(approval.id, 'reject')}
                                        className="px-4 py-2 text-sm font-medium rounded border transition-colors hover:bg-red-50"
                                        style={{
                                            borderColor: '#dc2626',
                                            color: '#dc2626',
                                        }}
                                    >
                                        ✕ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ApprovalDashboard;
