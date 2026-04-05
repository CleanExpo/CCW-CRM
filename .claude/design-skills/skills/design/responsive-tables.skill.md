---
name: responsive-tables
category: design
version: 1.0.0
description: Mobile-responsive table patterns that transform into card layouts on small screens
author: CCW ERP Team
priority: 3
auto-load: false
triggers:
  - responsive table
  - mobile table
  - data table
  - table cards
  - mobile data
requires:
  - design/design-system.skill.md
  - frontend/nextjs.skill.md
---

# Responsive Tables Skill

## Overview

Traditional HTML tables break on mobile devices, requiring horizontal scrolling and poor UX. This skill teaches agents how to create responsive tables that automatically switch to card-based layouts on small screens while maintaining all functionality.

## The Problem

**Desktop Table** (Good UX):

```
┌──────────────┬──────────┬───────────┬─────────┐
│ Product Name │ SKU      │ Price     │ Actions │
├──────────────┼──────────┼───────────┼─────────┤
│ Power Drill  │ SKU-001  │ $299.00   │ [Edit]  │
│ Safety Vest  │ SKU-042  │ $45.00    │ [Edit]  │
└──────────────┴──────────┴───────────┴─────────┘
```

**Mobile Table** (Bad UX):

```
┌───────────────►Scroll horizontally───────────►
│ Product...│ SKU    │ Price  │ Stock│ Ware...
│ Power ... │ SKU... │ $299...│ 45   │ Bris...
```

**Mobile Cards** (Good UX):

```
┌─────────────────────────────────────┐
│ Product Name: Power Drill           │
│ SKU: SKU-001                         │
│ Price: $299.00                       │
│ [Edit] [Delete]                      │
└─────────────────────────────────────┘
```

## Solution: ResponsiveTable Component

### Component Architecture

```
ResponsiveTable (Generic)
├── Desktop View (hidden on mobile)
│   └── HTML Table (standard)
└── Mobile View (hidden on desktop)
    └── Card Layout (stacked)
```

### Core Implementation

**File**: `components/responsive-table/ResponsiveTable.tsx`

```tsx
'use client';

import { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Desktop Table - hidden on mobile (md:block = show on 768px+) */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? 'hover:bg-muted/50 cursor-pointer' : ''}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards - hidden on desktop (md:hidden = hide on 768px+) */}
      <div className="space-y-3 md:hidden">
        {data.length === 0 ? (
          <Card className="text-muted-foreground p-8 text-center">No results found</Card>
        ) : (
          data.map((item) => (
            <Card
              key={keyExtractor(item)}
              className={`space-y-3 p-4 ${mobileCardClassName || ''} ${
                onRowClick ? 'cursor-pointer transition-transform active:scale-[0.98]' : ''
              }`}
              onClick={() => onRowClick?.(item)}
            >
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground min-w-[100px] text-sm font-medium">
                      {column.mobileLabel || column.label}
                    </span>
                    <div className="flex-1 text-right text-sm">{column.render(item)}</div>
                  </div>
                ))}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
```

## TypeScript Generics Pattern

The `<T>` generic allows type-safe usage with any data type:

```tsx
// Product type
interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

// Usage - fully type-safe
<ResponsiveTable<Product>
  data={products}
  keyExtractor={(product) => product.id}
  columns={...}
/>
```

## Column Configuration

### Column Interface

```tsx
interface Column<T> {
  key: string; // Unique identifier
  label: string; // Desktop table header
  render: (item: T) => ReactNode; // Cell renderer
  mobileLabel?: string; // Optional different label for mobile
  hideOnMobile?: boolean; // Hide this column on mobile
  className?: string; // Optional Tailwind classes
}
```

### Example Configuration

```tsx
const columns: Column<Product>[] = [
  {
    key: 'sku',
    label: 'SKU',
    className: 'font-mono text-sm w-[120px]',
    render: (product) => product.sku,
  },
  {
    key: 'name',
    label: 'Product Name',
    className: 'font-medium',
    render: (product) => product.name,
  },
  {
    key: 'price',
    label: 'Price',
    className: 'text-right',
    render: (product) => <span className="font-semibold">${product.price.toFixed(2)}</span>,
  },
  {
    key: 'stock',
    label: 'Stock',
    className: 'text-right',
    render: (product) => (
      <Badge variant={product.stock <= 10 ? 'destructive' : 'default'}>{product.stock}</Badge>
    ),
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    hideOnMobile: true, // Hidden on mobile to save space
    render: (product) => product.warehouse_location || 'N/A',
  },
  {
    key: 'actions',
    label: 'Actions',
    className: 'text-right',
    mobileLabel: '', // No label on mobile (just show buttons)
    render: (product) => (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handleDelete(product)}>
          Delete
        </Button>
      </div>
    ),
  },
];
```

