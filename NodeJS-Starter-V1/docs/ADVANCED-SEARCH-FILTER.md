# Advanced Search and Filtering

**Date**: January 14, 2026
**Status**: Implemented on Products Page ✅

---

## Overview

The CCW-Online ERP system now includes a comprehensive advanced search and filtering system that provides:

- **Multi-field search** - Search across multiple product attributes
- **Filter chips/tags** - Visual representation of active filters
- **Saved filter presets** - Save and reuse common filter combinations
- **Date range filtering** - Filter by date ranges
- **Quick filters** - One-click common filters
- **Persistent presets** - Filter presets saved to localStorage

---

## Components Created

### 1. AdvancedSearchFilter Component

**Location**: `apps/web/components/advanced-search/AdvancedSearchFilter.tsx`

A reusable component that provides comprehensive search and filtering capabilities for any data type.

#### Features

- **Search Bar**: Debounced text search with 300ms delay
- **Filter Builder**: Dynamic filter creation based on field configuration
- **Filter Chips**: Visual tags showing active filters with remove buttons
- **Quick Filters**: Pre-configured one-click filters
- **Saved Presets**: Save/load filter combinations
- **Expandable Panel**: Collapsible advanced filters section

#### Props

```typescript
interface AdvancedSearchFilterProps {
  fields: FilterField[];                    // Array of filterable fields
  onFiltersChange: (filters: ActiveFilter[]) => void;
  onSearchChange: (query: string) => void;
  presets?: FilterPreset[];                 // Saved filter presets
  onSavePreset?: (name: string, filters: ActiveFilter[]) => void;
  onDeletePreset?: (presetId: string) => void;
  quickFilters?: { label: string; filters: ActiveFilter[] }[];
  searchPlaceholder?: string;
  defaultExpanded?: boolean;
}
```

#### Supported Filter Types

- **text** - Free-form text input
- **select** - Dropdown with predefined options
- **date** - Single date picker
- **dateRange** - Start and end date selection
- **number** - Numeric input
- **boolean** - True/false selection

---

### 2. useFilterPresets Hook

**Location**: `apps/web/hooks/use-filter-presets.ts`

A custom React hook for managing filter presets in localStorage.

#### API

```typescript
const {
  presets,        // Array of saved presets
  loading,        // Loading state
  savePreset,     // (name, filters) => FilterPreset
  deletePreset,   // (presetId) => void
  updatePreset,   // (id, name, filters) => void
  clearAll,       // () => void
} = useFilterPresets("pageKey");
```

#### Storage Format

Presets are stored in localStorage with keys formatted as:
```
filter-presets-{pageKey}
```

Each preset contains:
```typescript
{
  id: string;      // Unique identifier
  name: string;    // User-defined name
  filters: ActiveFilter[];  // Array of filter configurations
}
```

---

### 3. Calendar Component

**Location**: `apps/web/components/ui/calendar.tsx`

A date picker component built with `react-day-picker` for date filtering.

---

## Products Page Integration

### What Was Changed

**File**: `apps/web/app/(dashboard)/products/page.tsx`

1. **Replaced simple search** with AdvancedSearchFilter component
2. **Added filter state management** with `activeFilters`
3. **Integrated filter presets** using `useFilterPresets` hook
4. **Updated loadProducts** to build query params from filters
5. **Added quick filters** for common scenarios

### Filter Configuration

```typescript
const productFilterFields: FilterField[] = [
  { key: "category", label: "Category", type: "text" },
  { key: "is_active", label: "Status", type: "select", options: [
    { label: "Active", value: "true" },
    { label: "Inactive", value: "false" },
  ]},
  { key: "min_price", label: "Min Price", type: "number" },
  { key: "max_price", label: "Max Price", type: "number" },
  { key: "min_stock", label: "Min Stock", type: "number" },
  { key: "max_stock", label: "Max Stock", type: "number" },
];
```

### Quick Filters

Pre-configured filters for common scenarios:
- **Low Stock (<10)** - Products with less than 10 units
- **Active Products** - Only active products
- **Inactive Products** - Only inactive products

---

## How to Use

### For End Users

#### Basic Search

1. Enter text in the search bar to search products by name or SKU
2. Search is debounced with 300ms delay for performance

#### Adding Filters

1. Click the "Filters" button to expand the advanced panel
2. Select a field from the dropdown (e.g., "Category")
3. Enter or select a value
4. Click "Add Filter"
5. The filter appears as a chip below the search bar

#### Quick Filters

- Click any quick filter button (e.g., "Low Stock (<10)")
- The filter is immediately applied
- Filter chip appears showing the active filter

#### Removing Filters

- Click the X button on any filter chip to remove it
- Click "Clear All" to remove all filters and reset search

#### Saving Filter Presets

1. Apply the filters you want to save
2. Expand the advanced panel
3. Scroll to "Saved Filters" section
4. Enter a preset name (e.g., "Low Stock Electronics")
5. Click "Save"
6. Preset appears in the list

#### Loading Saved Presets

- Click any saved preset name
- All filters from that preset are applied immediately

#### Deleting Presets

- Click the X button next to a preset name
- Preset is permanently removed from localStorage

