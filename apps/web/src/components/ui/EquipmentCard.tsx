'use client';

import { ServiceStatus, Branch, EquipmentModel } from '@prisma/client';

interface EquipmentCardProps {
    id: string;
    serialNumber: string;
    model: EquipmentModel;
    brand: string;
    currentBranch: Branch;
    status: ServiceStatus;
    onStatusChange?: (id: string, newStatus: ServiceStatus) => void;
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
    InQueue: 'In Queue',
    Diagnosing: 'Diagnosing',
    WaitingParts: 'Waiting Parts',
    Testing: 'Testing',
    Ready: 'Ready',
};

const BRANCH_LABELS: Record<Branch, { label: string; state: string }> = {
    Boondall: { label: 'Boondall', state: 'QLD' },
    SevenHills: { label: 'Seven Hills', state: 'NSW' },
    Bayswater: { label: 'Bayswater', state: 'VIC' },
};

/**
 * Equipment Card Component
 * Displays equipment info with CCW Navy/Gold styling
 */
export function EquipmentCard({
    id,
    serialNumber,
    model,
    brand,
    currentBranch,
    status,
    onStatusChange,
}: EquipmentCardProps) {
    const branchInfo = BRANCH_LABELS[currentBranch];
    const isReady = status === 'Ready';

    return (
        <div
            className="rounded-lg overflow-hidden shadow-md bg-white border border-gray-200 hover:shadow-lg transition-shadow"
            draggable
            data-equipment-id={id}
        >
            {/* Header - CCW Navy */}
            <div className="px-4 py-3" style={{ backgroundColor: '#003366' }}>
                <div className="flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">{serialNumber}</span>
                    <span className="text-xs text-blue-200">{model}</span>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Brand */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Brand</span>
                    <span className="font-medium text-gray-900">{brand}</span>
                </div>

                {/* Branch */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Location</span>
                    <span className="text-gray-700">
                        {branchInfo.label}{' '}
                        <span className="text-xs text-gray-400">({branchInfo.state})</span>
                    </span>
                </div>

                {/* Status Badge - CCW Gold accent */}
                <div className="pt-2">
                    <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                            backgroundColor: isReady ? '#FFCC00' : '#f3f4f6',
                            color: isReady ? '#003366' : '#374151',
                        }}
                    >
                        {isReady && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                        {STATUS_LABELS[status]}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default EquipmentCard;
