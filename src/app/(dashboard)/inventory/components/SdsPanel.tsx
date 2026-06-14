'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { format } from 'date-fns';

interface SdsData {
  product_id: string;
  sds_pdf_url: string | null;
  ghs_signal_word: string | null;
  hazard_statements: string[];
  revision_date: string | null;
  review_due_date: string | null;
  supplier_emergency_contact: string | null;
}

interface SdsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
}

const EMPTY: SdsData = {
  product_id: '',
  sds_pdf_url: null,
  ghs_signal_word: null,
  hazard_statements: [],
  revision_date: null,
  review_due_date: null,
  supplier_emergency_contact: null,
};

export function SdsPanel({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
}: SdsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sds, setSds] = useState<SdsData>(EMPTY);
  const [hazardInput, setHazardInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient
      .get<SdsData>(`/api/inventory/${productId}/sds`)
      .then((data) => {
        setSds(data);
        setHazardInput((data.hazard_statements ?? []).join(', '));
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Failed to load SDS data' });
      })
      .finally(() => setLoading(false));
  }, [open, productId, toast]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await apiClient.put<SdsData>(`/api/inventory/${productId}/sds`, {
        sds_pdf_url: sds.sds_pdf_url || null,
        ghs_signal_word: sds.ghs_signal_word || null,
        hazard_statements: hazardInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        revision_date: sds.revision_date || null,
        review_due_date: sds.review_due_date || null,
        supplier_emergency_contact: sds.supplier_emergency_contact || null,
      });
      setSds(updated);
      toast({ title: 'SDS saved' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save SDS' });
    } finally {
      setSaving(false);
    }
  }

  const isHazardous = Boolean(sds.ghs_signal_word) || sds.hazard_statements.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Safety Data Sheet
          </DialogTitle>
          <DialogDescription>
            GHS/WHS SDS record for{' '}
            <span className="font-semibold">{productName}</span> ({productSku})
            {isHazardous && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {sds.ghs_signal_word ?? 'Hazardous'}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sds-pdf-url">SDS PDF URL</Label>
              <Input
                id="sds-pdf-url"
                placeholder="https://supplier.com/sds/product.pdf"
                value={sds.sds_pdf_url ?? ''}
                onChange={(e) => setSds((s) => ({ ...s, sds_pdf_url: e.target.value || null }))}
              />
              <p className="text-muted-foreground text-xs">
                PDF merge into print output is a TODO for Rana — currently listed as a link on
                the invoice.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ghs-signal">GHS Signal Word</Label>
              <Input
                id="ghs-signal"
                placeholder="Danger / Warning"
                value={sds.ghs_signal_word ?? ''}
                onChange={(e) =>
                  setSds((s) => ({ ...s, ghs_signal_word: e.target.value || null }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="hazard-stmts">Hazard Statements (comma-separated)</Label>
              <Input
                id="hazard-stmts"
                placeholder="H225, H302, H318"
                value={hazardInput}
                onChange={(e) => setHazardInput(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                GHS H-codes — e.g. H225 (flammable liquid), H302 (harmful if swallowed)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="revision-date">Revision Date</Label>
                <Input
                  id="revision-date"
                  type="date"
                  value={sds.revision_date ?? ''}
                  onChange={(e) =>
                    setSds((s) => ({ ...s, revision_date: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="review-due">Review Due Date</Label>
                <Input
                  id="review-due"
                  type="date"
                  value={sds.review_due_date ?? ''}
                  onChange={(e) =>
                    setSds((s) => ({ ...s, review_due_date: e.target.value || null }))
                  }
                />
              </div>
            </div>

            {sds.review_due_date && (
              <p className="text-muted-foreground text-xs">
                Cron alerts fire 30 days before:{' '}
                <span className="font-medium">
                  {format(new Date(sds.review_due_date), 'dd MMM yyyy')}
                </span>
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="emergency-contact">Supplier Emergency Contact</Label>
              <Input
                id="emergency-contact"
                placeholder="1300 000 000 (24 hr Chem Emergency)"
                value={sds.supplier_emergency_contact ?? ''}
                onChange={(e) =>
                  setSds((s) => ({
                    ...s,
                    supplier_emergency_contact: e.target.value || null,
                  }))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SDS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
