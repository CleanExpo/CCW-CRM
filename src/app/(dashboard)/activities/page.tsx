'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useSearchState } from '@/hooks/use-search-state';
import { useToast } from '@/hooks/use-toast';
import { activitiesApi } from '@/lib/api/activities';
import { slaApi } from '@/lib/api/sla';
import type { SLAInstance } from '@/lib/api/sla';
import type { ActivityWithRelations, ActivityType } from '@/types/activities';
import { ActivityForm } from './components/ActivityForm';
import { DeleteActivityDialog } from './components/DeleteActivityDialog';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  Plus,
  Activity as ActivityIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, differenceInMinutes } from 'date-fns';

// ---------------------------------------------------------------------------
// SLA helpers
// ---------------------------------------------------------------------------

/**
 * Returns minutes remaining until the SLA deadline (negative if breached).
 */
function minutesUntilDeadline(deadline: string): number {
  return differenceInMinutes(new Date(deadline), new Date());
}

/**
 * Renders the appropriate SLA badge for an activity row.
 * Returns null if no SLA instance is present for this activity.
 */
function SlaBadge({ instance }: { instance: SLAInstance | undefined }) {
  if (!instance) return null;

  if (instance.breached) {
    return (
      <Badge variant="destructive" className="ml-1 text-xs whitespace-nowrap">
        <Shield className="mr-1 h-3 w-3" />
        SLA Breached
      </Badge>
    );
  }

  const remaining = minutesUntilDeadline(instance.deadline);

  if (remaining <= 120) {
    // Within 2 hours
    return (
      <Badge
        variant="outline"
        className="ml-1 border-amber-400 bg-amber-50 text-xs whitespace-nowrap text-amber-700 dark:bg-amber-950 dark:text-amber-400"
      >
        <Clock className="mr-1 h-3 w-3" />
        Due Soon
      </Badge>
    );
  }

  const hours = Math.floor(remaining / 60);
  return (
    <Badge
      variant="outline"
      className="ml-1 border-green-400 bg-green-50 text-xs whitespace-nowrap text-green-700 dark:bg-green-950 dark:text-green-400"
    >
      <Shield className="mr-1 h-3 w-3" />
      {hours}h left
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // SLA state — best-effort, never blocks the page
  const [slaMap, setSlaMap] = useState<Map<string, SLAInstance>>(new Map());

  // Dialog states
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithRelations | null>(null);
  const [quickActivityType, setQuickActivityType] = useState<ActivityType | null>(null);

  // Summary stats
  const [stats, setStats] = useState({
    total: 0,
    pending_tasks: 0,
    overdue_tasks: 0,
    completed_this_week: 0,
  });

  // Search state persistence — added "activeTab" field
  const { state: searchState, updateField } = useSearchState({
    key: 'activities-list',
    defaultState: {
      page: 1,
      pageSize: 50,
      search: '',
      activityType: 'all',
      includeCompleted: true,
      activeTab: 'all', // "all" | "tasks" | "overdue"
    },
  });

  const activeTab = (searchState.activeTab as string) ?? 'all';

  // Derive activityType + includeCompleted from the active tab
  const resolvedActivityType: ActivityType | undefined = (() => {
    if (activeTab === 'tasks' || activeTab === 'overdue') return 'task' as ActivityType;
    if (searchState.activityType === 'all') return undefined;
    return searchState.activityType as ActivityType;
  })();

  const resolvedIncludeCompleted: boolean = (() => {
    if (activeTab === 'overdue') return false;
    return searchState.includeCompleted as boolean;
  })();

  // Load activities
  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await activitiesApi.list({
        page: searchState.page as number,
        page_size: searchState.pageSize as number,
        activity_type: resolvedActivityType,
        include_completed: resolvedIncludeCompleted,
      });

      setActivities(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load activities';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [searchState, resolvedActivityType, resolvedIncludeCompleted, toast]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const statsData = await activitiesApi.getStats();
      setStats({
        total: Object.values(statsData.by_type).reduce((sum, count) => sum + count, 0),
        pending_tasks: statsData.pending_tasks,
        overdue_tasks: statsData.overdue_tasks,
        completed_this_week: statsData.completed_this_week,
      });
    } catch {
      // Stats are non-critical — silently fail
    }
  }, []);

  // Load SLA instances — best-effort, silently swallowed on error
  const loadSlaInstances = useCallback(async () => {
    try {
      const instances = await slaApi.getInstances({ entity_type: 'activity' });
      const map = new Map<string, SLAInstance>();
      for (const inst of instances) {
        map.set(inst.entity_id, inst);
      }
      setSlaMap(map);
    } catch {
      // SLA endpoint may not exist yet — never break the page
    }
  }, []);

  useEffect(() => {
    loadActivities();
    loadStats();
    loadSlaInstances();
  }, [loadActivities, loadStats, loadSlaInstances]);

  // Activity type icons and colors
  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      call: <Phone className="h-4 w-4" />,
      email: <Mail className="h-4 w-4" />,
      meeting: <Calendar className="h-4 w-4" />,
      note: <FileText className="h-4 w-4" />,
      task: <CheckSquare className="h-4 w-4" />,
    };
    return icons[type] || <FileText className="h-4 w-4" />;
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      call: 'text-blue-600 bg-blue-100',
      email: 'text-purple-600 bg-purple-100',
      meeting: 'text-green-600 bg-green-100',
      note: 'text-gray-600 bg-gray-100',
      task: 'text-orange-600 bg-orange-100',
    };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  // Handle actions
  const handleEdit = (activity: ActivityWithRelations) => {
    setSelectedActivity(activity);
    setQuickActivityType(null);
    setActivityFormOpen(true);
  };

  const handleDelete = (activity: ActivityWithRelations) => {
    setSelectedActivity(activity);
    setDeleteDialogOpen(true);
  };

  const handleComplete = async (activity: ActivityWithRelations) => {
    try {
      await activitiesApi.complete(activity.id);
      toast({
        title: 'Success',
        description: 'Task marked as complete',
      });
      loadActivities();
      loadStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete task';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleQuickCreate = (type: ActivityType) => {
    setQuickActivityType(type);
    setSelectedActivity(null);
    setActivityFormOpen(true);
  };

  const handleSuccess = () => {
    loadActivities();
    loadStats();
    setSelectedActivity(null);
    setQuickActivityType(null);
  };

  // Check if task is overdue
  const isOverdue = (activity: ActivityWithRelations) => {
    if (activity.activity_type !== 'task' || !activity.due_date || activity.completed_at) {
      return false;
    }
    return isPast(new Date(activity.due_date));
  };

  // Table columns — SLA badge injected into the subject cell
  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (activity: ActivityWithRelations) => (
        <div
          className={`inline-flex items-center gap-2 rounded-md px-2 py-1 ${getActivityColor(activity.activity_type)}`}
        >
          {getActivityIcon(activity.activity_type)}
          <span className="text-sm font-medium capitalize">{activity.activity_type}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (activity: ActivityWithRelations) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-medium">{activity.subject}</span>
            <SlaBadge instance={slaMap.get(activity.id)} />
          </div>
          {activity.description && (
            <div className="text-muted-foreground line-clamp-1 text-sm">{activity.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'related',
      label: 'Related To',
      render: (activity: ActivityWithRelations) => (
        <div className="text-sm">
          {activity.customer_name && (
            <div className="flex items-center gap-1">
              <span className="font-medium">{activity.customer_name}</span>
            </div>
          )}
          {activity.contact_name && (
            <div className="text-muted-foreground">Contact: {activity.contact_name}</div>
          )}
          {activity.order_number && (
            <div className="text-muted-foreground">Order: {activity.order_number}</div>
          )}
          {activity.quote_number && (
            <div className="text-muted-foreground">Quote: {activity.quote_number}</div>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (activity: ActivityWithRelations) => (
        <div className="text-sm">
          <div>{format(new Date(activity.created_at), 'MMM dd, yyyy')}</div>
          <div className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (activity: ActivityWithRelations) => (
        <div>
          {activity.activity_type === 'task' && (
            <>
              {activity.completed_at ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              ) : isOverdue(activity) ? (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Overdue
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  Pending
                </Badge>
              )}
            </>
          )}
          {activity.due_date && !activity.completed_at && (
            <div className="text-muted-foreground mt-1 text-xs">
              Due: {format(new Date(activity.due_date), 'MMM dd')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (activity: ActivityWithRelations) => (
        <div className="flex gap-1">
          {activity.activity_type === 'task' && !activity.completed_at && (
            <Button size="sm" variant="ghost" onClick={() => handleComplete(activity)}>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleEdit(activity)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(activity)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Tab definitions
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">Track customer interactions and manage tasks</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <ActivityIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-muted-foreground text-xs">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_tasks}</div>
            <p className="text-muted-foreground text-xs">Incomplete tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="text-destructive h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">{stats.overdue_tasks}</div>
            <p className="text-muted-foreground text-xs">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_this_week}</div>
            <p className="text-muted-foreground text-xs">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => handleQuickCreate('call' as ActivityType)} variant="outline">
            <Phone className="mr-2 h-4 w-4" />
            Log Call
          </Button>
          <Button onClick={() => handleQuickCreate('email' as ActivityType)} variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Log Email
          </Button>
          <Button onClick={() => handleQuickCreate('meeting' as ActivityType)} variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Button>
          <Button onClick={() => handleQuickCreate('task' as ActivityType)} variant="outline">
            <CheckSquare className="mr-2 h-4 w-4" />
            Create Task
          </Button>
          <Button onClick={() => handleQuickCreate('note' as ActivityType)} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              updateField('activeTab', tab.key);
              updateField('page', 1);
            }}
            className={[
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            ].join(' ')}
          >
            {tab.label}
            {tab.key === 'overdue' && stats.overdue_tasks > 0 && (
              <span className="bg-destructive text-destructive-foreground ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold">
                {stats.overdue_tasks}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters (only shown on "All" tab) */}
      {activeTab === 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">Activity Type</label>
              <Select
                value={searchState.activityType as string}
                onValueChange={(value) => updateField('activityType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="email">Emails</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Include Completed</label>
              <Select
                value={(searchState.includeCompleted as boolean) ? 'yes' : 'no'}
                onValueChange={(value) => updateField('includeCompleted', value === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Page Size</label>
              <Select
                value={(searchState.pageSize as number).toString()}
                onValueChange={(value) => updateField('pageSize', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'tasks'
              ? `Tasks (${total})`
              : activeTab === 'overdue'
                ? `Overdue Tasks (${total})`
                : `All Activities (${total})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center">
              <ActivityIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
              <h3 className="mb-2 text-lg font-semibold">
                {activeTab === 'overdue'
                  ? 'No overdue tasks'
                  : activeTab === 'tasks'
                    ? 'No tasks found'
                    : 'No activities found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === 'overdue'
                  ? 'All tasks are on track!'
                  : activeTab === 'tasks'
                    ? 'Create a task to get started.'
                    : 'Start tracking your customer interactions!'}
              </p>
              {activeTab !== 'overdue' && (
                <Button onClick={() => setActivityFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {activeTab === 'tasks' ? 'Create Task' : 'Log First Activity'}
                </Button>
              )}
            </div>
          ) : (
            <>
              <ResponsiveTable
                columns={columns}
                data={activities}
                keyExtractor={(activity) => activity.id}
              />

              {totalPages > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={(searchState.page as number) ?? 1}
                    totalPages={totalPages}
                    pageSize={searchState.pageSize as number}
                    totalItems={total}
                    onPageChange={(page) => updateField('page', page)}
                    onPageSizeChange={(pageSize) => updateField('pageSize', pageSize)}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ActivityForm
        open={activityFormOpen}
        onOpenChange={setActivityFormOpen}
        activity={selectedActivity}
        quickType={quickActivityType}
        onSuccess={handleSuccess}
      />

      <DeleteActivityDialog
        activity={selectedActivity}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
