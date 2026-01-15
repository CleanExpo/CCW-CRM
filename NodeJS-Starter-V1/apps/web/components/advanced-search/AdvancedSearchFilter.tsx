/**
 * Advanced Search and Filter Component
 *
 * Provides comprehensive search and filtering capabilities with:
 * - Multi-field search
 * - Filter chips/tags
 * - Saved filter presets
 * - Date range selection
 * - Status/category filters
 * - Quick filters
 */

"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Save,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange" | "number" | "boolean";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface ActiveFilter {
  field: string;
  operator: string;
  value: any;
  label?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: ActiveFilter[];
}

export interface AdvancedSearchFilterProps {
  /** Array of filter field configurations */
  fields: FilterField[];
  /** Callback when filters change */
  onFiltersChange: (filters: ActiveFilter[]) => void;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Optional saved filter presets */
  presets?: FilterPreset[];
  /** Callback to save a new preset */
  onSavePreset?: (name: string, filters: ActiveFilter[]) => void;
  /** Callback to delete a preset */
  onDeletePreset?: (presetId: string) => void;
  /** Optional quick filter buttons */
  quickFilters?: { label: string; filters: ActiveFilter[] }[];
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Whether to show the advanced filters panel initially */
  defaultExpanded?: boolean;
}

export function AdvancedSearchFilter({
  fields,
  onFiltersChange,
  onSearchChange,
  presets = [],
  onSavePreset,
  onDeletePreset,
  quickFilters = [],
  searchPlaceholder = "Search...",
  defaultExpanded = false,
}: AdvancedSearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedField, setSelectedField] = useState<string>("");
  const [filterValue, setFilterValue] = useState<any>("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // Debounced search
  const debouncedSearch = useCallback(
    (value: string) => {
      const timer = setTimeout(() => {
        onSearchChange(value);
      }, 300);
      return () => clearTimeout(timer);
    },
    [onSearchChange]
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleAddFilter = () => {
    if (!selectedField) return;

    const field = fields.find((f) => f.key === selectedField);
    if (!field) return;

    let value = filterValue;
    let label = `${field.label}: ${filterValue}`;

    if (field.type === "dateRange") {
      if (!dateFrom || !dateTo) return;
      value = { from: dateFrom, to: dateTo };
      label = `${field.label}: ${format(dateFrom, "PPP")} - ${format(dateTo, "PPP")}`;
    } else if (field.type === "date") {
      if (!dateFrom) return;
      value = dateFrom;
      label = `${field.label}: ${format(dateFrom, "PPP")}`;
    } else if (field.type === "select" && field.options) {
      const option = field.options.find((opt) => opt.value === filterValue);
      if (option) {
        label = `${field.label}: ${option.label}`;
      }
    }

    const newFilter: ActiveFilter = {
      field: selectedField,
      operator: "equals",
      value,
      label,
    };

    const updatedFilters = [...activeFilters, newFilter];
    setActiveFilters(updatedFilters);
    onFiltersChange(updatedFilters);

    // Reset form
    setSelectedField("");
    setFilterValue("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleRemoveFilter = (index: number) => {
    const updatedFilters = activeFilters.filter((_, i) => i !== index);
    setActiveFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleClearAll = () => {
    setActiveFilters([]);
    setSearchQuery("");
    onFiltersChange([]);
    onSearchChange("");
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    setActiveFilters(preset.filters);
    onFiltersChange(preset.filters);
  };

  const handleSavePreset = async () => {
    if (!presetName || !onSavePreset || activeFilters.length === 0) return;

    setSavingPreset(true);
    try {
      await onSavePreset(presetName, activeFilters);
      setPresetName("");
    } finally {
      setSavingPreset(false);
    }
  };

  const handleQuickFilter = (filters: ActiveFilter[]) => {
    setActiveFilters(filters);
    onFiltersChange(filters);
  };

  const selectedFieldConfig = fields.find((f) => f.key === selectedField);

  return (
    <div className="space-y-4">
      {/* Search Bar and Quick Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={isExpanded ? "default" : "outline"}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilters.length}
            </Badge>
          )}
        </Button>
        {activeFilters.length > 0 && (
          <Button variant="ghost" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </div>

      {/* Quick Filters */}
      {quickFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Quick:</span>
          {quickFilters.map((qf, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter(qf.filters)}
            >
              {qf.label}
            </Button>
          ))}
        </div>
      )}

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter, index) => (
            <Badge key={index} variant="secondary" className="gap-1 pr-1">
              {filter.label}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemoveFilter(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Field Selection */}
            <div className="space-y-2">
              <Label>Field</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value Input (conditional based on field type) */}
            {selectedFieldConfig && (
              <>
                {selectedFieldConfig.type === "text" && (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      placeholder={selectedFieldConfig.placeholder || "Enter value..."}
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                    />
                  </div>
                )}

                {selectedFieldConfig.type === "number" && (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      type="number"
                      placeholder={selectedFieldConfig.placeholder || "Enter number..."}
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                    />
                  </div>
                )}

                {selectedFieldConfig.type === "select" && selectedFieldConfig.options && (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Select value={filterValue} onValueChange={setFilterValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select value..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedFieldConfig.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedFieldConfig.type === "date" && (
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {selectedFieldConfig.type === "dateRange" && (
                  <>
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "PPP") : "From"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "PPP") : "To"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            initialFocus
                            disabled={(date) =>
                              dateFrom ? date < dateFrom : false
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Add Filter Button */}
            {selectedFieldConfig && (
              <div className="flex items-end">
                <Button onClick={handleAddFilter} className="w-full">
                  Add Filter
                </Button>
              </div>
            )}
          </div>

          {/* Saved Presets */}
          {(presets.length > 0 || onSavePreset) && (
            <div className="pt-4 border-t space-y-3">
              <Label>Saved Filters</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      {preset.name}
                      <Badge variant="secondary" className="ml-2">
                        {preset.filters.length}
                      </Badge>
                    </Button>
                    {onDeletePreset && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDeletePreset(preset.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Save New Preset */}
              {onSavePreset && activeFilters.length > 0 && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Save Current Filters</Label>
                    <Input
                      placeholder="Preset name..."
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSavePreset}
                    disabled={!presetName || savingPreset}
                  >
                    {savingPreset ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
