'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { Cin7MasterDataNav } from '@/components/integrations/Cin7MasterDataNav';
import { Cin7PageSyncToolbar } from '@/components/integrations/Cin7SyncButton';
import { Cin7EmptyState } from '@/components/integrations/Cin7EmptyState';
import { listCin7Branches, type Cin7Branch } from '@/lib/api/cin7-branches';

function BranchesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function BranchesPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Cin7Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listCin7Branches({
        page: 1,
        page_size: 100,
        search: debouncedSearch || undefined,
      });
      setBranches(response.items);
      setTotal(response.total);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not load branches',
        description: error instanceof Error ? error.message : 'Try syncing from Cin7 first.',
      });
      setBranches([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, toast]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-primary/10">
            <MapPin className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cin7 branches</h1>
            <p className="text-muted-foreground text-sm">
              Warehouse and branch locations synced from Cin7 Omni
            </p>
          </div>
        </div>
      </motion.header>

      <Cin7MasterDataNav active="branches" />
      <Cin7PageSyncToolbar entity="branches" onSynced={loadBranches} />

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <BranchesTableSkeleton />
      ) : branches.length === 0 ? (
        <Cin7EmptyState
          entity="branches"
          icon={MapPin}
          title="No branches yet"
          description="Sync from Cin7 to import your warehouse and branch locations. They will appear here for stock and fulfilment workflows."
          onSynced={loadBranches}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border bg-card/50 shadow-sm"
        >
          <div className="border-b px-4 py-3">
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} branch{total === 1 ? '' : 'es'} from Cin7
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cin7 ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {branch.cin7_branch_id}
                  </TableCell>
                  <TableCell>{branch.branch_type ?? '—'}</TableCell>
                  <TableCell>
                    {[branch.city, branch.state, branch.post_code].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {branch.email ?? branch.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
}
