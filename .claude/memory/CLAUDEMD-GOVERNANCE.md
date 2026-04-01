# CLAUDE.md Governance — Inventory + Standards + Audit (UNI-1139)

**Version**: 1.0 | **Updated**: 2026-03-31
**Audit schedule**: Fortnightly — every 14 days, Monday 06:00 AEST session
**Auditor**: Scout CRON via `scripts/boardroom/claudemd-audit.js`
**Reviewer**: The Architect (board member)

---

## CLAUDE.md Inventory

All files that MUST exist across the Unite-Group stack:

| # | Project | Path | Business | Owner | Status | Last Updated |
|---|---|---|---|---|---|---|
| 1 | CCW-ERP-CRM root | `CLAUDE.md` | CCW | Phill McGurk | ✅ v4.1 | 2026-03-31 |
| 2 | CCW .claude | `.claude/CLAUDE.md` | CCW | Phill McGurk | ✅ v4.1 | 2026-03-31 |
| 3 | CCW Boardroom | `scripts/claude_md_template.md` | CCW | Boardroom | ✅ v3.0 | 2026-03-29 |
| 4 | CARSI root | `CLAUDE.md` | CARSI | G-Pilot | ⚠️ NEEDS AUDIT | 2026-02-xx |
| 5 | RestoreAssist root | `CLAUDE.md` | RestoreAssist | RA team | ⚠️ NEEDS AUDIT | 2026-xx-xx |
| 6 | G-Pilot Hub root | `CLAUDE.md` | G-Pilot | G-Pilot | ⚠️ NEEDS AUDIT | 2026-xx-xx |
| 7 | Bron Clone | `CLAUDE.md` | Bron | Unite-Group | ❌ MISSING | — |
| 8 | Unite-Group global | `~/.claude/CLAUDE.md` | All | Phill McGurk | ✅ active | 2026-03-xx |
| 9 | NodeJS Starter V1 | `CLAUDE.md` | Template | G-Pilot | 🔴 CANCELLED | — |

---

## Content Standards

Every CLAUDE.md MUST contain these sections (or the audit fails):

| Section | Required | Max length |
|---|---|---|
| Prime Directive | ✅ | 50 words |
| Absolute Prohibitions table | ✅ | 10 rows max |
| Mandatory Session Sequence | ✅ | 18 steps (standard) |
| Tech Stack | ✅ | Stack table only |
| Key Paths / Structure | ✅ | File tree |
| Board Member → Skill Bindings | ✅ | Standard table |
| Command Reference | ✅ | 6 commands |
| Progress Report Format | ✅ | Template block |
| Immutable Rules | ✅ | 6-8 rules |

---

## Forbidden Content

CLAUDE.md files MUST NOT contain:

- ❌ Hardcoded API keys, secrets, passwords, tokens
- ❌ TODO comments (use Linear issues instead)
- ❌ `FIXME`, `HACK`, `TEMP` annotations
- ❌ Absolute machine paths (`C:\Users\...`, `/home/user/...`)
- ❌ Version-specific SDK calls that change frequently
- ❌ Commented-out code blocks
- ❌ Content older than 90 days without a review date update

---

## Length Limits

| Limit | Value |
|---|---|
| Maximum lines | 500 |
| Minimum lines | 100 |
| Ideal target | 200–350 lines |

Files exceeding 500 lines are split into `CLAUDE.md` (main) + `.claude/CLAUDE-EXTENDED.md`

---

## Audit Criteria (Pass/Fail per file)

The `claudemd-audit.js` script checks each CLAUDE.md against these gates:

```javascript
const AUDIT_GATES = [
  { id: 'version_field', check: 'contains version: or **Version**' },
  { id: 'prime_directive', check: 'contains "PRIME DIRECTIVE"' },
  { id: 'prohibitions', check: 'contains "ABSOLUTE PROHIBITIONS" or "PROHIBITIONS"' },
  { id: 'tech_stack', check: 'contains "TECH STACK" or "Tech Stack"' },
  { id: 'session_sequence', check: 'contains "SESSION SEQUENCE" or "MANDATORY"' },
  { id: 'no_secrets', check: 'no hardcoded API keys (regex scan)' },
  { id: 'length_ok', check: 'line count between 100 and 500' },
  { id: 'updated_recently', check: 'updated within 90 days' },
];
```

Score: X/8 gates. **Pass = 7/8 minimum**. Fail triggers Linear issue creation.

---

## Audit Failure Response

When a CLAUDE.md fails audit:

1. `claudemd-audit.js` logs failure to `data/sessions/{sessionId}/claudemd-audit.json`
2. Boardroom's Security Sentinel flags in next session debrief
3. The Architect assigns Linear issue to fix within 7 days
4. Next fortnightly audit validates the fix

---

## Fortnightly Schedule

| Date | Session | Action |
|---|---|---|
| Mon 2026-04-13 | Next audit | Full inventory scan |
| Mon 2026-04-27 | Audit 2 | Verify fixes from Audit 1 |
| Mon 2026-05-11 | Audit 3 | + new projects since last audit |
| Monthly | Architecture review | Architect updates master template if needed |
