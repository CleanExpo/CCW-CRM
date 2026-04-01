---
name: sync-vault
description: Synchronize Obsidian vault with codebase by auto-generating docs from code
---

# /sync-vault — Synchronize Obsidian Vault with Codebase

**Usage**: `/sync-vault [entity-types] [--incremental] [--verify-only]`

**Purpose**: Auto-generate vault documentation with frontmatter from source code (routes, pages, models, components). Keeps vault synchronized with codebase to prevent documentation drift.

## What It Does

1. **Scans code files**: Routes (.py), Pages (.tsx), Models (.py), Components (.tsx)
2. **Extracts metadata**: Uses AST parsing to extract endpoints, props, columns, relationships
3. **Generates markdown**: Creates vault docs in `.obsidian-vault/` with YAML frontmatter
4. **Preserves human content**: Keeps `<!-- HUMAN-CURATED -->` blocks intact
5. **Updates tracking**: Records last sync commit hash in `.claude/memory/last-vault-sync.json`

## Entity Types

- `routes` - Backend FastAPI route files (120 files)
- `pages` - Frontend Next.js page.tsx files (83 files)
- `models` - SQLAlchemy model files (120 models from 39 files)
- `components` - React component files (107 files)
- `api-clients` - Frontend API client files (56 files)
- `integrations` - Integration directories (12 integrations)
- `all` - All of the above

## Sync Modes

**Incremental** (default, fast):

- Uses `git diff` to find changed files since last sync
- Only processes changed files (e.g., 3 changed routes vs 120 total)
- Duration: < 5 seconds for typical 10-file change

**Full** (comprehensive):

- Scans all files in respective directories
- Duration: ~30-60 seconds for full codebase
- Use when: Initial vault population or drift remediation

**Verify-only** (dry-run):

- Shows what would be generated without writing files
- Use to preview changes before committing

## Examples

### Quick sync (routes only, incremental)

```
/sync-vault routes
```

### Full resync (all entity types)

```
/sync-vault all --full
```

### Dry-run to see what would change

```
/sync-vault pages --verify-only
```

### Sync multiple types

```
/sync-vault routes,pages,models
```

## Implementation Steps

1. **Check if vault needs sync**:

   ```
   Read .claude/memory/last-vault-sync.json
   Calculate days since last sync
   If > 7 days, recommend sync
   ```

2. **Call Toolshed API**:

   ```
   POST /api/ai/toolshed/vault/sync
   {
     "entity_types": ["routes", "pages", "models"],
     "incremental": true,
     "verify_only": false
   }
   ```

3. **Display summary**:

   ```
   Vault Sync Complete:
     Routes: 12 updated, 3 created (4.2s)
     Pages: 2 updated (4.2s)
     Models: 5 updated (4.2s)
     Total: 22 files synced in 4.2s
   ```

4. **Update memory**:
   ```
   .claude/memory/last-vault-sync.json updated with:
   - last_commit_hash: <current git HEAD>
   - timestamp: <current UTC timestamp>
   - entity_types: ["routes", "pages", "models"]
   ```

## When to Use

**Run `/sync-vault` when**:

- Adding new routes, pages, or models
- Modifying existing endpoints or components
- Before starting a feature (to check for drift)
- After merging PRs (to update vault)
- Weekly as maintenance

**Don't run when**:

- Only editing HUMAN-CURATED sections (manual edits preserved)
- No code changes (incremental mode will skip)

## Output Format

The command generates markdown files with this structure:

```markdown
---
type: route
id: ROUTE-001
file: apps/backend/src/api/routes/health.py
prefix: /api
domain: Infrastructure
auth: Public
status: Active
endpoint_count: 4
registered: true
links:
  - '[[PAGE-001-dashboard]]'
last_verified: 2026-03-23
---

# ROUTE-001: Health Check

## Overview

Health check endpoints for system monitoring.

<!-- AUTO-GENERATED -->

## Endpoints

### GET /api/health

**Purpose**: Basic health check

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Architecture Notes

Add your notes here - this section is preserved during regeneration.

<!-- END HUMAN-CURATED -->
```

## Verification

After running `/sync-vault`, verify:

1. **Check summary**: Files created/updated counts match expectations
2. **Inspect a file**: Open `.obsidian-vault/routes/ROUTE-XXX-name.md`
3. **Verify frontmatter**: YAML is valid (no parse errors)
4. **Check git status**: New/modified vault docs appear in `git status`
5. **Commit vault changes**: `git add .obsidian-vault/ && git commit`

## Troubleshooting

**"Timeout after 120 seconds"**:

- Vault generator took too long
- Try smaller entity types: `/sync-vault routes` instead of `all`
- Or use `--verify-only` to see what's slow

**"Invalid entity types"**:

- Check spelling: `routes` not `route`, `api-clients` not `clients`
- Valid types: routes, pages, models, components, api-clients, integrations, all

**"No files generated"**:

- Check if files changed since last sync (incremental mode)
- Use `--full` to force regeneration
- Check `.claude/memory/last-vault-sync.json` for last sync timestamp

**"Human-curated content lost"**:

- This should never happen (protected by merge logic)
- If it does, git revert the vault changes and file a bug report
- The `<!-- HUMAN-CURATED -->` markers must be present for preservation

## Related Commands

- `/vault-drift` - Check for documentation drift (coming in Phase 5)
- `/toolshed <task>` - Assemble context bundle before planning
- `/quality-gate` - Run tests before marking complete

## Behind the Scenes

The command calls:

1. `POST /api/ai/toolshed/vault/sync` (Toolshed API endpoint)
2. Which runs `python scripts/vault-generator.py --entity-types <types>`
3. Which uses 6 AST parsers (parse_routes.py, parse_pages.py, etc.)
4. Which generate markdown with frontmatter from code
5. Which preserves HUMAN-CURATED blocks via regex extraction + merge
6. Which updates `.claude/memory/last-vault-sync.json` with commit hash

## Success Criteria

- [ ] Vault docs generated for all requested entity types
- [ ] Frontmatter YAML valid (no parse errors)
- [ ] HUMAN-CURATED sections preserved (if existed)
- [ ] AUTO-GENERATED sections updated with current code
- [ ] last-vault-sync.json updated with current commit hash
- [ ] Duration < 10 seconds (incremental mode for typical changes)

---

**Last Updated**: 2026-03-23 (Phase 4 implementation)
