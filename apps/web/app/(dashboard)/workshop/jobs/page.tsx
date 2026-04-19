'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type JobCard, type JobCardStatus } from '@/lib/api/workshop';
import { Plus, Wrench, ArrowLeft } from 'lucide-react';

const STATUS_COLORS: Record<JobCardStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function JobCardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listJobs({ status: statusFilter || undefined });
      setCards(data.items);
      setTotal(data.total);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load job cards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await workshopApi.createJob({ title: newTitle.trim() });
      setNewTitle('');
      setShowCreate(false);
      toast({ title: 'Job card created' });
      loadCards();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create job card',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  const STATUSES: Array<{ value: string; label: string }> = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/workshop">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Workshop
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Job Cards</h1>
            <p className="text-neutral-600 dark:text-neutral-400">{total} total job cards</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" /> New Job Card
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Job Card</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Input
              placeholder="Job title (e.g. 100-hour service — TM400)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex gap-2">
        {STATUSES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="py-12 text-center">
          <Wrench className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No job cards found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <Link key={card.id} href={`/workshop/jobs/${card.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {card.job_number}
                      </span>
                      <Badge className={STATUS_COLORS[card.status]}>
                        {card.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="font-medium">{card.title}</p>
                    {card.assigned_technician && (
                      <p className="text-sm text-muted-foreground">
                        Technician: {card.assigned_technician}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(card.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
