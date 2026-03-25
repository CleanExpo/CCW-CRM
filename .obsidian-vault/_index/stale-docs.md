# Stale Documentation

Documentation that hasn't been verified in 30+ days.

```dataview
TABLE last_verified, status, file.link AS "Document"
FROM "routes" OR "pages" OR "models" OR "components"
WHERE last_verified < date(today) - dur(30 days)
SORT last_verified ASC
LIMIT 50
```

## What to Do

1. Review the code file to verify accuracy
2. Update the vault doc if needed (edit HUMAN-CURATED sections)
3. Run `/sync-vault` to update last_verified date
4. Or manually update the frontmatter: `last_verified: 2026-03-24`

## Why This Matters

Stale docs may contain outdated:

- Endpoint signatures
- Component props
- Database columns
- Business logic descriptions

Keep docs fresh by reviewing monthly.