## Real-World Examples

### Example 1: Products Table

**File**: `app/(dashboard)/products/page.tsx`

```tsx
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  return (
    <ResponsiveTable<Product>
      data={products}
      keyExtractor={(product) => product.id}
      columns={[
        {
          key: 'sku',
          label: 'SKU',
          className: 'font-mono text-sm',
          render: (product) => product.sku,
        },
        {
          key: 'name',
          label: 'Product Name',
          className: 'font-medium',
          render: (product) => product.name,
        },
        {
          key: 'category',
          label: 'Category',
          hideOnMobile: true,
          render: (product) => <Badge variant="outline">{product.category}</Badge>,
        },
        {
          key: 'price',
          label: 'Price',
          className: 'text-right',
          render: (product) => `$${product.price.toFixed(2)}`,
        },
        {
          key: 'stock',
          label: 'Stock',
          className: 'text-right',
          render: (product) => (
            <Badge variant={product.stock <= 10 ? 'destructive' : 'default'}>{product.stock}</Badge>
          ),
        },
        {
          key: 'warehouse',
          label: 'Warehouse',
          hideOnMobile: true,
          render: (product) => product.warehouse_location || 'N/A',
        },
        {
          key: 'updated',
          label: 'Last Updated',
          hideOnMobile: true,
          className: 'text-sm text-muted-foreground',
          render: (product) => formatDateAU(product.updated_at),
        },
        {
          key: 'actions',
          label: 'Actions',
          className: 'text-right',
          mobileLabel: '',
          render: (product) => (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(product);
                }}
              >
                Edit
              </Button>
              <DeleteProductDialog product={product} onDelete={() => loadProducts()} />
            </div>
          ),
        },
      ]}
    />
  );
}
```

### Example 2: Orders Table with Status

**File**: `app/(dashboard)/orders/page.tsx`

```tsx
<ResponsiveTable<Order>
  data={orders}
  keyExtractor={(order) => order.id}
  onRowClick={(order) => router.push(`/dashboard/orders/${order.id}`)}
  columns={[
    {
      key: 'number',
      label: 'Order #',
      className: 'font-mono font-medium',
      render: (order) => order.order_number,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (order) => order.customer.company_name,
    },
    {
      key: 'date',
      label: 'Order Date',
      hideOnMobile: true,
      render: (order) => formatDateAU(order.order_date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>,
    },
    {
      key: 'items',
      label: 'Items',
      hideOnMobile: true,
      className: 'text-right',
      render: (order) => order.order_items.length,
    },
    {
      key: 'total',
      label: 'Total',
      className: 'text-right font-semibold',
      render: (order) => formatCurrencyAUD(order.total),
    },
    {
      key: 'actions',
      label: 'Actions',
      mobileLabel: '',
      render: (order) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(order);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ]}
/>
```

### Example 3: Customers Table

**File**: `app/(dashboard)/customers/page.tsx`

