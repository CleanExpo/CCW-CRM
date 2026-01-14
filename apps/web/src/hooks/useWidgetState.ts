'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServiceStatus, Branch } from '@prisma/client';

interface Equipment {
    id: string;
    serialNumber: string;
    model: string;
    brand: string;
    currentBranch: Branch;
    status: ServiceStatus;
}

interface AgentActivity {
    id: string;
    timestamp: Date;
    agentName: string;
    action: string;
    details?: string;
}

interface WidgetState {
    equipment: Equipment[];
    agentActivities: AgentActivity[];
    isLoading: boolean;
    selectedBranch: Branch | 'all';
    pendingApprovals: string[];
}

/**
 * useWidgetState Hook
 * Manages real-time data sync between agents and UI
 */
export function useWidgetState() {
    const [state, setState] = useState<WidgetState>({
        equipment: [],
        agentActivities: [],
        isLoading: true,
        selectedBranch: 'all',
        pendingApprovals: [],
    });

    // Fetch equipment data
    const fetchEquipment = useCallback(async () => {
        try {
            const response = await fetch('/api/equipment');
            const data = await response.json();
            setState((prev) => ({ ...prev, equipment: data, isLoading: false }));
        } catch (error) {
            console.error('Failed to fetch equipment:', error);
            setState((prev) => ({ ...prev, isLoading: false }));
        }
    }, []);

    // Handle agent tool calls - triggered by update_kanban_stage
    const handleKanbanUpdate = useCallback(
        (equipmentId: string, newStatus: ServiceStatus) => {
            setState((prev) => ({
                ...prev,
                equipment: prev.equipment.map((eq) =>
                    eq.id === equipmentId ? { ...eq, status: newStatus } : eq
                ),
                agentActivities: [
                    {
                        id: crypto.randomUUID(),
                        timestamp: new Date(),
                        agentName: 'Service Orchestrator',
                        action: 'update_kanban_stage',
                        details: `Changed status to ${newStatus}`,
                    },
                    ...prev.agentActivities.slice(0, 49), // Keep last 50
                ],
            }));

            // HITL: If status is Ready, add to pending approvals
            if (newStatus === 'Ready') {
                setState((prev) => ({
                    ...prev,
                    pendingApprovals: [...prev.pendingApprovals, equipmentId],
                }));
            }
        },
        []
    );

    // Filter equipment by branch
    const setBranchFilter = useCallback((branch: Branch | 'all') => {
        setState((prev) => ({ ...prev, selectedBranch: branch }));
    }, []);

    // Get filtered equipment
    const filteredEquipment =
        state.selectedBranch === 'all'
            ? state.equipment
            : state.equipment.filter((eq) => eq.currentBranch === state.selectedBranch);

    // Clear pending approval
    const clearApproval = useCallback((equipmentId: string) => {
        setState((prev) => ({
            ...prev,
            pendingApprovals: prev.pendingApprovals.filter((id) => id !== equipmentId),
        }));
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchEquipment();
    }, [fetchEquipment]);

    return {
        ...state,
        filteredEquipment,
        fetchEquipment,
        handleKanbanUpdate,
        setBranchFilter,
        clearApproval,
    };
}

export default useWidgetState;
