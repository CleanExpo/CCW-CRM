'use client';

/**
 * PricingTierPanel — minimal price-tier management section for the customer detail page.
 *
 * Renders inside the existing <Tabs> on the customer detail page.
 * Follows the same Card/Button/Badge patterns used throughout this file.
 *
 * Responsibilities:
 *  - Fetch and display the customer's current price tier.
 *  - Allow assigning or changing the tier (opens an inline form card).
 *  - Allow removing the tier assignment.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, Pencil, Trash2, Plus, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { format } from 'date-fns';

// ---- types ------------------------------------------------------------------

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface PricingTier {
  id: string;
  customer_id: string;
  tier_id: string;
  price_list_id: string;
  tier_name: string;
  is_active: boolean;
  is_expired: boolean;
  expires_at: string | null;
  notes: string | null;
}

interface Props {
  customerId: string;
}

// ---- component --------------------------------------------------------------

export function PricingTierPanel({ customerId }: Props) {
  const { toast } = useToast();

  const [tier, setTier] = useState<PricingTier | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Form state
  const [selectedPriceListId, setSelectedPriceListId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tierData, listsData] = await Promise.allSettled([
        apiClient.get<PricingTier | null>(`/api/pricing/customers/${customerId}/tier`),
        apiClient.get<PriceList[]>('/api/pricing/price-lists'),
      ]);

      setTier(tierData.status === 'fulfilled' ? tierData.value : null);
      setPriceLists(
        listsData.status === 'fulfilled' ? (listsData.value ?? []).filter((l) => l.is_active) : []
      );
    } catch {
      // Gracefully degrade — pricing tier is non-blocking.
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = () => {
    setSelectedPriceListId(tier?.price_list_id ?? '');
    setExpiresAt(tier?.expires_at ? tier.expires_at.split('T')[0] : '');
    setNotes(tier?.notes ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selectedPriceListId) {
      toast({ variant: 'destructive', title: 'Select a price list' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/api/pricing/customers/${customerId}/tier`, {
        price_list_id: selectedPriceListId,
        expires_at: expiresAt || null,
        notes: notes || null,
      });
      toast({ title: 'Price tier saved' });
      setEditing(false);
      await loadData();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Failed to save tier',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!tier) return;
    setRemoving(true);
    try {
      await apiClient.delete(`/api/pricing/customers/${customerId}/tier`);
      toast({ title: 'Price tier removed' });
      setTier(null);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove tier',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Contract Pricing Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">Loading…</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Contract Pricing Tier
            </CardTitle>
            <CardDescription>
              Assign a price list to give this customer contract or trade pricing.
            </CardDescription>
          </div>
          {!editing && (
            <div className="flex gap-2">
              {tier ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    disabled={removing}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleEdit}>
                  <Plus className="mr-1 h-3 w-3" />
                  Assign Tier
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {editing ? (
          <div className="space-y-4">
            {/* Price list select */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Price List</label>
              <div className="relative">
                <select
                  className="border-input bg-background w-full appearance-none rounded-md border px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  value={selectedPriceListId}
                  onChange={(e) => setSelectedPriceListId(e.target.value)}
                >
                  <option value="">— select a price list —</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                      {pl.description ? ` — ${pl.description}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 top-2.5 h-4 w-4" />
              </div>
            </div>

            {/* Expiry date */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Expires On (optional)</label>
              <input
                type="date"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Leave blank for no expiry. After expiry the customer reverts to catalogue price.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                rows={2}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Approved by sales director 2026-06-11"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : tier ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant={tier.is_active ? 'default' : 'secondary'} className="gap-1">
                <Tag className="h-3 w-3" />
                {tier.tier_name}
              </Badge>
              {tier.is_expired && (
                <Badge variant="destructive" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>

            {tier.expires_at && (
              <p className="text-muted-foreground text-sm">
                {tier.is_expired ? 'Expired' : 'Expires'}{' '}
                {format(new Date(tier.expires_at), 'dd MMM yyyy')}
              </p>
            )}

            {tier.notes && (
              <p className="text-muted-foreground text-sm italic">{tier.notes}</p>
            )}

            {tier.is_expired && (
              <p className="text-destructive text-sm">
                This tier has expired. The customer is currently receiving catalogue prices.
                Edit to extend or reassign.
              </p>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-center">
            <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No price tier assigned — catalogue prices apply.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
