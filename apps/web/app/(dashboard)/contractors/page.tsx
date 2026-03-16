'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { ContractorForm } from './components/ContractorForm';
import { DeleteContractorDialog } from './components/DeleteContractorDialog';
import { Pencil, Trash2, Plus, HardHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contractor } from './components/ContractorForm';

interface ContractorListResponse {
  contractors: Contractor[];
  total: number;
  page: number;
  page_size: number;
}

export default function ContractorsPage() {
  const { toast } = useToast();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  const loadContractors = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (debouncedSearch) query.set('specialisation', debouncedSearch);

      const response = await apiClient.get<ContractorListResponse>(
        `/contractors/?${query.toString()}`
      );
      setContractors(response.contractors);
      setTotal(response.total);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load contractors';
      toast({ variant: 'destructive', title: 'Error', description: message });
      setContractors([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const handleAdd = () => {
    setSelectedContractor(null);
    setFormOpen(true);
  };

  const handleEdit = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    setFormOpen(true);
  };

  const handleDelete = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    setDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    loadContractors();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contractors</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Manage your contractor network and availability
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contractor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contractor Directory</CardTitle>
          <CardDescription>{total} contractors registered</CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Filter by specialisation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contractors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HardHat className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-lg font-medium">No contractors found</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {search
                  ? 'Try adjusting your filter criteria.'
                  : 'Add your first contractor to get started.'}
              </p>
              {!search && (
                <Button onClick={handleAdd} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contractor
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Mobile</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">ABN</th>
                    <th className="px-4 py-3 text-left font-medium">Specialisation</th>
                    <th className="px-4 py-3 text-left font-medium">Slots</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((contractor) => (
                    <tr
                      key={contractor.id}
                      className="hover:bg-muted/30 border-b transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{contractor.name}</td>
                      <td className="px-4 py-3 font-mono text-sm">{contractor.mobile}</td>
                      <td className="text-muted-foreground px-4 py-3">{contractor.email || '—'}</td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-sm">
                        {contractor.abn || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {contractor.specialisation ? (
                          <Badge variant="secondary">{contractor.specialisation}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {(contractor as unknown as { availability_slots?: unknown[] })
                          .availability_slots?.length ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(contractor)}
                            title="Edit Contractor"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contractor)}
                            title="Delete Contractor"
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

          {!loading && totalPages > 1 && (
            <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ContractorForm
        contractor={selectedContractor}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
      />

      <DeleteContractorDialog
        contractor={selectedContractor}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
