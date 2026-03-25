---
type: 'page'
id: 'PAGE-XXX'
route: '/dashboard/orders/fulfilment'
file: 'apps/web/app/(dashboard)/orders/fulfilment/page.tsx'
domain: 'CRM'
in_sidebar: false
status: 'Active'
links: []
last_verified: '2026-03-23'
---

# PAGE-XXX: Validation error

## Overview

Page at /dashboard/orders/fulfilment

<!-- AUTO-GENERATED -->

## Route Information

**URL**: `/dashboard/orders/fulfilment`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

- `cin7FulfilmentApi.listPayments()` - Purpose TBD
- `cin7FulfilmentApi.markInvoicePaid()` - Purpose TBD
- `cin7FulfilmentApi.updateFulfilmentStatus()` - Purpose TBD
- `cin7FulfilmentApi.listInvoices()` - Purpose TBD
- `cin7FulfilmentApi.syncInvoices()` - Purpose TBD
- `cin7FulfilmentApi.createFulfilment()` - Purpose TBD
- `cin7FulfilmentApi.listFulfilments()` - Purpose TBD

## Components Used

- `Button`: Purpose TBD
- `Badge`: Purpose TBD
- `Table`: Purpose TBD
- `TableBody`: Purpose TBD
- `TableCell`: Purpose TBD
- `TableHead`: Purpose TBD
- `TableHeader`: Purpose TBD
- `TableRow`: Purpose TBD
- ``: Purpose TBD
- `Tabs`: Purpose TBD
- `TabsContent`: Purpose TBD
- `TabsList`: Purpose TBD
- `TabsTrigger`: Purpose TBD
- `Dialog`: Purpose TBD
- `DialogContent`: Purpose TBD
- `DialogDescription`: Purpose TBD
- `DialogFooter`: Purpose TBD
- `DialogHeader`: Purpose TBD
- `DialogTitle`: Purpose TBD
- ``: Purpose TBD
- `Input`: Purpose TBD
- `Label`: Purpose TBD

## State Management

- React hooks: `useState`, `useEffect`, `useRouter`
- Form library: React Hook Form + Zod validation (if applicable)
- Data fetching: apiClient from `@/lib/api/client`

## Features

See code for feature list

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## User Experience Notes

Add notes about UX decisions, user feedback, or design rationale here.

## Performance Considerations

Document any performance optimizations, lazy loading, or caching strategies.

## Accessibility

Note any WCAG compliance considerations or keyboard navigation patterns.

## Known Issues

Document any UI bugs, browser compatibility issues, or TODOs.

<!-- END HUMAN-CURATED -->

## Data Flow

```
User Action
  ↓
Component State Update
  ↓
API Call via apiClient
  ↓
Backend Route
  ↓
Database Query
  ↓
Response
  ↓
UI Update
```

## Related Pages

No related pages yet

## Screenshots

Add screenshots or link to Figma designs here.

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
