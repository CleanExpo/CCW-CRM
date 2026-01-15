"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import type { Supplier } from "../types";

interface SupplierSelectProps {
  value: string;
  onSelect: (supplierId: string) => void;
  disabled?: boolean;
}

export function SupplierSelect({ value, onSelect, disabled }: SupplierSelectProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<{ items: Supplier[] }>(
          "/api/suppliers?is_active=true&page_size=100"
        );
        setSuppliers(response.items || []);
      } catch (err: any) {
        console.error("Failed to load suppliers:", err);
        setError(err.message || "Failed to load suppliers");
      } finally {
        setLoading(false);
      }
    }

    loadSuppliers();
  }, []);

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
    <Select value={value} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        {suppliers.map((supplier) => (
          <SelectItem key={supplier.id} value={supplier.id}>
            {supplier.supplier_code} - {supplier.company_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
