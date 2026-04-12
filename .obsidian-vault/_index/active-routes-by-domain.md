# Active Routes by Domain

Breakdown of all active backend routes by domain.

## CRM Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "CRM" AND status = "Active"
SORT file.name ASC
```

## Inventory Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "Inventory" AND status = "Active"
SORT file.name ASC
```

## Orders Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "Orders" AND status = "Active"
SORT file.name ASC
```

## Financial Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "Financial" AND status = "Active"
SORT file.name ASC
```

## Integration Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "Integration" AND status = "Active"
SORT file.name ASC
```

## AI Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "AI" AND status = "Active"
SORT file.name ASC
```

## Infrastructure Domain

```dataview
TABLE prefix, endpoint_count, auth, file.link AS "Route"
FROM "routes"
WHERE domain = "Infrastructure" AND status = "Active"
SORT file.name ASC
```

## Summary Stats

Total active routes: Count manually from above

Distribution helps identify:

- Over/under-developed domains
- API surface area per module
- Authentication patterns per domain
