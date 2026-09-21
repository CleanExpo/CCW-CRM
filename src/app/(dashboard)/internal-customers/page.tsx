'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLatestLoad } from '@/hooks/use-latest-load';
import { customersApi, type Customer } from '@/lib/api/customers';
import { Cin7MasterDataNav } from '@/components/integrations/Cin7MasterDataNav';
import { Cin7PageSyncToolbar } from '@/components/integrations/Cin7SyncButton';
import { Cin7EmptyState } from '@/components/integrations/Cin7EmptyState';

function InternalCustomersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function InternalCustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const beginLoad = useLatestLoad();
  const loadCustomers = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      const response = await customersApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        cin7_contact_type: 'Internal',
      });
      if (!isCurrent()) return;
      // A page emptied since it was opened (rows removed, or a sync or filter
      // shrank the list): step back rather than show "none found" while others remain.
      if (response.items.length === 0 && response.total > 0 && page > response.total_pages) {
        setPage(response.total_pages);
        return;
      }
      setCustomers(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      if (!isCurrent()) return;
      toast({
        variant: 'destructive',
        title: 'Could not load internal customers',
        description: error instanceof Error ? error.message : 'Try syncing from Cin7 first.',
      });
      setCustomers([]);
      setTotal(0);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, toast, beginLoad]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-teal-500/10">
            <Building2 className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Internal customers</h1>
            <p className="text-muted-foreground text-sm">
              Inter-branch and internal Cin7 accounts (contact type Internal)
            </p>
          </div>
        </div>
      </motion.header>

      <Cin7MasterDataNav active="internal-customers" />
      <Cin7PageSyncToolbar entity="internal-customers" onSynced={loadCustomers} />

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search internal accounts…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <InternalCustomersSkeleton />
      ) : customers.length === 0 ? (
        <Cin7EmptyState
          entity="internal-customers"
          icon={Building2}
          title="No internal customers yet"
          description="If your Cin7 tenant uses Internal contact types, sync them here. Some tenants only use Customer and Supplier types."
          onSynced={loadCustomers}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card/50 rounded-xl border shadow-sm"
        >
          <div className="border-b px-4 py-3">
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} internal account{total === 1 ? '' : 's'}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.company_name}</TableCell>
                  <TableCell>{customer.contact_name}</TableCell>
                  <TableCell>{customer.email || '—'}</TableCell>
                  <TableCell>{customer.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-2">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
