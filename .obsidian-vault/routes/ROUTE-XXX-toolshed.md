---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/ai/toolshed.py'
prefix: '/api/ai/toolshed'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Toolshed

## Overview

Toolshed API — Context bundle assembly and code pattern retrieval.

Inspired by Stripe's Minions framework: assembles task-specific context bundles
from the 6 catalog files before any agent runs, enabling one-shot execution.

Endpoints:
  POST /api/ai/toolshed/bundle        — Assemble context bundle for a task
  GET  /api/ai/toolshed/search        — Full-text search across all catalogs
  GET  /api/ai/toolshed/pattern       — Return canonical code pattern by type
  POST /api/ai/toolshed/verify        — Run type-check + lint + pytest quality gate
  POST /api/ai/toolshed/vault/sync    — Sync Obsidian vault with codebase
  GET  /api/ai/toolshed/vault/drift   — Detect documentation drift
  GET  /api/ai/toolshed/vault/query   — Query vault frontmatter metadata

<!-- AUTO-GENERATED -->

## Endpoints


## Database Models Used

See code for model references

## Dependencies

- External APIs: None
- Internal services: Database
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

No related pages yet

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-03-23 | Auto-generated from code | vault-generator.py |
