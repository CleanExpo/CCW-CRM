# /pi-scan-pages — Scan and Catalog All Frontend Pages

Reads all Next.js page files and updates docs/catalogs/PAGES.md.

## Steps

1. Glob apps/web/app/(dashboard)/\*\*/page.tsx for all pages
2. For each page, extract: route path, title (from H1 or metadata), API clients used
3. Cross-reference against apps/web/components/layout/sidebar.tsx (nav links)
4. Update docs/catalogs/PAGES.md with findings
5. Flag: pages not in sidebar (hidden) + sidebar links to non-existent pages (broken)

## Output Format

```
### PAGE-NNN: [Name]
- **Route**: /(dashboard)/[path]
- **File**: apps/web/app/(dashboard)/[path]/page.tsx
- **Title**: [H1 text]
- **In Sidebar**: Yes/No
- **API Clients**: [lib/api/client.ts calls]
- **Status**: Active/Hidden/Broken
- **Last Verified**: [date]
```

## Gap Detection

- Hidden pages (exist on disk, not in sidebar nav)
- Broken nav links (in sidebar, no page.tsx found)

## Usage

/pi-scan-pages
