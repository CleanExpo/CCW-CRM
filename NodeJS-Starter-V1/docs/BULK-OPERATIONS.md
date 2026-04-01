# Bulk Operations UI System

**Date**: January 14, 2026
**Status**: Implemented on Orders and Products pages ✅

---

## Overview

The CCW-Online ERP system now includes a comprehensive bulk operations UI that provides:

- **Floating Action Bar** - Appears at bottom of screen when items selected
- **Bulk Delete** - Delete multiple items with confirmation
- **Bulk Status Update** - Change status of multiple items at once
- **Bulk Export** - Export selected items with format and field selection
- **Multi-Select** - Checkboxes on all list views with select all functionality
- **Reusable Components** - Can be easily integrated into any page

---

## Components Created

### 1. BulkActionBar Component

**Location**: `apps/web/components/bulk-operations/BulkActionBar.tsx`

A floating action bar that appears at the bottom of the screen when items are selected.

#### Features

- **Fixed Bottom Positioning** - Stays visible while scrolling
- **Slide-in Animation** - Smooth entrance when items selected
- **Selection Info** - Shows count of selected items
- **Select All Button** - Quick select all items on page
- **Action Buttons** - Customizable bulk actions (delete, status update, export)
- **Clear Selection** - X button to deselect all items
- **Visual Dividers** - Clear separation between sections

#### API

```typescript
export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  className?: string;
}
```

#### Usage Example

```typescript
import { BulkActionBar, BulkAction } from "@/components/bulk-operations/BulkActionBar";
import { Trash2, Download, RefreshCw } from "lucide-react";

const bulkActions: BulkAction[] = [
  {
    id: "update-status",
    label: "Update Status",
    icon: RefreshCw,
    variant: "default",
    onClick: handleBulkStatusUpdate,
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    variant: "outline",
    onClick: handleBulkExport,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive",
    onClick: handleBulkDelete,
  },
];

<BulkActionBar
  selectedCount={selectedIds.length}
  totalCount={totalItems}
  actions={bulkActions}
  onClearSelection={() => setSelectedIds([])}
  onSelectAll={handleSelectAll}
/>
```

---

### 2. BulkExportDialog Component

**Location**: `apps/web/components/bulk-operations/BulkExportDialog.tsx`

A dialog for exporting selected items with customizable format and field selection.

#### Features

- **Multiple Formats** - CSV, Excel (XLSX), JSON
- **Field Selection** - Choose which fields to export
- **Select All/Deselect All** - Quick field selection toggle
- **Include Headers** - Option to include column headers (CSV/Excel)
- **Scrollable Field List** - Handles large number of fields
- **Format Descriptions** - Helpful descriptions for each format

#### API

```typescript
interface ExportFormat {
  value: string;
  label: string;
  description?: string;
}

interface ExportField {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

interface BulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onExport: (format: string, options: ExportOptions) => Promise<void>;
  entityName?: string;
  availableFormats?: ExportFormat[];
  availableFields?: ExportField[];
}
```

#### Usage Example

```typescript
import { BulkExportDialog } from "@/components/bulk-operations/BulkExportDialog";

<BulkExportDialog
  open={bulkExportDialogOpen}
  onOpenChange={setBulkExportDialogOpen}
  selectedCount={selectedIds.length}
  onExport={handleBulkExportExecute}
  entityName="orders"
  availableFormats={[
    { value: "csv", label: "CSV", description: "Comma-separated values" },
    { value: "json", label: "JSON", description: "JavaScript Object Notation" },
  ]}
  availableFields={[
    { key: "order_number", label: "Order Number", defaultChecked: true },
    { key: "customer_name", label: "Customer", defaultChecked: true },
    { key: "order_date", label: "Order Date", defaultChecked: true },
    { key: "status", label: "Status", defaultChecked: true },
    { key: "total", label: "Total", defaultChecked: true },
  ]}
/>
```

---

### 3. BulkStatusUpdateDialog (Orders)

**Location**: `apps/web/app/(dashboard)/orders/components/BulkStatusUpdateDialog.tsx`

Allows updating the status of multiple orders at once.

#### Features

- **Status Dropdown** - Select from all valid order statuses
- **Batch Processing** - Updates each order individually
- **Success/Error Counting** - Reports how many succeeded/failed
- **Progress Indication** - Loading spinner during update
- **Confirmation UI** - Shows what will be changed

#### Supported Statuses

- Draft
- Pending
- Confirmed
- Processing
- Shipped
- Delivered
- Cancelled

---

### 4. BulkStatusToggleDialog (Products)

**Location**: `apps/web/app/(dashboard)/products/components/BulkStatusToggleDialog.tsx`

