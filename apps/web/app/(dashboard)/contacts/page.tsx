"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchState } from "@/lib/hooks/use-search-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactForm } from "./components/ContactForm";
import { DeleteContactDialog } from "./components/DeleteContactDialog";
import { Pencil, Trash2, Plus, User, Building2, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDistanceToNow } from "date-fns";

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
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  data: Contact[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: "contacts-list",
    defaultState: { search: "", page: 1, pageSize: 50 },
  });

  const search = searchState.search || "";
  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setSearch = useCallback((value: string) => updateField("search", value), [updateField]);
  const setPage = useCallback((value: number) => updateField("page", value), [updateField]);
  const setPageSize = useCallback((value: number) => updateField("pageSize", value), [updateField]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/contacts?page=${page}&page_size=${pageSize}${
          debouncedSearch ? `&search=${debouncedSearch}` : ""
        }`
      );
      setContacts(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load contacts";
      console.error("Failed to load contacts:", error);
      toast({
        variant: "destructive",
        title: "Error",
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
      title: "Contact deleted",
      description: "The contact has been deleted successfully.",
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
      key: "select",
      label: (
        <Checkbox
          checked={
            contacts.length > 0 && selectedContactIds.length === contacts.length
          }
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
      className: "w-12",
    },
    {
      key: "name",
      label: "Name",
      render: (contact: Contact) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">
              {contact.first_name} {contact.last_name}
            </div>
            {contact.job_title && (
              <div className="text-sm text-muted-foreground">
                {contact.job_title}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (contact: Contact) =>
        contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="text-primary hover:underline flex items-center gap-1"
          >
            <Mail className="h-3 w-3" />
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (contact: Contact) =>
        contact.phone || contact.mobile ? (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {contact.phone || contact.mobile}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "department",
      label: "Department",
      render: (contact: Contact) =>
        contact.department || (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (contact: Contact) => (
        <div className="flex gap-2">
          {contact.is_primary && (
            <Badge variant="default">Primary</Badge>
          )}
          <Badge variant={contact.is_active ? "outline" : "secondary"}>
            {contact.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (contact: Contact) => (
        <div className="flex gap-2">
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
      className: "w-24",
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <User className="h-6 w-6" />
                Contacts
              </CardTitle>
              <CardDescription>
                Manage contacts and relationships
                {lastUpdated && (
                  <span className="ml-2 text-xs">
                    (Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })})
                  </span>
                )}
              </CardDescription>
            </div>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search contacts by name, email, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {total} contact{total !== 1 ? "s" : ""} found
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
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No contacts found</h3>
              <p className="text-muted-foreground mb-4">
                {search
                  ? "Try adjusting your search terms"
                  : "Get started by creating your first contact"}
              </p>
              {!search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
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
