'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchState } from '@/hooks/use-search-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { contactsApi } from '@/lib/api/contacts';
import { apiClient } from '@/lib/api/client';
import type { Contact } from '@/types/contacts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactForm } from './components/ContactForm';
import { DeleteContactDialog } from './components/DeleteContactDialog';
import {
  Pencil,
  Trash2,
  Plus,
  User,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Download,
} from 'lucide-react';
import { exportContactsToCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { formatDistanceToNow } from 'date-fns';

export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [customerMap, setCustomerMap] = useState<Map<string, string>>(new Map());

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: 'contacts-list',
    defaultState: { search: '', page: 1, pageSize: 50 },
  });

  const search = searchState.search || '';
  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setSearch = useCallback((value: string) => updateField('search', value), [updateField]);
  const setPage = useCallback((value: number) => updateField('page', value), [updateField]);
  const setPageSize = useCallback((value: number) => updateField('pageSize', value), [updateField]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await contactsApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
      });
      setContacts(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load contacts';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [page, pageSize, debouncedSearch, toast]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      if (search !== debouncedSearch) {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch, setPage]);

  // Load contacts when dependencies change
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load customer name map once on mount
  useEffect(() => {
    async function loadCustomerMap() {
      try {
        const response = await apiClient.get<{
          items: Array<{ id: string; company_name: string }>;
        }>('/api/customers?page_size=200&page=1');
        setCustomerMap(new Map(response.items.map((c) => [c.id, c.company_name])));
      } catch {
        // Non-critical — company names will fall back to "Unknown"
      }
    }
    loadCustomerMap();
  }, []);

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setFormOpen(true);
  };

  const handleDelete = (contact: Contact) => {
    setSelectedContact(contact);
    setDeleteDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setSelectedContact(null);
    loadContacts();
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedContact(null);
    loadContacts();
    toast({
      title: 'Contact deleted',
      description: 'The contact has been deleted successfully.',
    });
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id));
    }
  };

  const columns = [
    {
      key: 'select',
      label: (
        <Checkbox
          checked={contacts.length > 0 && selectedContactIds.length === contacts.length}
          onCheckedChange={toggleSelectAll}
          aria-label="Select all"
        />
      ),
      render: (contact: Contact) => (
        <Checkbox
          checked={selectedContactIds.includes(contact.id)}
          onCheckedChange={() => toggleSelectContact(contact.id)}
          aria-label={`Select ${contact.first_name} ${contact.last_name}`}
        />
      ),
      className: 'w-12',
    },
    {
      key: 'name',
      label: 'Name',
      render: (contact: Contact) => (
        <div className="flex items-center gap-2">
          <User className="text-muted-foreground h-4 w-4" />
          <div>
            <div className="font-medium">
              {contact.first_name} {contact.last_name}
            </div>
            {contact.job_title && (
              <div className="text-muted-foreground text-sm">{contact.job_title}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (contact: Contact) =>
        contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="text-primary flex items-center gap-1 hover:underline"
          >
            <Mail className="h-3 w-3" />
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (contact: Contact) =>
        contact.phone || contact.mobile ? (
          <div className="flex items-center gap-1">
            <Phone className="text-muted-foreground h-3 w-3" />
            {contact.phone || contact.mobile}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (contact: Contact) =>
        contact.department || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'company',
      label: 'Company',
      render: (contact: Contact) => {
        if (!contact.customer_id) {
          return <span className="text-muted-foreground">-</span>;
        }
        const companyName = customerMap.get(contact.customer_id) || 'Unknown';
        return (
          <Link
            href={`/customers/${contact.customer_id}`}
            className="text-primary flex items-center gap-1 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 className="h-3 w-3" />
            {companyName}
          </Link>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (contact: Contact) => (
        <div className="flex gap-2">
          {contact.is_primary && <Badge variant="default">Primary</Badge>}
          <Badge variant={contact.is_active ? 'outline' : 'secondary'}>
            {contact.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (contact: Contact) => (
        <div className="flex gap-2">
          <Link
            href={`/contacts/${contact.id}` as never}
            title="View contact"
            className="ring-offset-background focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(contact)}
            title="Edit contact"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(contact)}
            title="Delete contact"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'w-32',
    },
  ];

  return (
    <div className="container mx-auto space-y-6 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <User className="h-6 w-6" />
                Contacts
              </CardTitle>
              <CardDescription>
                Manage trade contacts and cleaning business representatives
                {lastUpdated && (
                  <span className="ml-2 text-xs">
                    (Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })})
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  exportContactsToCSV(contacts as unknown as Record<string, unknown>[]);
                  toast({ title: 'Export Successful', description: 'Contacts exported to CSV' });
                }}
                disabled={contacts.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Contact
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and filters */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search contacts by name, email, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="text-muted-foreground text-sm">
              {total} contact{total !== 1 ? 's' : ''} found
            </div>
          </div>

          {/* Table or loading state */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-12 text-center">
              <User className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="text-lg font-medium">No contacts found</h3>
              <p className="text-muted-foreground mb-4">
                {search
                  ? 'Try adjusting your search terms'
                  : 'Add your first trade contact or cleaning business representative'}
              </p>
              {!search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Contact
                </Button>
              )}
            </div>
          ) : (
            <>
              <ResponsiveTable
                columns={columns}
                data={contacts}
                keyExtractor={(contact) => contact.id}
              />

              <div className="mt-6">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  totalItems={total}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={selectedContact}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      {selectedContact && (
        <DeleteContactDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          contact={selectedContact}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