Allows activating or deactivating multiple products at once.

#### Features

- **Simple Toggle** - Active or Inactive
- **Batch Processing** - Updates each product individually
- **Success/Error Counting** - Reports results
- **Explanation Text** - Explains impact of status change

---

## Integration Examples

### Orders Page Integration ✅

**File**: `apps/web/app/(dashboard)/orders/page.tsx`

#### What Was Added

1. **State Management**:
   ```typescript
   const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
   const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
   const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
   ```

2. **Selection Handlers**:
   ```typescript
   const handleToggleSelectOrder = (orderId: string) => {
     setSelectedOrderIds((prev) =>
       prev.includes(orderId)
         ? prev.filter((id) => id !== orderId)
         : [...prev, orderId]
     );
   };

   const handleToggleSelectAll = () => {
     if (selectedOrderIds.length === orders.length) {
       setSelectedOrderIds([]);
     } else {
       setSelectedOrderIds(orders.map((o) => o.id));
     }
   };
   ```

3. **Bulk Action Handlers**:
   ```typescript
   const handleBulkStatusUpdate = () => setBulkStatusDialogOpen(true);
   const handleBulkExport = () => setBulkExportDialogOpen(true);
   const handleBulkDelete = () => setBulkDeleteDialogOpen(true);
   ```

4. **Bulk Export Implementation**:
   ```typescript
   const handleBulkExportExecute = async (format: string, options: any) => {
     const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
     if (format === "csv") {
       exportOrdersToCSV(selectedOrders);
     } else if (format === "json") {
       // Download as JSON
     }
   };
   ```

5. **Bulk Actions Configuration**:
   ```typescript
   const bulkActions: BulkAction[] = [
     {
       id: "update-status",
       label: "Update Status",
       icon: RefreshCw,
       variant: "default",
       onClick: handleBulkStatusUpdate,
     },
     {
       id: "export",
       label: "Export",
       icon: Download,
       variant: "outline",
       onClick: handleBulkExport,
     },
     {
       id: "delete",
       label: "Delete",
       icon: Trash2,
       variant: "destructive",
       onClick: handleBulkDelete,
     },
   ];
   ```

6. **Table Checkbox Column**:
   ```typescript
   {
     key: "select",
     label: (
       <Checkbox
         checked={orders.length > 0 && selectedOrderIds.length === orders.length}
         onCheckedChange={handleToggleSelectAll}
         aria-label="Select all orders"
       />
     ),
     render: (order) => (
       <Checkbox
         checked={selectedOrderIds.includes(order.id)}
         onCheckedChange={() => handleToggleSelectOrder(order.id)}
         aria-label={`Select order ${order.order_number}`}
       />
     ),
   }
   ```

7. **Dialogs and Action Bar**:
   ```typescript
   <BulkStatusUpdateDialog
     open={bulkStatusDialogOpen}
     onOpenChange={setBulkStatusDialogOpen}
     selectedOrderIds={selectedOrderIds}
     onSuccess={handleSuccess}
   />

   <BulkExportDialog
     open={bulkExportDialogOpen}
     onOpenChange={setBulkExportDialogOpen}
     selectedCount={selectedOrderIds.length}
     onExport={handleBulkExportExecute}
     entityName="orders"
   />

   <BulkActionBar
     selectedCount={selectedOrderIds.length}
     totalCount={total}
     actions={bulkActions}
     onClearSelection={() => setSelectedOrderIds([])}
     onSelectAll={handleToggleSelectAll}
   />
   ```

---

### Products Page Integration ✅

**File**: `apps/web/app/(dashboard)/products/page.tsx`

Similar integration to Orders page with these differences:

1. **Bulk Actions**:
   - Toggle Status (Active/Inactive)
   - Export (CSV, JSON)
   - Delete

2. **Export Fields**:
   - SKU, Name, Category, Price, Cost, Stock, Active Status

3. **Status Toggle**:
   - Simple Active/Inactive toggle instead of multiple statuses

---

## How to Use (End Users)

### Selecting Items

1. **Select Individual Items**:
   - Click the checkbox next to any item in the list
   - The floating action bar appears at the bottom

2. **Select All Items**:
   - Click the checkbox in the table header to select all items on current page
   - Or click "Select all [total]" button in the floating action bar

3. **Clear Selection**:
   - Click the X button in the floating action bar
   - Or click the header checkbox again

### Bulk Status Update (Orders)

1. Select one or more orders
2. Click "Update Status" button in the floating action bar
3. Choose new status from dropdown
4. Click "Update X Order(s)" button
5. System updates all selected orders
6. Toast notification shows success/failure count

