'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export interface Activity {
  id: string;
  activity_type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  description: string | null;
  customer_id: string | null;
  contact_id: string | null;
  order_id: string | null;
  quote_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  contact_name?: string;
}

interface ActivityTimelineProps {
  customerId: string;
  onAddActivity: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activity: Activity) => void;
  refreshTrigger?: number;
}

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  task: <CheckCircle className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  call: 'bg-blue-500',
  email: 'bg-green-500',
  meeting: 'bg-purple-500',
  note: 'bg-yellow-500',
  task: 'bg-orange-500',
};

export function ActivityTimeline({
  customerId,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  refreshTrigger,
}: ActivityTimelineProps) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Activity[]>(`/api/activities/customer/${customerId}`);
      setActivities(response || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load activities';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, refreshTrigger]);

  const handleMarkComplete = async (activity: Activity) => {
    try {
      await apiClient.post(`/api/activities/${activity.id}/complete`);
      toast({
        title: 'Task completed',
        description: 'Activity marked as complete',
      });
      loadActivities();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete activity';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No activities recorded yet</p>
        <Button onClick={onAddActivity} variant="outline" className="mt-4">
          <Plus className="mr-2 h-4 w-4" />
          Log First Activity
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAddActivity} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Log Activity
        </Button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="bg-muted absolute top-0 bottom-0 left-5 w-0.5" />

        {/* Activity items */}
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="relative flex gap-4 pl-2">
              {/* Icon */}
              <div
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-white ${
                  activityColors[activity.activity_type] || 'bg-gray-500'
                }`}
              >
                {activityIcons[activity.activity_type] || <FileText className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className="bg-card flex-1 rounded-lg border p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.subject}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {activity.activity_type}
                      </Badge>
                      {activity.activity_type === 'task' && !activity.completed_at && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                      {activity.completed_at && (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {activity.description}
                      </p>
                    )}
                    <div className="text-muted-foreground flex items-center gap-4 text-xs">
                      <span>{format(new Date(activity.created_at), 'MMM dd, yyyy h:mm a')}</span>
                      {activity.contact_name && <span>Contact: {activity.contact_name}</span>}
                      {activity.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {format(new Date(activity.due_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {activity.activity_type === 'task' && !activity.completed_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkComplete(activity)}
                        title="Mark complete"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditActivity(activity)}
                      title="Edit activity"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteActivity(activity)}
                      title="Delete activity"
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
