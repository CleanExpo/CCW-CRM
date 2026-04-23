'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import type { Supplier } from '../types';
import { useRecentItems } from '@/hooks/use-recent-items';

interface SupplierSelectProps {
  value: string;
  onSelect: (supplierId: string) => void;
  disabled?: boolean;
}

export function SupplierSelect({ value, onSelect, disabled }: SupplierSelectProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PHASE 4: Recent suppliers cache - speeds up PO entry
  const { recentItems: recentSuppliers, addRecentItem: addRecentSupplier } =
    useRecentItems<Supplier>({
      key: 'recent-suppliers',
      maxItems: 10,
    });

  useEffect(() => {
    async function loadSuppliers() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<{ items: Supplier[] }>(
          '/api/suppliers?is_active=true&page_size=100'
        );
        setSuppliers(response.items || []);
      } catch (err: unknown) {
        console.error('Failed to load suppliers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load suppliers');
      } finally {
        setLoading(false);
      }
    }

    loadSuppliers();
  }, []);

  const handleSelect = (supplierId: string) => {
    // Track supplier in recent items
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    if (selectedSupplier) {
      addRecentSupplier(selectedSupplier);
    }
    onSelect(supplierId);
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading suppliers..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Error loading suppliers" />
        </SelectTrigger>
      </Select>
    );
  }

  if (suppliers.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No active suppliers found" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={handleSelect} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        {/* PHASE 4: Show recent suppliers first */}
        {recentSuppliers.length > 0 && (
          <>
            {recentSuppliers.map((supplier) => (
              <SelectItem key={`recent-${supplier.id}`} value={supplier.id}>
                🕒 {supplier.supplier_code} - {supplier.company_name}
              </SelectItem>
            ))}
            <div className="my-1 border-t" />
          </>
        )}
        {suppliers
          .filter((s) => !recentSuppliers.some((recent) => recent.id === s.id))
          .map((supplier) => (
            <SelectItem key={supplier.id} value={supplier.id}>
              {supplier.supplier_code} - {supplier.company_name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
