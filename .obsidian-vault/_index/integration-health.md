# Integration Health

Status of all integration connections.

```dataview
TABLE provider, status, routes_prefix, file.link AS "Integration"
FROM "integrations"
WHERE status != "Active"
SORT status ASC
```

## All Integrations

```dataview
TABLE provider, status, file.link AS "Integration"
FROM "integrations"
SORT provider ASC
```

## Manual Health Check

For each integration, verify:

1. **Configuration exists**:
   - Check `.env` for `[PREFIX]_API_KEY` and `[PREFIX]_API_URL`
   - Verify mode: demo | live

2. **Connection works**:
   - Test endpoint: `GET /api/integrations/[prefix]/health`
   - Expected: `{"status": "connected"}`

3. **Sync logs recent**:
   - Check last sync: `GET /api/integrations/[prefix]/sync-logs`
   - Expected: Sync within last 24 hours

4. **No errors**:
   - Check error count in sync logs
   - Expected: 0 errors, or only transient errors (429, 5xx)

## Common Issues

**Status: Deprecated**:

- Integration no longer used
- Remove credentials from `.env`
- Consider removing code if truly unused

**Status: Beta**:

- Integration in testing
- Do not rely on for production workflows
- Monitor closely for errors

**No sync logs**:

- Webhook not configured
- Manual sync never triggered
- Check integration dashboard
