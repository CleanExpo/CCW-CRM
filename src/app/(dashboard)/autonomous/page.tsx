/**
 * Autonomous Execution Dashboard
 *
 * Real-time progress monitoring for autonomous execution workflows.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseTimeline } from '@/components/autonomous/PhaseTimeline';
import { ApprovalGateDialog } from '@/components/autonomous/ApprovalGateDialog';
import { ControlPanel } from '@/components/autonomous/ControlPanel';
import { FileChangesViewer } from '@/components/autonomous/FileChangesViewer';
import {
  autonomousApi,
  type TaskState,
  type ApprovalGate,
  type AutonomousEvent,
} from '@/lib/api/autonomous';
import { useToast } from '@/hooks/use-toast';
import { Clock, User, Zap } from 'lucide-react';

export default function AutonomousPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('task_id');
  const { toast } = useToast();

  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentGate, setCurrentGate] = useState<ApprovalGate | null>(null);
  const [showGateDialog, setShowGateDialog] = useState(false);
  const [events, setEvents] = useState<AutonomousEvent[]>([]);

  const loadTaskState = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await autonomousApi.getTaskStatus(taskId);
      if (response.exists && response.state) {
        setTaskState(response.state);
        setError(null);
      } else {
        setError('Task not found');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Load task state
  useEffect(() => {
    if (!taskId) {
      setError('No task ID provided');
      setLoading(false);
      return;
    }

    loadTaskState();
  }, [taskId, loadTaskState]);

  // Subscribe to SSE events
  useEffect(() => {
    if (!taskId || !taskState) return;

    const eventSource = autonomousApi.subscribeToEvents(taskId, (event) => {
      setEvents((prev) => [...prev, event].slice(-50)); // Keep last 50 events

      // Reload task state on phase transitions
      if (
        event.event === 'phase_completed' ||
        event.event === 'gate_pending' ||
        event.event === 'task_completed'
      ) {
        loadTaskState();
      }
    });

    return () => {
      eventSource.close();
    };
  }, [taskId, taskState, loadTaskState]);

  // Check for pending gates
  useEffect(() => {
    if (!taskState || taskState.approval_mode !== 'manual') return;

    const pendingGate = taskState.approval_gates.find((g) => g.status === 'pending');
    if (pendingGate && pendingGate.gate_id !== currentGate?.gate_id) {
      setCurrentGate(pendingGate);
      setShowGateDialog(true);
    }
  }, [taskState, currentGate?.gate_id]);

  const handleStatusChange = (status: TaskState['status']) => {
    if (taskState) {
      setTaskState({ ...taskState, status });
    }
  };

  const handleGateApproved = () => {
    loadTaskState();
  };

  const handleGateRejected = () => {
    loadTaskState();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="text-muted-foreground text-sm">Loading execution state...</p>
        </div>
      </div>
    );
  }

  if (error || !taskState) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || 'Task not found'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autonomous Execution</h1>
          <p className="text-muted-foreground text-sm">
            Task ID: <span className="font-mono">{taskState.task_id}</span>
          </p>
        </div>
        <ControlPanel
          taskId={taskState.task_id}
          status={taskState.status}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Task Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Task Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">Request:</p>
            <p className="font-medium">{taskState.user_request}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Current Agent</p>
                <p className="text-sm font-medium">{taskState.current_agent}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Elapsed Time</p>
                <p className="text-sm font-medium">{taskState.metadata.elapsed_time_minutes} min</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Approval Mode</p>
                <p className="text-sm font-medium capitalize">{taskState.approval_mode}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseTimeline
            currentPhase={taskState.current_phase}
            phasesCompleted={taskState.phases_completed}
            status={taskState.status}
          />
        </CardContent>
      </Card>

      {/* File Changes */}
      <FileChangesViewer
        filesCreated={taskState.metadata.files_created || []}
        filesModified={taskState.metadata.files_modified || []}
      />

      {/* Event Log */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>Recent execution events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events yet. Waiting for updates...</p>
            ) : (
              events.map((event, index) => (
                <div key={index} className="bg-card rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{event.event.replace(/_/g, ' ')}</p>
                      <p className="text-muted-foreground text-xs">{event.message}</p>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Gate Dialog */}
      {currentGate && (
        <ApprovalGateDialog
          taskId={taskState.task_id}
          gate={currentGate}
          open={showGateDialog}
          onOpenChange={setShowGateDialog}
          onApproved={handleGateApproved}
          onRejected={handleGateRejected}
        />
      )}
    </div>
  );
}
