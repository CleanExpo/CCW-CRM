# Orphaned Routes

Backend routes with no frontend pages calling them.

```dataview
TABLE prefix, endpoint_count, status, file.link AS "Route"
FROM "routes"
WHERE length(file.outlinks) = 0 OR !contains(file.outlinks, "PAGE")
SORT status ASC, file.name ASC
LIMIT 50
```

## What to Do

**If route is unused**:

- Mark as deprecated: `status: Deprecated`
- Consider removing if safe

**If route is used**:

- Add wikilink in page doc: `[[ROUTE-XXX-name]]`
- Run `/sync-vault` to regenerate

**If route is infrastructure**:

- Health checks, webhooks, background jobs are expected to be orphaned
- Verify domain is "Infrastructure" or "Integration"

## Why This Matters

Orphaned routes may indicate:

- Dead code (can be removed)
- Missing frontend implementation
- API endpoints not exposed in UI
- Integration-only endpoints (expected)