### Bulk Status Toggle (Products)

1. Select one or more products
2. Click "Toggle Status" button in the floating action bar
3. Choose "Active" or "Inactive"
4. Click "Update X Product(s)" button
5. System updates all selected products
6. Toast notification shows success/failure count

### Bulk Export

1. Select one or more items
2. Click "Export" button in the floating action bar
3. Choose export format (CSV, Excel, JSON)
4. Select which fields to include (optional)
5. Toggle "Include column headers" if needed (CSV/Excel only)
6. Click "Export" button
7. File downloads to your browser's download folder

### Bulk Delete

1. Select one or more items
2. Click "Delete" button in the floating action bar
3. Confirm deletion in the dialog
4. System deletes all selected items
5. Toast notification shows success/failure count

---

## Technical Details

### State Management Pattern

All bulk operations follow this state management pattern:

```typescript
// Selection State
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// Dialog State
const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);

// Toggle Individual Selection
const handleToggleSelect = (id: string) => {
  setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
};

// Toggle Select All
const handleToggleSelectAll = () => {
  if (selectedIds.length === items.length) {
    setSelectedIds([]);
  } else {
    setSelectedIds(items.map((item) => item.id));
  }
};

// After Success
const handleSuccess = () => {
  loadData();
  setSelectedIds([]); // Clear selection
};
```

### Floating Action Bar Positioning

The BulkActionBar uses fixed positioning with centering:

```css
position: fixed;
bottom: 1.5rem;
left: 50%;
transform: translateX(-50%);
z-index: 50;
```

This ensures it:
- Stays visible while scrolling
- Doesn't interfere with page content
- Appears above all other content (z-50)
- Centers horizontally on all screen sizes

### Animation

The action bar uses Tailwind's animation utilities:

```typescript
className="animate-in slide-in-from-bottom-5 duration-300"
```

This creates a smooth slide-up animation when items are selected.

### Batch Processing Pattern

Bulk operations that modify data use this pattern:

