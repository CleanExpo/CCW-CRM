---
type: api-client
id: CLIENT-{{CLIENT_NUMBER}}
file: apps/web/lib/api/{{FILE_NAME}}.ts
module: {{MODULE_NAME}}
exports: {{EXPORTED_NAME}}Api
status: Active|Deprecated
links:
  - "[[ROUTE-NNN]]"
  - "[[PAGE-NNN]]"
last_verified: {{DATE}}
---

# CLIENT-{{CLIENT_NUMBER}}: {{CLIENT_NAME}} API Client

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Exported API

**File**: `apps/web/lib/api/{{FILE_NAME}}.ts`

**Export**: `{{EXPORTED_NAME}}Api`

**Methods**:

### getList()

```typescript
getList(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<PaginatedResponse<{{TYPE}}>>
```

**Backend Route**: [[ROUTE-NNN]] `GET /api/{{PREFIX}}`

### getById()

```typescript
getById(id: string): Promise<{{TYPE}}>
```

**Backend Route**: [[ROUTE-NNN]] `GET /api/{{PREFIX}}/{id}`

### create()

```typescript
create(data: Create{{TYPE}}Request): Promise<{{TYPE}}>
```

**Backend Route**: [[ROUTE-NNN]] `POST /api/{{PREFIX}}`

### update()

```typescript
update(id: string, data: Update{{TYPE}}Request): Promise<{{TYPE}}>
```

**Backend Route**: [[ROUTE-NNN]] `PUT /api/{{PREFIX}}/{id}`

### delete()

```typescript
delete(id: string): Promise<void>
```

**Backend Route**: [[ROUTE-NNN]] `DELETE /api/{{PREFIX}}/{id}`

## Type Definitions

**{{TYPE}}**:

```typescript
interface {{TYPE}} {
  id: string;
  created_at: string;
  updated_at: string;
  field1: string;
  field2: number;
}
```

**Create{{TYPE}}Request**:

```typescript
interface Create{{TYPE}}Request {
  field1: string;
  field2: number;
}
```

**Update{{TYPE}}Request**:

```typescript
interface Update{{TYPE}}Request {
  field1?: string;
  field2?: number;
}
```

## Used By Pages

- [[PAGE-NNN]]: CRUD operations
- [[PAGE-NNN]]: List view

## Used By Components

- [[COMPONENT-NNN]]: Usage context
- [[COMPONENT-NNN]]: Usage context

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Usage Guidelines

**Standard pattern**:

```typescript
import { {{EXPORTED_NAME}}Api } from '@/lib/api/{{FILE_NAME}}';

// In a component
try {
  const items = await {{EXPORTED_NAME}}Api.getList({
    page: 1,
    page_size: 50
  });
  // Handle success
} catch (error) {
  toast({
    title: 'Error',
    description: error.message,
    variant: 'destructive'
  });
}
```

**Pagination pattern**:

```typescript
const [page, setPage] = useState(1);
const { data, total } = await {{EXPORTED_NAME}}Api.getList({
  page,
  page_size: 50
});
```

## Error Handling

- All methods throw `ApiClientError` on failure
- Error contains: `message`, `status`, `data`
- Component should catch and show toast notification

## Authentication

- All requests include JWT token from cookies automatically
- No manual token handling required
- Uses `apiClient` from `@/lib/api/client.ts`

## Testing

- Unit tests: `__tests__/lib/api/{{FILE_NAME}}.test.ts`
- Mocks: Use `vi.mock('@/lib/api/client')` to mock apiClient

## Known Issues

Document:

- Rate limiting considerations
- Known API quirks
- TODOs

<!-- END HUMAN-CURATED -->

## Backend Mapping

| Frontend Method | Backend Route                 | Backend File  |
| --------------- | ----------------------------- | ------------- |
| `getList()`     | `GET /api/{{PREFIX}}`         | [[ROUTE-NNN]] |
| `getById()`     | `GET /api/{{PREFIX}}/{id}`    | [[ROUTE-NNN]] |
| `create()`      | `POST /api/{{PREFIX}}`        | [[ROUTE-NNN]] |
| `update()`      | `PUT /api/{{PREFIX}}/{id}`    | [[ROUTE-NNN]] |
| `delete()`      | `DELETE /api/{{PREFIX}}/{id}` | [[ROUTE-NNN]] |

## Related Clients

- [[CLIENT-NNN]]: Related API client
- [[CLIENT-NNN]]: Depends on this client

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
