'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { contactsApi } from '@/lib/api/contacts';
import { activitiesApi } from '@/lib/api/activities';
import { useToast } from '@/hooks/use-toast';
import type { ContactWithCustomer } from '@/types/contacts';
import type { ActivityWithRelations } from '@/types/activities';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Layers,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ContactForm } from '../components/ContactForm';
import { DeleteContactDialog } from '../components/DeleteContactDialog';
import { ActivityForm } from '../../customers/[id]/components/ActivityForm';
import { DeleteActivityDialog } from '../../customers/[id]/components/DeleteActivityDialog';
import type { Activity as TimelineActivity } from '../../customers/[id]/components/ActivityTimeline';

// ─── Activity display helpers ────────────────────────────────────────────────

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

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [contact, setContact] = useState<ContactWithCustomer | null>(null);
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // Edit contact dialog
  const [editFormOpen, setEditFormOpen] = useState(false);

  // Delete contact dialog
  const [deleteContactOpen, setDeleteContactOpen] = useState(false);

  // Activity dialogs
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [deleteActivityOpen, setDeleteActivityOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithRelations | null>(null);
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const loadContact = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contactsApi.get(id);
      setContact(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load contact';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const data = await activitiesApi.getContactTimeline(id);
      setActivities(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load activities';
      toast({ variant: 'destructive', title: 'Error', description: message });
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, activityRefreshTrigger]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleContactEditSuccess = () => {
    setEditFormOpen(false);
    loadContact();
  };

  const handleContactDeleteSuccess = () => {
    setDeleteContactOpen(false);
    toast({
      title: 'Contact deleted',
      description: 'The contact has been removed successfully.',
    });
    router.push('/dashboard/crm/contacts');
  };

  const handleAddActivity = () => {
    setSelectedActivity(null);
    setActivityFormOpen(true);
  };

  const handleEditActivity = (activity: TimelineActivity) => {
    setSelectedActivity(activity as ActivityWithRelations);
    setActivityFormOpen(true);
  };

  const handleDeleteActivity = (activity: TimelineActivity) => {
    setSelectedActivity(activity as ActivityWithRelations);
    setDeleteActivityOpen(true);
  };

  const handleMarkActivityComplete = async (activity: ActivityWithRelations) => {
    try {
      await activitiesApi.complete(activity.id);
      toast({ title: 'Task completed', description: 'Activity marked as complete' });
      setActivityRefreshTrigger((prev) => prev + 1);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete activity';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleActivitySuccess = () => {
    setActivityFormOpen(false);
    setDeleteActivityOpen(false);
    setSelectedActivity(null);
    setActivityRefreshTrigger((prev) => prev + 1);
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <User className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground text-lg font-medium">Contact not found</p>
        <Button onClick={() => router.push('/dashboard/crm/contacts')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = `${contact.first_name} ${contact.last_name}`;

  // Resolve company name: prefer ContactWithCustomer.customer_name, else fall back
  const companyName = contact.customer_name ?? (contact.customer_id ? 'Unknown Company' : null);

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Contacts', href: '/dashboard/crm/contacts' },
          { label: fullName },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/crm/contacts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{fullName}</h1>
            {contact.is_primary && <Badge variant="default">Primary</Badge>}
            <Badge variant={contact.is_active ? 'outline' : 'secondary'}>
              {contact.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {contact.job_title && <p className="text-muted-foreground">{contact.job_title}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditFormOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setDeleteContactOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Contact info card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="w-20 shrink-0 text-sm font-medium">Email:</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-primary truncate text-sm hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            )}

            {(contact.phone || contact.mobile) && (
              <div className="flex items-center gap-2">
                <Phone className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="w-20 shrink-0 text-sm font-medium">Phone:</span>
                <a
                  href={`tel:${contact.phone || contact.mobile}`}
                  className="text-primary text-sm hover:underline"
                >
                  {contact.phone || contact.mobile}
                </a>
              </div>
            )}

            {contact.mobile && contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="w-20 shrink-0 text-sm font-medium">Mobile:</span>
                <a href={`tel:${contact.mobile}`} className="text-primary text-sm hover:underline">
                  {contact.mobile}
                </a>
              </div>
            )}

            {contact.job_title && (
              <div className="flex items-center gap-2">
                <Briefcase className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="w-20 shrink-0 text-sm font-medium">Title:</span>
                <span className="text-muted-foreground text-sm">{contact.job_title}</span>
              </div>
            )}

            {contact.department && (
              <div className="flex items-center gap-2">
                <Layers className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="w-20 shrink-0 text-sm font-medium">Dept:</span>
                <span className="text-muted-foreground text-sm">{contact.department}</span>
              </div>
            )}

            {contact.notes && (
              <div className="border-t pt-2">
                <p className="text-muted-foreground mb-1 text-xs font-medium">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}

            {!contact.email &&
              !contact.phone &&
              !contact.mobile &&
              !contact.job_title &&
              !contact.department &&
              !contact.notes && (
                <p className="text-muted-foreground text-sm">No additional information recorded.</p>
              )}
          </CardContent>
        </Card>

        {/* Linked company card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Linked Company
            </CardTitle>
            <CardDescription>The customer account this contact belongs to</CardDescription>
          </CardHeader>
          <CardContent>
            {contact.customer_id && companyName ? (
              <div className="space-y-2">
                <Link
                  href={`/customers/${contact.customer_id}`}
                  className="text-primary inline-flex items-center gap-2 text-lg font-medium hover:underline"
                >
                  <Building2 className="h-5 w-5" />
                  {companyName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  Click to view the full customer account
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                This contact is not linked to a customer account.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>All interactions and tasks linked to this contact</CardDescription>
            </div>
            <Button size="sm" onClick={handleAddActivity}>
              <Plus className="mr-2 h-4 w-4" />
              Log Activity
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
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
          ) : activities.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No activities recorded yet</p>
              <Button variant="outline" className="mt-4" onClick={handleAddActivity}>
                <Plus className="mr-2 h-4 w-4" />
                Log First Activity
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="bg-muted absolute top-0 bottom-0 left-5 w-0.5" />

              <div className="space-y-6">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative flex gap-4 pl-2">
                    {/* Icon dot */}
                    <div
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                        activityColors[activity.activity_type] || 'bg-gray-500'
                      }`}
                    >
                      {activityIcons[activity.activity_type] || <FileText className="h-4 w-4" />}
                    </div>

                    {/* Content card */}
                    <div className="bg-card flex-1 rounded-lg border p-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
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

                          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                            <span>
                              {format(new Date(activity.created_at), 'MMM dd, yyyy h:mm a')}
                            </span>
                            {activity.customer_name && (
                              <span>Customer: {activity.customer_name}</span>
                            )}
                            {activity.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {format(new Date(activity.due_date), 'MMM dd, yyyy')}
                              </span>
                            )}
                            {activity.completed_at && (
                              <span className="text-green-600">
                                Completed{' '}
                                {formatDistanceToNow(new Date(activity.completed_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                          {activity.activity_type === 'task' && !activity.completed_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkActivityComplete(activity)}
                              title="Mark complete"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditActivity(activity)}
                            title="Edit activity"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteActivity(activity)}
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
          )}
        </CardContent>
      </Card>

      {/* Edit Contact Dialog */}
      <ContactForm
        contact={contact}
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        onSuccess={handleContactEditSuccess}
      />

      {/* Delete Contact Dialog */}
      {contact && (
        <DeleteContactDialog
          contact={contact}
          open={deleteContactOpen}
          onOpenChange={setDeleteContactOpen}
          onSuccess={handleContactDeleteSuccess}
        />
      )}

      {/* Activity Form Dialog */}
      {contact && (
        <ActivityForm
          activity={selectedActivity}
          customerId={contact.customer_id ?? ''}
          contacts={[]}
          open={activityFormOpen}
          onOpenChange={setActivityFormOpen}
          onSuccess={handleActivitySuccess}
        />
      )}

      {/* Delete Activity Dialog */}
      {selectedActivity && (
        <DeleteActivityDialog
          activity={selectedActivity}
          open={deleteActivityOpen}
          onOpenChange={setDeleteActivityOpen}
          onSuccess={handleActivitySuccess}
        />
      )}
    </div>
  );
}
