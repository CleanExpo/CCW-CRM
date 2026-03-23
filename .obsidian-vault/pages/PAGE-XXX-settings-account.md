---
type: 'page'
id: 'PAGE-XXX'
route: '/dashboard/settings/account'
file: 'apps/web/app/(dashboard)/settings/account/page.tsx'
domain: 'CRM'
in_sidebar: false
status: 'Active'
links: []
last_verified: '2026-03-23'
---

# PAGE-XXX: Profile Updated

## Overview

Page at /dashboard/settings/account

<!-- AUTO-GENERATED -->

## Route Information

**URL**: `/dashboard/settings/account`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

- `settingsApi.updateAccount()` - Purpose TBD
- `settingsApi.changePassword()` - Purpose TBD
- `settingsApi.getAccount()` - Purpose TBD

## Components Used

- `Button`: Purpose TBD
- `Input`: Purpose TBD
- `Label`: Purpose TBD
- `Card`: Purpose TBD
- `CardContent`: Purpose TBD
- `CardDescription`: Purpose TBD
- `CardHeader`: Purpose TBD
- `CardTitle`: Purpose TBD
- `Separator`: Purpose TBD
- `Switch`: Purpose TBD

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
