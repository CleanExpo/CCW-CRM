'use client';

import { useState } from 'react';
import { ServiceStatus, Branch } from '@prisma/client';
import { EquipmentCard } from '../ui/EquipmentCard';
import { useWidgetState } from '../../hooks/useWidgetState';

const KANBAN_COLUMNS: { status: ServiceStatus; label: string }[] = [
    { status: 'InQueue', label: 'In Queue' },
    { status: 'Diagnosing', label: 'Diagnosing' },
    { status: 'WaitingParts', label: 'Waiting Parts' },
    { status: 'Testing', label: 'Testing' },
    { status: 'Ready', label: 'Ready' },
];

const BRANCHES: { value: Branch | 'all'; label: string }[] = [
    { value: 'all', label: 'All Branches' },
    { value: 'Boondall', label: 'QLD - Boondall' },
    { value: 'SevenHills', label: 'NSW - Seven Hills' },
    { value: 'Bayswater', label: 'VIC - Bayswater' },
];

/**
 * KanbanBoard Component
 * Service queue management with drag-drop and agent activity feed
 */
export function KanbanBoard() {
    const {
        filteredEquipment,
        agentActivities,
        isLoading,
        selectedBranch,
        setBranchFilter,
        handleKanbanUpdate,
    } = useWidgetState();

    const [draggedId, setDraggedId] = useState<string | null>(null);

    const handleDragStart = (equipmentId: string) => {
        setDraggedId(equipmentId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (targetStatus: ServiceStatus) => {
        if (draggedId) {
            handleKanbanUpdate(draggedId, targetStatus);
            setDraggedId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003366]" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ backgroundColor: '#003366' }}
            >
                <h1 className="text-xl font-bold text-white">Service Queue</h1>

                {/* Branch Filter */}
                <div className="flex gap-2">
                    {BRANCHES.map((branch) => (
                        <button
                            key={branch.value}
                            onClick={() => setBranchFilter(branch.value)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selectedBranch === branch.value
                                    ? 'bg-[#FFCC00] text-[#003366]'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {branch.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Kanban Columns */}
                <div className="flex-1 flex overflow-x-auto p-4 gap-4 bg-gray-100">
                    {KANBAN_COLUMNS.map((column) => {
                        const columnEquipment = filteredEquipment.filter(
                            (eq) => eq.status === column.status
                        );

                        return (
                            <div
                                key={column.status}
                                className="flex-shrink-0 w-72 bg-gray-50 rounded-lg border border-gray-200"
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(column.status)}
                            >
                                {/* Column Header */}
                                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                    <span className="font-semibold text-gray-700">{column.label}</span>
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                                        style={{
                                            backgroundColor: column.status === 'Ready' ? '#FFCC00' : '#e5e7eb',
                                            color: column.status === 'Ready' ? '#003366' : '#374151',
                                        }}
                                    >
                                        {columnEquipment.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-2 space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                                    {columnEquipment.map((equipment) => (
                                        <div
                                            key={equipment.id}
                                            draggable
                                            onDragStart={() => handleDragStart(equipment.id)}
                                            className="cursor-grab active:cursor-grabbing"
                                        >
                                            <EquipmentCard
                                                id={equipment.id}
                                                serialNumber={equipment.serialNumber}
                                                model={equipment.model as any}
                                                brand={equipment.brand}
                                                currentBranch={equipment.currentBranch}
                                                status={equipment.status}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Agent Activity Feed */}
                <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: '#003366' }}>
                        <h2 className="font-semibold text-white text-sm">Agent Activity</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {agentActivities.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-4">No recent activity</p>
                        ) : (
                            agentActivities.map((activity) => (
                                <div
                                    key={activity.id}
                                    className="p-2 bg-gray-50 rounded border border-gray-100 text-xs"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-[#003366]">{activity.agentName}</span>
                                        <span className="text-gray-400">
                                            {activity.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-gray-600">
                                        <code className="bg-gray-200 px-1 rounded">{activity.action}</code>
                                        {activity.details && <span className="ml-1">{activity.details}</span>}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default KanbanBoard;
