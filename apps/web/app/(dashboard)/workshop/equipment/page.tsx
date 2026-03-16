'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type Equipment } from '@/lib/api/workshop';
import { Plus, Search, RefreshCw, Eye } from 'lucide-react';
import Link from 'next/link';

function getServiceStatus(equipment: Equipment): { label: string; color: string } {
  if (!equipment.next_service_date)
    return { label: 'No schedule', color: 'bg-gray-100 text-gray-600' };
  const now = new Date();
  const serviceDate = new Date(equipment.next_service_date);
  const daysUntil = Math.ceil((serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
  if (daysUntil <= 30)
    return { label: `Due in ${daysUntil}d`, color: 'bg-amber-100 text-amber-700' };
  return { label: `Due in ${daysUntil}d`, color: 'bg-green-100 text-green-700' };
}

export default function EquipmentPage() {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listEquipment({
        search: search || undefined,
        location: location || undefined,
        status: status || undefined,
        overdue_only: overdueOnly || undefined,
        page_size: 100,
      });
      setEquipment(data.items);
      setTotal(data.total);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load equipment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, location, status, overdueOnly, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipment Registry</h1>
          <p className="text-neutral-600 dark:text-neutral-400">{total} machines registered</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Equipment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search make, model, serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Locations</option>
          <option value="brisbane">Brisbane</option>
          <option value="sydney">Sydney</option>
          <option value="melbourne">Melbourne</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="in_service">In Service</option>
          <option value="retired">Retired</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded"
          />
          Overdue only
        </label>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : equipment.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          No equipment found. Add your first machine to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Make / Model</th>
                <th className="px-4 py-3 text-left font-medium">Serial #</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-left font-medium">Hours</th>
                <th className="px-4 py-3 text-left font-medium">Last Service</th>
                <th className="px-4 py-3 text-left font-medium">Next Service</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {equipment.map((eq) => {
                const svcStatus = getServiceStatus(eq);
                return (
                  <tr key={eq.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {eq.make} {eq.model}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{eq.serial_number}</td>
                    <td className="px-4 py-3 capitalize">{eq.location}</td>
                    <td className="px-4 py-3">{eq.current_hours.toFixed(0)}h</td>
                    <td className="px-4 py-3">
                      {eq.last_service_date ? (
                        new Date(eq.last_service_date).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${svcStatus.color}`}
                      >
                        {svcStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={eq.status === 'retired' ? 'secondary' : 'default'}>
                        {eq.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/workshop/equipment/${eq.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
