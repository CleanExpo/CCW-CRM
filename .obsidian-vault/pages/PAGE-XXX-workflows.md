---
type: 'page'
id: 'PAGE-XXX'
route: '/dashboard/workflows'
file: 'apps/web/app/(dashboard)/workflows/page.tsx'
domain: 'CRM'
in_sidebar: false
status: 'Active'
links: []
last_verified: '2026-03-23'
---

# PAGE-XXX: Save failed

## Overview

Page at /dashboard/workflows

<!-- AUTO-GENERATED -->

## Route Information

**URL**: `/dashboard/workflows`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

- `workflowsApi.deleteTemplate()` - Purpose TBD
- `workflowsApi.createTemplate()` - Purpose TBD
- `workflowsApi.listTemplates()` - Purpose TBD
- `workflowsApi.updateTemplate()` - Purpose TBD
- `workflowsApi.listInstances()` - Purpose TBD

## Components Used

- `Button`: Purpose TBD
- `Badge`: Purpose TBD
- `Card`: Purpose TBD
- `CardContent`: Purpose TBD
- `CardHeader`: Purpose TBD
- `CardTitle`: Purpose TBD
- `Dialog`: Purpose TBD
- `DialogContent`: Purpose TBD
- `DialogHeader`: Purpose TBD
- `DialogTitle`: Purpose TBD
- `DialogFooter`: Purpose TBD
- ``: Purpose TBD
- `Form`: Purpose TBD
- `FormControl`: Purpose TBD
- `FormField`: Purpose TBD
- `FormItem`: Purpose TBD
- `FormLabel`: Purpose TBD
- `FormMessage`: Purpose TBD
- ``: Purpose TBD
- `Input`: Purpose TBD
- `Textarea`: Purpose TBD
- `Select`: Purpose TBD
- `SelectContent`: Purpose TBD
- `SelectItem`: Purpose TBD
- `SelectTrigger`: Purpose TBD
- `SelectValue`: Purpose TBD
- ``: Purpose TBD
- `AlertDialog`: Purpose TBD
- `AlertDialogAction`: Purpose TBD
- `AlertDialogCancel`: Purpose TBD
- `AlertDialogContent`: Purpose TBD
- `AlertDialogDescription`: Purpose TBD
- `AlertDialogFooter`: Purpose TBD
- `AlertDialogHeader`: Purpose TBD
- `AlertDialogTitle`: Purpose TBD
- ``: Purpose TBD
- `ErrorBoundary`: Purpose TBD

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
