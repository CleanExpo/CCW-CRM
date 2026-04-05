/**
 * Phase Timeline Component
 *
 * Displays 5-phase execution progress with dots:
 * - Pending (gray)
 * - Active (blue pulse animation)
 * - Complete (green check)
 * - Failed (red X)
 */

import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Phase {
  id: number;
  name: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  elapsed_time?: number;
}

interface PhaseTimelineProps {
  currentPhase: number;
  phasesCompleted: number[];
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
}

const PHASES: Omit<Phase, 'status' | 'elapsed_time'>[] = [
  { id: 1, name: 'Discovery', agent: 'Discovery Agent' },
  { id: 2, name: 'Architecture', agent: 'Architect Agent' },
  { id: 3, name: 'Build', agent: 'Builder Agent' },
  { id: 4, name: 'Build Final', agent: 'Builder Agent' },
  { id: 5, name: 'Finalize', agent: 'Finalizer Agent' },
];

export function PhaseTimeline({ currentPhase, phasesCompleted, status }: PhaseTimelineProps) {
  const getPhaseStatus = (phaseId: number): Phase['status'] => {
    if (phasesCompleted.includes(phaseId)) {
      return 'completed';
    }
    if (phaseId === currentPhase) {
      if (status === 'failed') return 'failed';
      return 'in_progress';
    }
    return 'pending';
  };

  const phases: Phase[] = PHASES.map((p) => ({
    ...p,
    status: getPhaseStatus(p.id),
  }));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {phases.map((phase, index) => (
          <div key={phase.id} className="flex items-center">
            {/* Phase Dot */}
            <div className="flex flex-col items-center">
              <div className="relative">
                {phase.status === 'completed' && (
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                )}
                {phase.status === 'failed' && <XCircle className="h-10 w-10 text-red-600" />}
                {phase.status === 'in_progress' && (
                  <div className="relative">
                    <Circle className="h-10 w-10 fill-blue-600 text-blue-600" />
                    <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full bg-blue-400 opacity-75" />
                  </div>
                )}
                {phase.status === 'pending' && <Circle className="h-10 w-10 text-gray-400" />}
              </div>

              {/* Phase Label */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    'text-sm font-medium',
                    phase.status === 'completed' && 'text-green-600',
                    phase.status === 'failed' && 'text-red-600',
                    phase.status === 'in_progress' && 'text-blue-600',
                    phase.status === 'pending' && 'text-gray-400'
                  )}
                >
                  {phase.name}
                </p>
                <p className="text-xs text-gray-500">{phase.agent}</p>
              </div>
            </div>

            {/* Connector Line */}
            {index < phases.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-1 w-16',
                  phase.status === 'completed' && 'bg-green-600',
                  phase.status === 'in_progress' && 'bg-gray-300',
                  phase.status === 'pending' && 'bg-gray-300',
                  phase.status === 'failed' && 'bg-red-600'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
