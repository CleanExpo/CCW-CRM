'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package } from 'lucide-react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { apiClient } from '@/lib/api/client';

interface EquipmentItem {
  id: string;
  name: string;
  serial_number: string;
  category: string;
  last_service_date: string | null;
  next_service_date: string | null;
  location: string;
  status: 'active' | 'inactive' | string;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function EquipmentRegisterPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    apiClient
      .get<EquipmentItem[]>('/api/workshop/equipment', { signal: controller.signal })
      .then(setItems)
      .catch((e) => {
        if (e.name === 'AbortError') return;
        if (e.status === 404) {
          setItems([]);
          return;
        }
        toast({
          title: 'Error',
          description: e.message ?? 'Failed to load equipment',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [toast]);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  const filtered = items.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (categoryFilter && i.category !== categoryFilter) return false;
    return true;
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipment Register</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              All equipment tracked for service and compliance
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Equipment
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Package className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground">
                {items.length === 0
                  ? 'No equipment registered. Add your first item to track service and compliance.'
                  : 'No equipment matches the selected filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-b-lg border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        'Equipment Name',
                        'Serial Number',
                        'Category',
                        'Last Service',
                        'Next Service Due',
                        'Location',
                        'Status',
                      ].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((eq) => {
                      const overdue = isOverdue(eq.next_service_date);
                      return (
                        <tr
                          key={eq.id}
                          className={`hover:bg-muted/30 ${overdue ? 'bg-red-50' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium">{eq.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{eq.serial_number}</td>
                          <td className="px-4 py-3">{eq.category || '—'}</td>
                          <td className="px-4 py-3">
                            {eq.last_service_date ? (
                              new Date(eq.last_service_date).toLocaleDateString()
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {eq.next_service_date ? (
                              <span className={overdue ? 'font-medium text-red-600' : ''}>
                                {new Date(eq.next_service_date).toLocaleDateString()}
                                {overdue && ' (Overdue)'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 capitalize">{eq.location}</td>
                          <td className="px-4 py-3">
                            <Badge variant={eq.status === 'inactive' ? 'secondary' : 'default'}>
                              {eq.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