```tsx
<ResponsiveTable<Customer>
  data={customers}
  keyExtractor={(customer) => customer.id}
  columns={[
    {
      key: 'number',
      label: 'Customer #',
      className: 'font-mono',
      render: (customer) => customer.customer_number,
    },
    {
      key: 'company',
      label: 'Company',
      className: 'font-medium',
      render: (customer) => customer.company_name,
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (customer) => customer.contact_name,
    },
    {
      key: 'email',
      label: 'Email',
      hideOnMobile: true,
      render: (customer) => (
        <a
          href={`mailto:${customer.email}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {customer.email}
        </a>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      hideOnMobile: true,
      render: (customer) => formatPhoneAU(customer.phone),
    },
    {
      key: 'location',
      label: 'Location',
      hideOnMobile: true,
      render: (customer) => `${customer.city}, ${customer.state}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (customer) => (
        <Badge variant={customer.is_active ? 'default' : 'secondary'}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      mobileLabel: '',
      render: (customer) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(customer)}>
            Edit
          </Button>
          <DeleteCustomerDialog customer={customer} onDelete={() => loadCustomers()} />
        </div>
      ),
    },
  ]}
/>
```

## Mobile Optimization Patterns

### 1. Selective Column Hiding

Hide less critical columns on mobile:

```tsx
{
  key: "updated_at",
  label: "Last Updated",
  hideOnMobile: true,  // Nice to have but not essential on mobile
  render: (item) => formatDateAU(item.updated_at),
}
```

### 2. Compact Mobile Labels

Use shorter labels on mobile:

```tsx
{
  key: "price",
  label: "Unit Price (AUD)",   // Desktop
  mobileLabel: "Price",         // Mobile (shorter)
  render: (item) => formatCurrencyAUD(item.price),
}
```

### 3. Mobile-Optimized Actions

Actions work differently on mobile:

```tsx
{
  key: "actions",
  label: "Actions",
  mobileLabel: "",  // No label, just buttons
  render: (item) => (
    <div className="flex gap-2 justify-end">
      {/* Buttons are full-width on mobile for easier tapping */}
      <Button size="sm" className="md:w-auto w-full">
        Edit
      </Button>
    </div>
  ),
}
```

### 4. Mobile Card Styling

Add custom styling to mobile cards:

```tsx
<ResponsiveTable
  data={items}
  mobileCardClassName="hover:bg-accent/50 transition-colors"
  columns={...}
/>
```

## Responsive Breakpoints

Uses Tailwind's standard breakpoints:

| Screen         | Breakpoint | Behavior     |
| -------------- | ---------- | ------------ |
| Mobile         | 0-767px    | Card layout  |
| Tablet/Desktop | 768px+     | Table layout |

**CSS Classes**:

- `.hidden.md:block` - Hidden on mobile, visible on desktop (table)
- `.md:hidden` - Visible on mobile, hidden on desktop (cards)

## Accessibility Considerations

### 1. Keyboard Navigation

Tables are keyboard accessible by default:

```tsx
<TableRow
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      onRowClick?.(item);
    }
  }}
>
```

### 2. Screen Reader Support

Add ARIA labels for better screen reader experience:

```tsx
<Table aria-label="Products list">
  <TableHeader>
    <TableRow>
      <TableHead scope="col">Product Name</TableHead>
    </TableRow>
  </TableHeader>
</Table>
```

### 3. Touch Targets on Mobile

Ensure touch targets are at least 44x44px:

```tsx
<Button
  size="sm"
  className="min-h-[44px] min-w-[44px]" // WCAG 2.1 AA
>
  Edit
</Button>
```

## Performance Optimization

### 1. Virtualization for Large Datasets

For 1000+ rows, use virtualization:

```bash
pnpm add @tanstack/react-virtual
```

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Implement virtual scrolling
```

### 2. Pagination

For 50+ rows, add pagination:

```tsx
<ResponsiveTable
  data={paginatedData}
  ...
/>
<Pagination
  currentPage={page}
  totalPages={totalPages}
  onPageChange={setPage}
/>
```

## Testing Checklist

### Desktop Testing

- [ ] All columns visible
- [ ] Headers aligned with content
- [ ] Sorting works (if implemented)
- [ ] Row click triggers correct action
- [ ] Actions buttons work

### Mobile Testing

- [ ] Cards display properly (no overflow)
- [ ] Hidden columns not visible
- [ ] Actions accessible and tappable
- [ ] Touch targets ≥44px
- [ ] No horizontal scroll required
- [ ] Empty state displays correctly

### Cross-Browser

- [ ] Chrome/Edge (Chromium)
- [ ] Safari (iOS + macOS)
- [ ] Firefox

## Common Pitfalls

### 1. Forgetting Event Propagation

```tsx
// ❌ Bad - triggers row click when button clicked
<Button onClick={handleEdit}>Edit</Button>

// ✅ Good - stops propagation
<Button onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
  Edit
</Button>
```

### 2. Not Handling Empty State

```tsx
// ❌ Bad - shows empty table header
{data.length === 0 && <p>No data</p>}

// ✅ Good - proper empty state for both views
{data.length === 0 ? (
  <Card className="p-8 text-center">No results found</Card>
) : (
  // ... render data
)}
```

### 3. Inconsistent Key Extraction

```tsx
// ❌ Bad - may cause React warnings
keyExtractor={(item) => Math.random().toString()}

// ✅ Good - stable unique identifier
keyExtractor={(item) => item.id}
```

## Australian Context

### Date Formatting

Always use DD/MM/YYYY format:

```tsx
import { formatDateAU } from "@/lib/australian-context";

{
  key: "date",
  label: "Date",
  render: (item) => formatDateAU(item.created_at),  // 12/01/2026
}
```

### Currency Formatting

Always use AUD with $ prefix:

```tsx
import { formatCurrencyAUD } from "@/lib/australian-context";

{
  key: "price",
  label: "Price",
  render: (item) => formatCurrencyAUD(item.price),  // $1,234.56
}
```

### Phone Formatting

Australian phone number format:

```tsx
import { formatPhoneAU } from "@/lib/australian-context";

{
  key: "phone",
  label: "Phone",
  render: (item) => formatPhoneAU(item.phone),  // 0412 345 678
}
```

## Dependencies

No additional dependencies required beyond shadcn/ui:

```bash
# Already installed in project
@shadcn/ui (Table, Card, Badge, Button components)
```

## References

- [WCAG 2.1 - Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Responsive Tables - CSS Tricks](https://css-tricks.com/responsive-data-tables/)
- [shadcn/ui Table](https://ui.shadcn.com/docs/components/table)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
