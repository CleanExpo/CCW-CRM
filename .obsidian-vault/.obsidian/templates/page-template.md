---
type: page
id: PAGE-{{PAGE_NUMBER}}
route: /dashboard/{{PATH}}
file: apps/web/app/(dashboard)/{{PATH}}/page.tsx
domain: CRM|Inventory|Orders|Financial|Integrations|AI|Settings
in_sidebar: true|false
status: Active|Placeholder|Deprecated
links:
  - '[[ROUTE-NNN]]'
  - '[[COMPONENT-NNN]]'
last_verified: { { DATE } }
---

# PAGE-{{PAGE_NUMBER}}: {{PAGE_NAME}}

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Route Information

**URL**: `/dashboard/{{PATH}}`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

- [[ROUTE-NNN]]: `GET /api/endpoint` - Purpose
- [[ROUTE-NNN]]: `POST /api/endpoint` - Purpose
- [[ROUTE-NNN]]: `PUT /api/endpoint/{id}` - Purpose
- [[ROUTE-NNN]]: `DELETE /api/endpoint/{id}` - Purpose

## Components Used

- [[COMPONENT-NNN]]: Purpose on this page
- [[COMPONENT-NNN]]: Purpose on this page
- `DataTable`: Standard data table from shadcn/ui
- `Dialog`: Standard dialog from shadcn/ui

## State Management

- React hooks: `useState`, `useEffect`, `useRouter`
- Form library: React Hook Form + Zod validation
- Data fetching: apiClient from `@/lib/api/client`

## Features

1. **Feature 1**: Description
2. **Feature 2**: Description
3. **Feature 3**: Description

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
Backend Route [[ROUTE-NNN]]
  ↓
Database Query [[MODEL-NNN]]
  ↓
Response
  ↓
UI Update
```

## Related Pages

- [[PAGE-NNN]]: Parent/sibling page
- [[PAGE-NNN]]: Related workflow page

## Screenshots

Add screenshots or link to Figma designs here.

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
