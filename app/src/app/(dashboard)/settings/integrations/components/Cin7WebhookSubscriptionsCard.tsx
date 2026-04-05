'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  type Cin7WebhookSubscription,
} from '@/lib/api/cin7-webhook-subscriptions';

const CIN7_EVENT_TYPES = [
  'SaleOrder.Add',
  'SaleOrder.Edit',
  'Product.Add',
  'Product.Edit',
  'StockAdjustment.Add',
  'PurchaseOrder.Add',
];

const DEMO_SUBSCRIPTIONS: Cin7WebhookSubscription[] = [
  {
    id: 'demo-1',
    event_type: 'SaleOrder.Add',
    endpoint_url: 'https://example.com/webhooks/cin7/sales',
    is_active: true,
    last_triggered_at: new Date(Date.now() - 3600_000).toISOString(),
    trigger_count: 42,
    created_at: new Date(Date.now() - 86400_000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'demo-2',
    event_type: 'Product.Edit',
    endpoint_url: 'https://example.com/webhooks/cin7/products',
    is_active: true,
    last_triggered_at: new Date(Date.now() - 7200_000).toISOString(),
    trigger_count: 18,
    created_at: new Date(Date.now() - 86400_000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 7200_000).toISOString(),
  },
];

export function Cin7WebhookSubscriptionsCard() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Cin7WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newEventType, setNewEventType] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newSecretKey, setNewSecretKey] = useState('');

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhookSubscriptions();
      setSubscriptions(data);
      setIsDemo(false);
    } catch {
      // Fall back to demo data
      setSubscriptions(DEMO_SUBSCRIPTIONS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleCreate = async () => {
    if (!newEventType || !newEndpointUrl) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Event type and endpoint URL are required',
      });
      return;
    }

    setCreating(true);
    try {
      await createWebhookSubscription({
        event_type: newEventType,
        endpoint_url: newEndpointUrl,
        secret_key: newSecretKey || undefined,
      });
      toast({
        title: 'Subscription Created',
        description: `Webhook for ${newEventType} created successfully`,
      });
      setDialogOpen(false);
      setNewEventType('');
      setNewEndpointUrl('');
      setNewSecretKey('');
      await loadSubscriptions();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create subscription',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (sub: Cin7WebhookSubscription) => {
    if (isDemo) return;
    try {
      await updateWebhookSubscription(sub.id, { is_active: !sub.is_active });
      toast({
        title: sub.is_active ? 'Subscription Paused' : 'Subscription Activated',
        description: `${sub.event_type} webhook ${sub.is_active ? 'paused' : 'activated'}`,
      });
      await loadSubscriptions();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update subscription',
      });
    }
  };

  const handleDelete = async (sub: Cin7WebhookSubscription) => {
    if (isDemo) return;
    try {
      await deleteWebhookSubscription(sub.id);
      toast({
        title: 'Subscription Deleted',
        description: `${sub.event_type} webhook removed`,
      });
      await loadSubscriptions();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete subscription',
      });
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <Bell className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Webhook Subscriptions</CardTitle>
              <CardDescription>Manage Cin7 webhook event subscriptions</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && <Badge variant="secondary">Demo</Badge>}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Webhook Subscription</DialogTitle>
                  <DialogDescription>
                    Subscribe to a Cin7 event to receive webhook notifications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="event-type">Event Type</Label>
                    <Select value={newEventType} onValueChange={setNewEventType}>
                      <SelectTrigger id="event-type">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CIN7_EVENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-url">Endpoint URL</Label>
                    <Input
                      id="endpoint-url"
                      type="url"
                      placeholder="https://your-domain.com/webhooks/cin7"
                      value={newEndpointUrl}
                      onChange={(e) => setNewEndpointUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Secret Key (optional)</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      placeholder="HMAC signing secret"
                      value={newSecretKey}
                      onChange={(e) => setNewSecretKey(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No webhook subscriptions configured. Click &quot;Add Subscription&quot; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-center">Triggers</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {sub.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {sub.endpoint_url}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {sub.trigger_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(sub.last_triggered_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={sub.is_active}
                        onCheckedChange={() => handleToggleActive(sub)}
                        disabled={isDemo}
                      />
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDemo}>
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will deactivate the webhook subscription for{' '}
                              <strong>{sub.event_type}</strong>. You can re-create it later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(sub)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
