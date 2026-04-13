# Finding Format Standard

All researcher agents write findings in this exact format to their domain memory file.

## File Header

```markdown
# [Domain] Research Findings

**Researcher**: [domain-name]
**Date**: [DD/MM/YYYY]
**Total findings**: N
**Files audited**: N
```

## Per Finding

```markdown
### Finding #N: [Short action-oriented title]

**Score hint**: CRITICAL / HIGH / MEDIUM / LOW
**Tags**: [domain] · [au-compliance|gst|ato|ux|security|integration] · [platform if applicable]
**Effort estimate**: [< 1 day | 1–3 days | 1–2 weeks | > 2 weeks]

**Gap**: [What is missing or broken — 2-3 sentences]

**Business impact**: [Why this matters for a $5-10M AU equipment supplier — 1-2 sentences]

**Affected files**:

- `exact/path/to/file.py:line_range`
- `exact/path/to/component.tsx`

**Suggested approach**: [What needs to be built/changed — 1-3 sentences]

## **Cross-platform**: [YES/NO — if YES, note which platform shares this gap]
```
