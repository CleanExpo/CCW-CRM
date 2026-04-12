# /pi-scan-routes — Scan and Catalog All Backend Routes

Reads all backend route files and updates docs/catalogs/ROUTES.md.
Delegates heavy reading to an Explore subagent to protect Orchestrator context.

## Steps

1. Spawn Explore agent: scan apps/backend/src/api/routes/ for all .py files
2. For each file, extract: router prefix, HTTP methods, endpoint paths, auth requirements
3. Cross-reference against apps/backend/src/api/main.py (registered routers)
4. Update docs/catalogs/ROUTES.md with findings
5. Flag: any .py files NOT imported in main.py (GAP)

## Output Format

Update ROUTES.md with entries:

```
### ROUTE-NNN: [Name]
- **File**: apps/backend/src/api/routes/[file].py
- **Prefix**: /api/[prefix]
- **Methods**: GET, POST, PUT, DELETE
- **Domain**: [Inventory|CRM|Orders|Financial|Integration|Content|Analytics|Infrastructure]
- **Auth**: Required/Public
- **Status**: Active/Unregistered/Deprecated
- **Last Verified**: [date]
```

## Gap Detection

Output any routes found in files but not in main.py as:
GAP: [filename] - not registered in main.py

## Usage

/pi-scan-routes
(No arguments needed — scans full routes directory)
