"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useSearchState } from "@/lib/hooks/use-search-state";
import { useToast } from "@/hooks/use-toast";
import { activitiesApi } from "@/lib/api/activities";
import type { ActivityWithRelations, ActivityType } from "@/lib/types/activities";
import { ActivityForm } from "./components/ActivityForm";
import { DeleteActivityDialog } from "./components/DeleteActivityDialog";
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
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: "activities-list",
    defaultState: {
      page: 1,
      pageSize: 50,
      search: "",
      activityType: "all",
      includeCompleted: true,
    },
  });

  // Load activities
  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await activitiesApi.list({
        page: searchState.page,
        page_size: searchState.pageSize,
        activity_type:
          searchState.activityType === "all" ? undefined : (searchState.activityType as ActivityType),
        include_completed: searchState.includeCompleted,
      });

      setActivities(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load activities";
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setLoading(false);
    }
  }, [searchState, toast]);

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

  useEffect(() => {
    loadActivities();
    loadStats();
  }, [loadActivities, loadStats]);

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
      call: "text-blue-600 bg-blue-100",
      email: "text-purple-600 bg-purple-100",
      meeting: "text-green-600 bg-green-100",
      note: "text-gray-600 bg-gray-100",
      task: "text-orange-600 bg-orange-100",
    };
    return colors[type] || "text-gray-600 bg-gray-100";
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
        title: "Success",
        description: "Task marked as complete",
      });
      loadActivities();
      loadStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to complete task";
      toast({ variant: "destructive", title: "Error", description: message });
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
    if (activity.activity_type !== "task" || !activity.due_date || activity.completed_at) {
      return false;
    }
    return isPast(new Date(activity.due_date));
  };

  // Table columns
  const columns = [
    {
      key: "type",
      label: "Type",
      render: (activity: ActivityWithRelations) => (
        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md ${getActivityColor(activity.activity_type)}`}>
          {getActivityIcon(activity.activity_type)}
          <span className="capitalize text-sm font-medium">{activity.activity_type}</span>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (activity: ActivityWithRelations) => (
        <div className="space-y-1">
          <div className="font-medium">{activity.subject}</div>
          {activity.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">
              {activity.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "related",
      label: "Related To",
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
      key: "date",
      label: "Date",
      render: (activity: ActivityWithRelations) => (
        <div className="text-sm">
          <div>{format(new Date(activity.created_at), "MMM dd, yyyy")}</div>
          <div className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (activity: ActivityWithRelations) => (
        <div>
          {activity.activity_type === "task" && (
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
            <div className="text-xs text-muted-foreground mt-1">
              Due: {format(new Date(activity.due_date), "MMM dd")}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (activity: ActivityWithRelations) => (
        <div className="flex gap-1">
          {activity.activity_type === "task" && !activity.completed_at && (
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">
            Track customer interactions and manage tasks
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_tasks}</div>
            <p className="text-xs text-muted-foreground">Incomplete tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue_tasks}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_this_week}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => handleQuickCreate("call" as ActivityType)} variant="outline">
            <Phone className="mr-2 h-4 w-4" />
            Log Call
          </Button>
          <Button onClick={() => handleQuickCreate("email" as ActivityType)} variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Log Email
          </Button>
          <Button onClick={() => handleQuickCreate("meeting" as ActivityType)} variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Button>
          <Button onClick={() => handleQuickCreate("task" as ActivityType)} variant="outline">
            <CheckSquare className="mr-2 h-4 w-4" />
            Create Task
          </Button>
          <Button onClick={() => handleQuickCreate("note" as ActivityType)} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Activity Type</label>
            <Select
              value={searchState.activityType}
              onValueChange={(value) => updateField("activityType", value)}
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
            <label className="text-sm font-medium mb-2 block">Include Completed</label>
            <Select
              value={searchState.includeCompleted ? "yes" : "no"}
              onValueChange={(value) => updateField("includeCompleted", value === "yes")}
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
            <label className="text-sm font-medium mb-2 block">Page Size</label>
            <Select
              value={searchState.pageSize.toString()}
              onValueChange={(value) => updateField("pageSize", parseInt(value))}
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

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Activities ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <ActivityIcon className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activities found</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your customer interactions!
              </p>
              <Button onClick={() => setActivityFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Log First Activity
              </Button>
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
                    currentPage={searchState.page}
                    totalPages={totalPages}
                    pageSize={searchState.pageSize}
                    totalItems={total}
                    onPageChange={(page) => updateField("page", page)}
                    onPageSizeChange={(pageSize) => updateField("pageSize", pageSize)}
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
