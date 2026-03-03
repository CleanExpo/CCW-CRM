# /pi-cross-ref — Cross-Reference Routes, Pages, and API Clients

Finds orphans: routes with no frontend page, pages with no API client, API clients with no backend route.

## Steps

1. Read docs/catalogs/ROUTES.md (all backend routes)
2. Read docs/catalogs/PAGES.md (all frontend pages)
3. Read apps/web/lib/api/\*.ts (all API clients)
4. Cross-reference:
   - Routes → Pages: which routes have no corresponding frontend page?
   - Pages → API clients: which pages make no API calls (static)?
   - API clients → Routes: which API client calls go to non-existent routes?
5. Output priority matrix of gaps

## Output Format

```
## Orphan Routes (backend route, no frontend page):
- ROUTE-NNN: /api/contractors — no frontend page found

## Orphan Pages (frontend page, no API client):
- PAGE-NNN: /bank-feeds — reads no API

## Broken API Clients (calls non-existent route):
- apps/web/lib/api/X.ts calls /api/Y — not found in ROUTES catalog

## Priority Matrix:
| Gap | Impact | Effort | Priority |
|-----|--------|--------|---------|
```

## Usage

/pi-cross-ref
