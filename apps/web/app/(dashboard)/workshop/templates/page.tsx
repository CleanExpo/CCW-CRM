'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type ServiceTemplate } from '@/lib/api/workshop';
import { Plus, RefreshCw, ClipboardList } from 'lucide-react';

export default function ServiceTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listTemplates({ is_active: true });
      setTemplates(data.items);
      setTotal(data.total);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    try {
      await workshopApi.deactivateTemplate(id);
      toast({ title: 'Template deactivated' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setDeactivatingId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Templates</h1>
          <p className="text-neutral-600 dark:text-neutral-400">{total} active templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center">
          <ClipboardList className="text-muted-foreground/30 mx-auto mb-3 h-12 w-12" />
          <p className="text-muted-foreground">No service templates yet.</p>
          <p className="text-muted-foreground text-sm">
            Create templates to standardise your service procedures.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="outline">{template.service_type}</Badge>
                      {template.applies_to_make && (
                        <Badge variant="secondary">
                          {template.applies_to_make}
                          {template.applies_to_model ? ` ${template.applies_to_model}` : ''}
                        </Badge>
                      )}
                      {template.location && (
                        <Badge variant="secondary" className="capitalize">
                          {template.location}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {template.estimated_hours}h est.
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(template.id)}
                      disabled={deactivatingId === template.id}
                    >
                      {deactivatingId === template.id ? 'Deactivating...' : 'Deactivate'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(template.description || template.items.length > 0) && (
                <CardContent>
                  {template.description && (
                    <p className="text-muted-foreground mb-3 text-sm">{template.description}</p>
                  )}
                  {template.items.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-1 text-xs font-medium">
                        PARTS KIT ({template.items.length} items)
                      </div>
                      <div className="overflow-hidden rounded border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-1.5 text-left">Part</th>
                              <th className="px-3 py-1.5 text-left">Qty</th>
                              <th className="px-3 py-1.5 text-left">Lead Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {template.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-1.5 font-mono">
                                  {item.product_id.slice(0, 8)}...
                                </td>
                                <td className="px-3 py-1.5">{item.quantity}</td>
                                <td className="px-3 py-1.5">{item.lead_time_days}d</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
