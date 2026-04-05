"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

export interface ReconciliationFilters {
  bank_account_id?: string;
  start_date?: string;
  end_date?: string;
  status?: "all" | "matched" | "unmatched" | "discrepancy";
  min_amount?: number;
  max_amount?: number;
}

interface FilterPanelProps {
  filters: ReconciliationFilters;
  onFilterChange: (filters: ReconciliationFilters) => void;
  bankAccounts: Array<{ id: string; account_name: string }>;
}

export function FilterPanel({
  filters,
  onFilterChange,
  bankAccounts,
}: FilterPanelProps) {
  const handleApplyFilters = () => {
    onFilterChange(filters);
  };

  const handleClearFilters = () => {
    onFilterChange({
      bank_account_id: undefined,
      start_date: undefined,
      end_date: undefined,
      status: "all",
      min_amount: undefined,
      max_amount: undefined,
    });
  };

  const hasActiveFilters =
    filters.bank_account_id ||
    filters.start_date ||
    filters.end_date ||
    (filters.status && filters.status !== "all") ||
    filters.min_amount ||
    filters.max_amount;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Bank Account Filter */}
          <div className="space-y-2">
            <Label>Bank Account</Label>
            <Select
              value={filters.bank_account_id || "all"}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  bank_account_id: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                onFilterChange({
                  ...filters,
                  status: value as ReconciliationFilters["status"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="discrepancy">Discrepancy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Date Filter */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.start_date || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  start_date: e.target.value || undefined,
                })
              }
            />
          </div>

          {/* End Date Filter */}
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.end_date || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  end_date: e.target.value || undefined,
                })
              }
            />
          </div>

          {/* Min Amount Filter */}
          <div className="space-y-2">
            <Label>Min Amount ($)</Label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              value={filters.min_amount || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  min_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>

          {/* Max Amount Filter */}
          <div className="space-y-2">
            <Label>Max Amount ($)</Label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              value={filters.max_amount || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  max_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button onClick={handleApplyFilters}>Apply Filters</Button>
          {hasActiveFilters && (
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
