# Missing Tests

Pages without corresponding test files.

```dataview
TABLE route, domain, status, file.link AS "Page"
FROM "pages"
WHERE status = "Active"
SORT domain ASC, file.name ASC
LIMIT 50
```

## Manual Check Required

Dataview cannot check filesystem for test files, so manually verify:

1. For each page above, check if test exists:
   - `apps/web/__tests__/[page-name].test.tsx`
   - `apps/web/app/(dashboard)/[path]/__tests__/page.test.tsx`

2. If missing, create test file:

   ```typescript
   import { render, screen } from '@testing-library/react';
   import Page from '../page';

   describe('PageName', () => {
     it('renders without crashing', () => {
       render(<Page />);
       expect(screen.getByRole('heading')).toBeInTheDocument();
     });
   });
   ```

## Priority

**High priority** (test first):

- Financial domain pages (billing, invoices, payments)
- CRM pages with customer data
- Orders and quotes (business critical)

**Medium priority**:

- Inventory and warehouse
- Settings and integrations

**Low priority**:

- Dashboard and analytics (read-only)
- Static pages (FAQ, etc.)