---

## Integration Guide

### Adding Advanced Search to Other Pages

**Step 1: Import Components**

```typescript
import { AdvancedSearchFilter, ActiveFilter, FilterField } from "@/components/advanced-search/AdvancedSearchFilter";
import { useFilterPresets } from "@/hooks/use-filter-presets";
```

**Step 2: Define Filter Fields**

```typescript
const filterFields: FilterField[] = [
  { key: "status", label: "Status", type: "select", options: [
    { label: "Pending", value: "pending" },
    { label: "Completed", value: "completed" },
  ]},
  { key: "date_from", label: "Date From", type: "date" },
  // Add more fields...
];
```

**Step 3: Define Quick Filters (Optional)**

```typescript
const quickFilters = [
  {
    label: "This Week",
    filters: [{
      field: "date_range",
      operator: "equals",
      value: { from: startOfWeek, to: endOfWeek },
      label: "This Week"
    }]
  },
];
```

**Step 4: Add State Management**

```typescript
const [search, setSearch] = useState("");
const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
const { presets, savePreset, deletePreset } = useFilterPresets("pageName");
```

**Step 5: Update Data Loading**

```typescript
async function loadData() {
  const params = new URLSearchParams();
  if (search) params.append("search", search);

  activeFilters.forEach((filter) => {
    params.append(filter.field, filter.value.toString());
  });

  const data = await apiClient.get(`/api/endpoint?${params.toString()}`);
  // Update state...
}

// Reload when search or filters change
useEffect(() => {
  loadData();
}, [search, activeFilters]);
```

**Step 6: Add Component to UI**

```typescript
<AdvancedSearchFilter
  fields={filterFields}
  onFiltersChange={setActiveFilters}
  onSearchChange={setSearch}
  presets={presets}
  onSavePreset={savePreset}
  onDeletePreset={deletePreset}
  quickFilters={quickFilters}
  searchPlaceholder="Search..."
/>
```

---

## Technical Details

### Debounced Search

The search input uses a 300ms debounce to prevent excessive API calls:

```typescript
const debouncedSearch = useCallback(
  (value: string) => {
    const timer = setTimeout(() => {
      onSearchChange(value);
    }, 300);
    return () => clearTimeout(timer);
  },
  [onSearchChange]
);
```

### Filter Chip Format

Active filters are displayed as chips with this structure:

```typescript
<Badge variant="secondary" className="gap-1 pr-1">
  {filter.label}  // e.g., "Category: Electronics"
  <Button onClick={() => removeFilter(index)}>
    <X className="h-3 w-3" />
  </Button>
</Badge>
```

### LocalStorage Schema

Filter presets are stored with this structure:

```json
{
  "filter-presets-products": [
    {
      "id": "preset-1705234567890-abc123",
      "name": "Low Stock Electronics",
      "filters": [
        {
          "field": "category",
          "operator": "equals",
          "value": "Electronics",
          "label": "Category: Electronics"
        },
        {
          "field": "max_stock",
          "operator": "lt",
          "value": 10,
          "label": "Stock < 10"
        }
      ]
    }
  ]
}
```

---

## Performance Considerations

### Search Debouncing

- **300ms delay** prevents API calls on every keystroke
- Only triggers when user stops typing
- Cancels previous timers if user continues typing

### Filter Chip Rendering

- Filter chips use React keys for efficient re-rendering
- Removing a filter only re-renders the chip list, not entire page

### Preset Storage

- Presets stored in localStorage (synchronous)
- No network calls required to load presets
- Fast access on page load

---

## Future Enhancements

### Planned for Later Phases

1. **Backend Filter Validation**
   - Add backend support for all filter types
   - Validate filter values on API endpoints

2. **Export Filtered Data**
   - CSV export of filtered results
   - Include active filters in export metadata

3. **Filter History**
   - Track recent filter combinations
   - Suggest frequently used filters

4. **Advanced Operators**
   - Greater than, less than, contains, starts with
   - OR conditions between filters
   - Complex filter groups

5. **Shared Presets**
   - Team-wide filter presets
   - Admin-defined default filters

---

## Files Modified

### Frontend
- `apps/web/components/advanced-search/AdvancedSearchFilter.tsx` - New advanced search component
- `apps/web/hooks/use-filter-presets.ts` - New preset management hook
- `apps/web/components/ui/calendar.tsx` - New calendar component for date filtering
- `apps/web/app/(dashboard)/products/page.tsx` - Integrated advanced search

### Documentation
- `docs/ADVANCED-SEARCH-FILTER.md` (this file)

---

## Success Criteria ✅

- [x] AdvancedSearchFilter component created
- [x] useFilterPresets hook implemented
- [x] Calendar component added
- [x] Products page integrated
- [x] Quick filters working
- [x] Filter presets save/load working
- [x] Filter chips with remove functionality
- [x] Debounced search implemented
- [x] LocalStorage persistence working
- [x] Multi-field filtering operational

---

**Last Updated**: January 14, 2026
**Next Task**: Bulk operations UI or Keyboard shortcuts
**Overall Progress**: Week 5 - 90% Complete (9/10 tasks done)
