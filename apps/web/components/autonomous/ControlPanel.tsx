/**
 * Control Panel Component
 *
 * Provides pause/resume/cancel controls for autonomous execution.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { autonomousApi, type TaskStatus } from '@/lib/api/autonomous';
import { useToast } from '@/hooks/use-toast';

interface ControlPanelProps {
  taskId: string;
  status: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
}

export function ControlPanel({ taskId, status, onStatusChange }: ControlPanelProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handlePause = async () => {
    setIsLoading(true);
    try {
      await autonomousApi.pauseTask(taskId);
      toast({
        title: 'Task Paused',
        description: 'Execution has been paused. You can resume later.',
      });
      onStatusChange('paused');
    } catch (error: any) {
      toast({
        title: 'Pause Failed',
        description: error.message || 'Failed to pause task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await autonomousApi.resumeTask(taskId);
      toast({
        title: 'Task Resumed',
        description: 'Execution has resumed.',
      });
      onStatusChange('in_progress');
    } catch (error: any) {
      toast({
        title: 'Resume Failed',
        description: error.message || 'Failed to resume task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await autonomousApi.cancelTask(taskId);
      toast({
        title: 'Task Cancelled',
        description: 'Execution has been cancelled.',
      });
      onStatusChange('failed');
      setShowCancelDialog(false);
    } catch (error: any) {
      toast({
        title: 'Cancel Failed',
        description: error.message || 'Failed to cancel task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canPause = status === 'in_progress';
  const canResume = status === 'paused';
  const canCancel = status === 'in_progress' || status === 'paused';

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div className="bg-card flex items-center gap-2 rounded-lg border px-4 py-2">
          <div
            className={`h-2 w-2 rounded-full ${
              status === 'in_progress'
                ? 'animate-pulse bg-blue-600'
                : status === 'paused'
                  ? 'bg-yellow-600'
                  : status === 'completed'
                    ? 'bg-green-600'
                    : status === 'failed'
                      ? 'bg-red-600'
                      : 'bg-gray-400'
            }`}
          />
          <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
        </div>

        {/* Pause Button */}
        {canPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}

        {/* Resume Button */}
        {canResume && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResume}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Resume
          </Button>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current execution. This action cannot be undone.
              <br />
              <br />
              Task state will be saved and you can start a new execution later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground"
            >
              Cancel Execution
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
