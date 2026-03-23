# CCW-ERP-CRM Obsidian Vault

## Overview

This vault provides a **knowledge graph layer** over the CCW-ERP-CRM codebase, enabling bidirectional navigation between documentation, code, and living catalogs.

**Key Features:**

- Auto-generated docs with YAML frontmatter from code
- Bidirectional wikilinks between entities ([[ROUTE-001]], [[PAGE-023]], [[MODEL-015]])
- Graph visualization of relationships (pages → routes → models → integrations)
- Pre-commit hooks prevent documentation drift
- Incremental sync (< 5 seconds for typical changes)

---

## Installation

### 1. Install Obsidian

Download from [obsidian.md](https://obsidian.md)

### 2. Open Vault

- Launch Obsidian
- Click "Open folder as vault"
- Navigate to: `D:\CCW-ERP-CRM\.obsidian-vault`

### 3. Install Required Plugins

- Open Settings (Ctrl/Cmd + ,)
- Community Plugins → Turn on community plugins
- Browse → Install:
  - **Dataview** (for queries)
  - **Templater** (for templates)
- Enable both plugins

---

## Vault Structure

```
.obsidian-vault/
├── .obsidian/          # Obsidian config (partial git tracking)
├── catalogs/           # SYMLINK → docs/catalogs/ (ROUTES, PAGES, MODELS, AGENTS, PACKAGES, INTEGRATIONS)
├── memory/             # SYMLINK → .claude/memory/ (CONSTITUTION, current-state, decisions-log, handoff)
├── routes/             # Individual route docs with frontmatter (auto-generated)
├── pages/              # Individual page docs with frontmatter (auto-generated)
├── models/             # Individual model docs with frontmatter (auto-generated)
├── components/         # Component docs (auto-generated)
├── integrations/       # Integration deep-dives
├── architecture/       # Technical architecture docs
├── workflows/          # Process documentation
└── _index/             # Auto-generated indexes and queries
```

---

## First 30 Minutes: Quick Tour

### 1. Graph View (Ctrl/Cmd + G)

- Click any node to jump to file
- Hover to see connections
- Filter by folder: `path:routes/` or `path:pages/`
- **Color coding:**
  - Red = Routes
  - Green = Pages
  - Blue = Models
  - Yellow = Components

### 2. Search Everything (Ctrl/Cmd + Shift + F)

- Search: `[[ROUTE-015-inventory]]`
- See all pages/components that reference this route
- Click any result to jump to file

### 3. Explore Catalogs (via Symlinks)

- Open `catalogs/ROUTES.md`
- Changes here immediately reflect in `docs/catalogs/ROUTES.md`
- Single source of truth maintained

### 4. Run a Dataview Query

- Open `_index/stale-docs.md` (create if doesn't exist yet)
- Paste query:

```dataview
TABLE last_verified, status
FROM "routes" OR "pages"
WHERE last_verified < date(today) - dur(30 days)
SORT last_verified ASC
```

- See all docs not verified in 30+ days

---

## Common Tasks

### Find All Routes Using a Model

1. Open `[[MODEL-015-product]]`
2. Click "Backlinks" panel (right sidebar)
3. See all routes/pages that reference Product model

**Alternative: Dataview Query**

```dataview
TABLE file.link AS "Route", endpoints
FROM "routes"
WHERE contains(links, "[[MODEL-015-product]]")
```

### Trace a Request Flow

1. Search for page: `[[PAGE-023-inventory]]`
2. Check `links:` in frontmatter → See routes it calls
3. Click route link → See models it queries
4. Graph view shows full data flow visually

### Impact Analysis Before Schema Change

1. Open model file: `[[MODEL-015-product]]`
2. Check frontmatter: `schema_locked: true` → ⚠️ LOCKED (demo_models.py)
3. Click "Show Local Graph" (2 levels)
4. See: 12 routes, 8 pages, 3 integrations connected
5. Decision: Use separate table instead of modifying Product

### Find Pattern to Follow

1. Search: `reference_pattern: true`
2. Find: `[[COMPONENT-001-login-form]]`
3. See: Standard form pattern (React Hook Form + Zod + TypeScript)
4. Copy pattern for new forms

---

## Maintenance

### Sync Vault with Code (Manual)

Run after adding/modifying routes, pages, or models:

```bash
# From Claude Code:
/sync-vault routes,pages,models --incremental

# Or directly:
python scripts/vault-generator.py --entity-types routes,pages,models --incremental
```

Duration: < 5 seconds for typical changes (10-20 files)

### Check for Drift

```bash
# Detect undocumented files or ghost entries:
python scripts/audit-vault.py

# From Claude Code:
/vault-drift
```

Output:

- Ghost entries (documented but file missing)
- Undocumented files (file exists but no vault entry)
- Stale docs (last_verified > 30 days ago)

### Pre-Commit Hook

Automatically runs before each commit. Blocks if vault is out of sync:

```
❌ Vault audit failed. Missing vault entry for apps/backend/src/api/routes/new_route.py
Run /sync-vault to fix
```

**Bypass (emergency only):**

```bash
git commit --no-verify -m "message"
```

---

## Key Concepts

### Frontmatter Metadata

Every auto-generated doc has YAML frontmatter:

```yaml
---
type: route
id: ROUTE-001
file: apps/backend/src/api/routes/health.py
status: Active
last_verified: 2026-03-23
links:
  - '[[PAGE-001-dashboard]]'
---
```

### Wikilinks

Connect entities: `[[ROUTE-001]]`, `[[PAGE-023]]`, `[[MODEL-015]]`

- Click to jump to file
- Backlinks show all references
- Graph view visualizes connections

### Human-Curated Content

Add notes that survive re-generation:

```markdown
<!-- HUMAN-CURATED -->

## Architecture Notes

This route uses the demo/live pattern. In production, calls real Cin7 API.
Critical: Never expose API keys in preview endpoints.

<!-- END HUMAN-CURATED -->
```

**Auto-generated sections** are marked:

```markdown
<!-- AUTO-GENERATED -->

## Endpoints

- GET /api/health
- GET /api/health/database
<!-- END AUTO-GENERATED -->
```

---

## Troubleshooting

### Symlinks Not Working

```bash
# Enable Git symlinks globally:
git config --global core.symlinks true

# Verify:
ls -la .obsidian-vault/  # catalogs/ and memory/ should show as links
```

### Graph View Slow

- Limit depth: Show Local Graph (2 levels)
- Use filters: `path:routes/` instead of showing all files
- Close large files in editor

### Dataview Queries Not Working

- Ensure Dataview plugin is installed and enabled
- Check syntax (case-sensitive: `WHERE`, not `where`)
- Refresh: Ctrl/Cmd + R

### Vault Out of Sync

```bash
# Full resync (slow, 30-60 seconds):
python scripts/vault-generator.py --entity-types routes,pages,models,components

# Incremental (fast, < 5 seconds):
python scripts/vault-generator.py --entity-types routes --incremental
```

---

## Pro Tips

1. **Bookmark key files**: Right-click → Add to bookmarks
   - `catalogs/ROUTES.md`
   - `memory/CONSTITUTION.md`
   - `memory/current-state.md`

2. **Pin queries**: Create `_index/my-queries.md` with frequently-used Dataview queries

3. **Use Ctrl+O** (Quick Switcher): Faster than file explorer for navigation

4. **Daily notes**: Create `06-daily-notes/2026-03-23.md` to track session work

5. **Canvas view**: Use Obsidian Canvas plugin to visually plan features

---

## Support

- **Vault issues**: Check `scripts/audit-vault.py` output
- **Performance**: Reduce graph depth, use filters
- **Questions**: See [Obsidian Help](https://help.obsidian.md)

**Last Updated**: 2026-03-23