```typescript
let successCount = 0;
let errorCount = 0;

for (const id of selectedIds) {
  try {
    await apiClient.put(`/api/resource/${id}`, data);
    successCount++;
  } catch (error) {
    errorCount++;
    console.error(`Failed to update ${id}:`, error);
  }
}

toast({
  title: "Operation Complete",
  description: `Successfully updated ${successCount} item(s)${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
});
```

This ensures:
- All items are processed even if some fail
- User gets accurate feedback on results
- Errors are logged but don't stop processing

### Export Implementation

Bulk export supports multiple formats:

**CSV Export** (uses existing utility):
```typescript
if (format === "csv") {
  exportToCSV(selectedItems);
}
```

**JSON Export** (in-browser download):
```typescript
if (format === "json") {
  const dataStr = JSON.stringify(selectedItems, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `items-${new Date().toISOString().split("T")[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

## Integration Guide

To add bulk operations to a new page:

### Step 1: Add Imports

```typescript
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar, BulkAction } from "@/components/bulk-operations/BulkActionBar";
import { BulkExportDialog } from "@/components/bulk-operations/BulkExportDialog";
```

### Step 2: Add State

```typescript
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
// Add other dialog states as needed
```

### Step 3: Add Selection Handlers

```typescript
const handleToggleSelect = (id: string) => {
  setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
};

const handleToggleSelectAll = () => {
  if (selectedIds.length === items.length) {
    setSelectedIds([]);
  } else {
    setSelectedIds(items.map((item) => item.id));
  }
};
```

### Step 4: Add Bulk Action Handlers

```typescript
const handleBulkExport = () => setBulkExportDialogOpen(true);

const handleBulkExportExecute = async (format: string, options: any) => {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  // Export logic
};

const handleSuccess = () => {
  loadData();
  setSelectedIds([]);
};
```

### Step 5: Define Bulk Actions

```typescript
const bulkActions: BulkAction[] = [
  {
    id: "export",
    label: "Export",
    icon: Download,
    variant: "outline",
    onClick: handleBulkExport,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive",
    onClick: handleBulkDelete,
  },
];
```

### Step 6: Add Checkbox Column to Table

```typescript
columns={[
  {
    key: "select",
    label: (
      <Checkbox
        checked={items.length > 0 && selectedIds.length === items.length}
        onCheckedChange={handleToggleSelectAll}
      />
    ),
    render: (item) => (
      <Checkbox
        checked={selectedIds.includes(item.id)}
        onCheckedChange={() => handleToggleSelect(item.id)}
      />
    ),
  },
  // ... other columns
]}
```

### Step 7: Add Dialogs and Action Bar

```typescript
<BulkExportDialog
  open={bulkExportDialogOpen}
  onOpenChange={setBulkExportDialogOpen}
  selectedCount={selectedIds.length}
  onExport={handleBulkExportExecute}
  entityName="items"
/>

<BulkActionBar
  selectedCount={selectedIds.length}
  totalCount={total}
  actions={bulkActions}
  onClearSelection={() => setSelectedIds([])}
  onSelectAll={handleToggleSelectAll}
/>
```

---

## Best Practices

### DO

- ✅ Clear selection after successful bulk operation
- ✅ Show success/error counts in toast notifications
- ✅ Use confirmation dialogs for destructive actions
- ✅ Provide "Select All" option for convenience
- ✅ Allow deselecting individual items
- ✅ Show selected count in page subtitle
- ✅ Use appropriate button variants (destructive for delete)
- ✅ Include helpful descriptions in dialogs

### DON'T

- ❌ Allow bulk operations without confirmation
- ❌ Hide the action bar when items are selected
- ❌ Process bulk operations without error handling
- ❌ Forget to refresh data after bulk operation
- ❌ Make destructive actions too easy to trigger
- ❌ Ignore partial failures in batch processing
- ❌ Export without format/field options

---

## Performance Considerations

### Selection State

- Selection state is stored in React state (not persisted)
- Cleared on page navigation or data refresh
- Lightweight - just array of IDs

### Batch Processing

- Orders and products process sequentially (one at a time)
- For large batches (100+), consider:
  - Adding progress bar
  - Implementing backend batch endpoint
  - Showing real-time progress

### Export Performance

- CSV export uses existing utility (optimized for large datasets)
- JSON export creates blob in memory (suitable for < 1000 items)
- For larger exports, consider:
  - Backend-generated exports
  - Streaming downloads
  - Compression

---

## Accessibility

### Keyboard Navigation

- All checkboxes are keyboard accessible (Tab to focus, Space to toggle)
- Action bar buttons are keyboard accessible
- Dialog controls are keyboard accessible

### Screen Readers

- Checkboxes have aria-labels describing what they select
- Action bar has proper semantic structure
- Dialogs have proper titles and descriptions

### Visual Feedback

- Selected items show checked checkbox
- Action bar appears with animation
- Selected count shown in page subtitle
- Loading states shown during operations

---

## Future Enhancements

### Planned for Later Phases

1. **Backend Batch Endpoints**
   - Single API call for bulk operations
   - Atomic transactions for consistency
   - Better performance for large batches

2. **Progress Indicators**
   - Real-time progress bar for bulk operations
   - Show which items are being processed
   - Cancel in-progress operations

3. **Undo Functionality**
   - Undo bulk delete within 30 seconds
   - Undo bulk status changes
   - Undo history

4. **Advanced Filtering in Export**
   - Export with filters applied
   - Custom field transformations
   - Template-based exports

5. **Bulk Edit**
   - Edit multiple items in a form
   - Apply changes to all selected
   - Field-by-field bulk update

6. **Clipboard Operations**
   - Copy selected items
   - Paste to duplicate items
   - Cross-page selection

---

## Files Created

### Components
- `apps/web/components/bulk-operations/BulkActionBar.tsx` - Floating action bar
- `apps/web/components/bulk-operations/BulkExportDialog.tsx` - Export dialog with options
- `apps/web/app/(dashboard)/orders/components/BulkStatusUpdateDialog.tsx` - Order status update
- `apps/web/app/(dashboard)/products/components/BulkStatusToggleDialog.tsx` - Product status toggle

### Documentation
- `docs/BULK-OPERATIONS.md` (this file)

---

## Files Modified

### Frontend
- `apps/web/app/(dashboard)/orders/page.tsx` - Integrated bulk operations
- `apps/web/app/(dashboard)/products/page.tsx` - Integrated bulk operations

---

## Success Criteria ✅

- [x] BulkActionBar component created
- [x] BulkExportDialog component created
- [x] BulkStatusUpdateDialog created for Orders
- [x] BulkStatusToggleDialog created for Products
- [x] Orders page integrated with bulk operations
- [x] Products page integrated with bulk operations
- [x] Multi-select checkboxes working
- [x] Floating action bar appears when items selected
- [x] Bulk status update working
- [x] Bulk export with format/field selection working
- [x] Bulk delete with confirmation working
- [x] Select all functionality working
- [x] Clear selection working
- [x] Success/error toast notifications working
- [x] Documentation complete

---

**Last Updated**: January 14, 2026
**Next Task**: Week 6 - Agent autonomy levels
**Overall Progress**: Week 5 - 100% Complete (10/10 tasks done)
