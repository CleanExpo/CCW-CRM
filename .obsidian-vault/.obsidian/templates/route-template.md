---
type: route
id: ROUTE-{{ROUTE_NUMBER}}
file: apps/backend/src/api/routes/{{FILE_NAME}}.py
prefix: /api/{{PREFIX}}
domain: Infrastructure|CRM|Inventory|Orders|Financial|Integration|Analytics|AI
auth: Public|JWT|API-Key
status: Active|Unregistered|Deprecated
endpoint_count: 0
registered: true|false
links:
  - '[[PAGE-NNN]]'
  - '[[MODEL-NNN]]'
last_verified: { { DATE } }
---

# ROUTE-{{ROUTE_NUMBER}}: {{ROUTE_NAME}}

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Endpoints

### GET {{PREFIX}}/endpoint

**Purpose**: Brief description of what this endpoint does

**Request Parameters**:

- `param1` (string, optional): Description
- `param2` (int, required): Description

**Response**:

```json
{
  "data": [],
  "total": 0
}
```

**Authentication**: {{AUTH_TYPE}}

### POST {{PREFIX}}/endpoint

**Purpose**: Brief description

**Request Body**:

```json
{
  "field1": "value",
  "field2": 123
}
```

**Response**:

```json
{
  "id": "uuid",
  "message": "Success"
}
```

## Database Models Used

- [[MODEL-NNN]]: Purpose in this route
- [[MODEL-NNN]]: Purpose in this route

## Dependencies

- External APIs: None
- Internal services: None
- Background tasks: None

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Architecture Notes

Add notes about design decisions, gotchas, or special considerations here.

## Testing Notes

Add notes about test coverage, edge cases, or manual testing steps here.

## Known Issues

Document any known issues, TODOs, or technical debt here.

<!-- END HUMAN-CURATED -->

## Related Pages

- [[PAGE-NNN]]: Page that calls this route

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
