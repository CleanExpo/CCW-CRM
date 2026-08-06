# Claude Memory System Documentation

> **New modular memory system using Claude's latest memory management features**

## Overview

This project now uses Claude's new memory management system to reduce context bloating and provide better organization. The system uses path-specific rules that only load when relevant to your current work.

## Memory Hierarchy

### 1. Project Memory (`.claude/CLAUDE.md`)
- **Location**: `.claude/CLAUDE.md`
- **Purpose**: Main project overview and quick commands
- **Contains**: Architecture overview, key systems, environment setup
- **Loads**: Always (for all project work)

### 2. Path-Specific Rules (`.claude/rules/`)
- **Location**: `.claude/rules/{category}/{rule-name}.md`
- **Purpose**: Detailed rules that only load when working on relevant files
- **Contains**: Specific patterns, conventions, and examples
- **Loads**: Only when working with matching file paths

## Path-Specific Rules

| Rule File | Triggers On | Contains |
|-----------|-------------|----------|
| `frontend/nextjs.md` | `apps/web/**/*.{ts,tsx}` | Next.js, React, Tailwind patterns |
| `backend/fastapi-agents.md` | `apps/backend/src/**/*.py` | FastAPI, Python, agent patterns |
| `database/supabase-migrations.md` | `supabase/**/*.sql` | Database migrations, RLS, pgvector |
| `skills/orchestration.md` | `skills/**/*.md` | Skill system, agent orchestration |
| `development/workflow.md` | N/A | General workflow, commands, conventions |

## Benefits

### ✅ Reduced Context Bloat
- Rules only load when relevant to current files
- No more massive AGENTS.md files in every directory
- Cleaner, more focused context

### ✅ Better Organization
- Modular rules organized by domain
- Easy to find and update specific patterns
- Clear separation of concerns

### ✅ Team Collaboration
- Shared project rules in `.claude/rules/`
- Personal settings in `CLAUDE.local.md` (gitignored)
- Consistent patterns across team members

## Using the System

### For Development Work

1. **Frontend Work**: Open any file in `apps/web/` → Frontend rules auto-load
2. **Backend Work**: Open any file in `apps/backend/src/` → Backend rules auto-load
3. **Database Work**: Open any SQL file in `supabase/` → Database rules auto-load
4. **Skills Work**: Open any skill file → Skills rules auto-load

### For Personal Preferences

1. Copy `CLAUDE.local.md.template` to `CLAUDE.local.md`
2. Add your personal preferences, shortcuts, notes
3. This file is gitignored and stays private to you

### Adding New Rules

1. Create file in appropriate `.claude/rules/{category}/` directory
2. Add YAML frontmatter with `paths:` field:
   ```markdown
   ---
   paths: your/glob/pattern/**/*.ext
   ---
   
   # Your Rule Content
   ```
3. Rules automatically load when working with matching paths

## Migration from Old System

### What Was Moved

- **Root `CLAUDE.md`** → Streamlined to `.claude/CLAUDE.md`
- **`apps/web/AGENTS.md`** → `.claude/rules/frontend/nextjs.md`
- **`apps/backend/AGENTS.md`** → `.claude/rules/backend/fastapi-agents.md`
- **`supabase/AGENTS.md`** → `.claude/rules/database/supabase-migrations.md`
- **`skills/AGENTS.md`** → `.claude/rules/skills/orchestration.md`

### What's New

- **Path-specific loading**: Rules only load when relevant
- **Personal settings**: `CLAUDE.local.md` for private preferences
- **Modular organization**: Easier to maintain and update
- **Reduced context**: Only relevant information loads

## File Structure

```
.claude/
├── CLAUDE.md                     # Main project memory
└── rules/
    ├── frontend/
    │   └── nextjs.md            # Next.js frontend rules
    ├── backend/
    │   └── fastapi-agents.md    # FastAPI backend rules
    ├── database/
    │   └── supabase-migrations.md  # Database rules
    ├── skills/
    │   └── orchestration.md     # Skills system rules
    └── development/
        └── workflow.md          # General workflow rules

CLAUDE.local.md.template         # Template for personal settings
CLAUDE.local.md                 # Your personal settings (gitignored)
```

## Commands Reference

```bash
# View loaded memory files
/memory

# Add quick memory
# Your instruction here

# Edit memory files  
/memory

# Test the system
# Work on files in different directories and see relevant rules load
```

## Best Practices

1. **Keep rules focused**: Each rule file should cover one domain
2. **Use specific paths**: Target exact file patterns in frontmatter
3. **Update incrementally**: Add rules as patterns emerge
4. **Document decisions**: Explain why patterns exist
5. **Regular cleanup**: Remove outdated rules and patterns

---

**Next Steps**: Start using the system and refine rules based on actual usage patterns.
