'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { listCin7ReferenceData } from '@/lib/api/cin7-reference-data';
import {
  CIN7_REFERENCE_PAGE_CONFIGS,
  type Cin7ReferencePageConfig,
} from '@/lib/integrations/cin7-reference-page-config';
import type { Cin7ReferenceListEntity } from '@/lib/integrations/cin7-reference-list';

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

type Cin7ReferenceListPageProps = {
  entity: Cin7ReferenceListEntity;
};

export function Cin7ReferenceListPage({ entity }: Cin7ReferenceListPageProps) {
  const config: Cin7ReferencePageConfig = CIN7_REFERENCE_PAGE_CONFIGS[entity];
  const { toast } = useToast();
  const Icon = config.icon;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listCin7ReferenceData(config.entity, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
      });
      setRows(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: `Could not load ${config.label.toLowerCase()}`,
        description: error instanceof Error ? error.message : 'Try syncing from Cin7 first.',
      });
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [config.entity, config.label, debouncedSearch, page, toast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

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
            <Icon className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
            <p className="text-muted-foreground text-sm">{config.subtitle}</p>
          </div>
        </div>
      </motion.header>

      <Cin7MasterDataNav active={config.navKey} />
      <Cin7PageSyncToolbar entity={config.syncEntity} onSynced={loadRows} />

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder={config.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <Cin7EmptyState
          entity={config.syncEntity}
          icon={Icon}
          title={config.emptyTitle}
          description={config.emptyDescription}
          onSynced={loadRows}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border bg-card/50 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} record{total === 1 ? '' : 's'} from Cin7
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-xs">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id ?? `${row.sku}-${row.cin7_branch_id}`)}>
                  {config.columns.map((column) => {
                    const value = row[column.key];
                    const content = column.render
                      ? column.render(row)
                      : value == null || value === ''
                        ? '—'
                        : String(value);
                    const isStatus = column.key === 'is_active';
                    return (
                      <TableCell
                        key={column.key}
                        className={
                          column.mono
                            ? 'text-muted-foreground font-mono text-xs'
                            : column.key === 'name'
                              ? 'font-medium'
                              : undefined
                        }
                      >
                        {isStatus ? (
                          <Badge variant={value === true ? 'default' : 'secondary'}>
                            {content}
                          </Badge>
                        ) : (
                          content
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
}
