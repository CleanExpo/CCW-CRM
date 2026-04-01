# /audit Command

**Purpose:** Validate project structure and compliance with rules

**Triggers:** `/audit`, `/audit [scope]`

---

## What It Does

Checks project for rule violations:

### 1. Folder Structure
- No unauthorized folders exist
- All required folders present
- No temp/backup/old folders

### 2. File Compliance
- CLAUDE.md exists and readable
- package.json valid
- No forbidden file patterns
- No console.log in src/

### 3. Package Compliance
- No unauthorized packages
- No large packages (>5MB)
- Versions match lock file

### 4. Code Quality
- TypeScript compiles
- Lint passes
- Tests pass

### 5. Security
- No hardcoded secrets
- No exposed API keys
- .env files not committed

---

## Usage

```
# Full audit
/audit

# Quick folder check only
/audit folders

# Package audit only
/audit packages

# Security check only
/audit security
```

---

## When To Use

- Before committing
- Before creating PR
- Before deployment
- When suspicious of rule violations
- Weekly as preventive check

---

## Related

- `.claude/.directives` - Full rule set
- `.claude/CLAUDE.md` - What's forbidden
- `scripts/sync-framework.sh` - Validation script
