'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  ShoppingCart,
  FileText,
  Users,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/calculations';
import { ContactForm } from '../../contacts/components/ContactForm';
import { DeleteContactDialog } from '../../contacts/components/DeleteContactDialog';
import { ActivityTimeline, type Activity } from './components/ActivityTimeline';
import { ActivityForm } from './components/ActivityForm';
import { DeleteActivityDialog } from './components/DeleteActivityDialog';
import type { ActivityWithRelations } from '@/lib/types/activities';

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
  item_count?: number;
}

interface Quote {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  status: string;
  total: number;
  item_count?: number;
}

interface Contact {
  id: string;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  is_active: boolean;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending: 'outline',
  confirmed: 'default',
  processing: 'default',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  sent: 'default',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'secondary',
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Contact dialog states
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Activity dialog states
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [deleteActivityDialogOpen, setDeleteActivityDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithRelations | null>(null);
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  const loadCustomerData = useCallback(async () => {
    setLoading(true);
    try {
      // Load customer details
      const customerData = await apiClient.get<Customer>(`/api/customers/${customerId}`);
      setCustomer(customerData);

      // Load customer orders
      const ordersData = await apiClient.get<{ items: Order[] }>(
        `/api/orders?customer_id=${customerId}&page_size=100`
      );
      setOrders(ordersData.items || []);

      // Load customer quotes
      const quotesData = await apiClient.get<{ items: Quote[] }>(
        `/api/quotes?customer_id=${customerId}&page_size=100`
      );
      setQuotes(quotesData.items || []);

      // Load customer contacts (endpoint returns plain array)
      const contactsData = await apiClient.get<Contact[]>(`/api/contacts/customer/${customerId}`);
      setContacts(contactsData || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load customer data';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground text-lg font-medium">Customer not found</p>
        <Button onClick={() => router.push('/customers')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
      </div>
    );
  }

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.total), 0);

  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length;
  const quoteConversionRate =
    quotes.length > 0 ? ((acceptedQuotes / quotes.length) * 100).toFixed(1) : '0';

  // Contact handlers
  const handleAddContact = () => {
    setSelectedContact(null);
    setContactFormOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setContactFormOpen(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    setSelectedContact(contact);
    setDeleteContactDialogOpen(true);
  };

  const handleContactSuccess = () => {
    setContactFormOpen(false);
    setDeleteContactDialogOpen(false);
    setSelectedContact(null);
    loadCustomerData();
  };

  const primaryContact = contacts.find((c) => c.is_primary);

  // Activity handlers
  const handleAddActivity = () => {
    setSelectedActivity(null);
    setActivityFormOpen(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setSelectedActivity(activity as ActivityWithRelations);
    setActivityFormOpen(true);
  };

  const handleDeleteActivity = (activity: Activity) => {
    setSelectedActivity(activity as ActivityWithRelations);
    setDeleteActivityDialogOpen(true);
  };

  const handleActivitySuccess = () => {
    setActivityFormOpen(false);
    setDeleteActivityDialogOpen(false);
    setSelectedActivity(null);
    setActivityRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* PHASE 4: Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers', href: '/customers' },
          { label: customer.company_name },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/customers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{customer.company_name}</h1>
            <Badge variant={customer.is_active ? 'default' : 'secondary'}>
              {customer.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground">{customer.customer_number}</p>
        </div>
      </div>

      {/* Customer Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-muted-foreground text-xs">
              From {orders.filter((o) => o.status !== 'cancelled').length} completed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-muted-foreground text-xs">
              {orders.filter((o) => o.status === 'delivered').length} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quote Conversion</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quoteConversionRate}%</div>
            <p className="text-muted-foreground text-xs">
              {acceptedQuotes} of {quotes.length} quotes accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
            <p className="text-muted-foreground text-xs">
              {primaryContact
                ? `Primary: ${primaryContact.first_name} ${primaryContact.last_name}`
                : 'No primary contact'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Contact:</span>
                <span className="text-muted-foreground text-sm">{customer.contact_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Email:</span>
                <a
                  href={`mailto:${customer.email}`}
                  className="text-primary text-sm hover:underline"
                >
                  {customer.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Phone:</span>
                <a href={`tel:${customer.phone}`} className="text-primary text-sm hover:underline">
                  {customer.phone}
                </a>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                <div>
                  <span className="text-sm font-medium">Address:</span>
                  <p className="text-muted-foreground text-sm">
                    {customer.address}
                    <br />
                    {customer.city}, {customer.state} {customer.postal_code}
                    <br />
                    {customer.country}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders and Quotes Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>All orders from this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No orders yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium">Order #</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-muted/50 cursor-pointer border-b"
                          onClick={() => router.push(`/orders?id=${order.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-sm">{order.order_number}</td>
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(order.order_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={statusColors[order.status] || 'outline'}
                              className="capitalize"
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(Number(order.total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quote History</CardTitle>
              <CardDescription>All quotes for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No quotes yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium">Quote #</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Valid Until</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote) => (
                        <tr
                          key={quote.id}
                          className="hover:bg-muted/50 cursor-pointer border-b"
                          onClick={() => router.push(`/quotes?id=${quote.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-sm">{quote.quote_number}</td>
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(quote.quote_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(quote.valid_until), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={statusColors[quote.status] || 'outline'}
                              className="capitalize"
                            >
                              {quote.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(Number(quote.total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Contacts</CardTitle>
                  <CardDescription>People associated with this customer</CardDescription>
                </div>
                <Button onClick={handleAddContact}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No contacts yet</p>
                  <Button onClick={handleAddContact} variant="outline" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Contact
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Title</th>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-left font-medium">Phone</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-muted/50 border-b">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {contact.first_name} {contact.last_name}
                              </span>
                              {contact.is_primary && (
                                <Badge variant="default" className="text-xs">
                                  Primary
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-sm">
                            {contact.job_title || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-primary hover:underline"
                              >
                                {contact.email}
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {contact.phone || contact.mobile || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={contact.is_active ? 'outline' : 'secondary'}>
                              {contact.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                title="Edit Contact"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteContact(contact)}
                                title="Delete Contact"
                              >
                                <Trash2 className="text-destructive h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Track all interactions and tasks for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                customerId={customerId}
                onAddActivity={handleAddActivity}
                onEditActivity={handleEditActivity}
                onDeleteActivity={handleDeleteActivity}
                refreshTrigger={activityRefreshTrigger}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact Form Dialog */}
      <ContactForm
        contact={selectedContact}
        open={contactFormOpen}
        onOpenChange={setContactFormOpen}
        onSuccess={handleContactSuccess}
        customerId={customerId}
      />

      {/* Delete Contact Dialog */}
      {selectedContact && (
        <DeleteContactDialog
          contact={selectedContact}
          open={deleteContactDialogOpen}
          onOpenChange={setDeleteContactDialogOpen}
          onSuccess={handleContactSuccess}
        />
      )}

      {/* Activity Form Dialog */}
      <ActivityForm
        activity={selectedActivity}
        customerId={customerId}
        contacts={contacts}
        open={activityFormOpen}
        onOpenChange={setActivityFormOpen}
        onSuccess={handleActivitySuccess}
      />

      {/* Delete Activity Dialog */}
      {selectedActivity && (
        <DeleteActivityDialog
          activity={selectedActivity}
          open={deleteActivityDialogOpen}
          onOpenChange={setDeleteActivityDialogOpen}
          onSuccess={handleActivitySuccess}
        />
      )}
    </div>
  );
}
