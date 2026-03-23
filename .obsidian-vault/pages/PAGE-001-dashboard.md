---
type: page
id: PAGE-001
route: /dashboard
file: apps/web/app/(dashboard)/dashboard/page.tsx
domain: Infrastructure
in_sidebar: true
status: Active
links:
  - '[[ROUTE-001-health]]'
  - '[[ROUTE-015-inventory]]'
  - '[[COMPONENT-042-dashboard-summary]]'
last_verified: 2026-03-23
---

# PAGE-001: Main Dashboard

## Overview

Primary landing page after login. Shows key business metrics, recent activity, and system health status. Serves as the central hub for navigating to other modules.

<!-- AUTO-GENERATED -->

## Route Information

**URL**: `/dashboard`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

- [[ROUTE-001-health]]: `GET /api/health` - System health status
- [[ROUTE-015-inventory]]: `GET /api/inventory/summary` - Inventory KPIs
- `GET /api/dashboard/metrics` - Dashboard metrics (revenue, orders, customers)

## Components Used

- [[COMPONENT-042-dashboard-summary]]: Main KPI cards (4 metrics)
- `RecentOrdersTable`: Recent orders list
- `Cin7SyncStatusWidget`: Integration sync status
- `Card`: Standard card from shadcn/ui
- `Skeleton`: Loading skeleton from shadcn/ui

## State Management

- React hooks: `useState`, `useEffect`, `useRouter`
- Form library: None (read-only dashboard)
- Data fetching: apiClient from `@/lib/api/client`
- Polling: 30-second interval for health status

## Features

1. **KPI Cards**: Revenue, Orders, Customers, Active Products (last 30 days)
2. **Recent Activity**: Last 10 orders with status
3. **System Health**: Connection status for database, integrations
4. **Quick Actions**: Shortcuts to frequently-used pages

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## User Experience Notes

Dashboard loads data progressively:

1. Skeleton placeholders shown immediately
2. KPI metrics load first (cached, fast)
3. Recent orders load second
4. Integration status loads last (slowest)

This prevents the entire dashboard blocking on slow integration checks.

## Performance Considerations

- All dashboard metrics cached for 5 minutes on backend
- Frontend uses SWR pattern for automatic revalidation
- No infinite scroll (limits to 10 recent orders)
- Health widget polls every 30s, not real-time SSE (reduces load)

## Accessibility

- Skip navigation link for keyboard users
- ARIA labels on all KPI cards
- Focus trap in modal dialogs
- Screen reader announcements for metric changes

## Known Issues

1. **Metric Discrepancy**: Revenue shown is gross, not net (includes refunds)
   - Fix planned: UNI-1470 (add net revenue field)
2. **Slow Integration Status**: Cin7 health check can take 2-3 seconds
   - Workaround: Load asynchronously, don't block page render

<!-- END HUMAN-CURATED -->

## Data Flow

```
User lands on /dashboard
  ↓
DashboardPage component mounts
  ↓
useEffect triggers 3 parallel API calls:
  1. GET /api/dashboard/metrics
  2. GET /api/orders?limit=10&sort=created_at:desc
  3. GET /api/health
  ↓
State updates → UI rerenders with data
  ↓
30-second polling interval starts for health widget
```

## Related Pages

- [[PAGE-002-products]]: Products module (linked from Quick Actions)
- [[PAGE-003-customers]]: Customers module (linked from Quick Actions)
- [[PAGE-004-orders]]: Orders module (linked from Recent Orders)

## Screenshots

See Figma: https://figma.com/file/ccw-dashboard (internal link)

## Change History

| Date       | Change                           | Author         |
| ---------- | -------------------------------- | -------------- |
| 2026-03-23 | Created sample doc from template | Auto-generated |
