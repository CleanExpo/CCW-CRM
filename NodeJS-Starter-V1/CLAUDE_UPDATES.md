# Claude Rule Updates (Self-Evolution Protocol)

**Project**: CCW-Online-ERP
**Purpose**: Proposed updates to CLAUDE.md based on recurring issues
**Status**: Pending User Approval

---

## How This Works

When Claude detects the same error or issue **3+ times**, it should propose a rule update here using the template below. **DO NOT modify CLAUDE.md directly** - all changes require user approval.

---

## Approval Workflow

1. **Claude detects recurring pattern** (3+ occurrences of same error)
2. **Claude adds proposal below** using template
3. **User reviews proposal** and decides:
   - ✅ Approve → User merges into CLAUDE.md
   - ❌ Reject → User deletes proposal with explanation
   - 🔄 Revise → User provides feedback

---

## Pending Proposals

### Proposal Template

```markdown
## [Proposal ID]: [Short Title]

**Date Proposed**: YYYY-MM-DD
**Occurrences**: X times
**Severity**: Low | Medium | High | Critical

### Problem Statement
Clear description of the recurring issue or gap in current rules.

### Current Behavior
What currently happens that leads to errors or confusion.

### Proposed Rule
Exact text to be added to CLAUDE.md:

> [Rule text in blockquote format, ready to copy-paste]

### Location in CLAUDE.md
Where this should be added:
- Section: [Section Name]
- After line: [Approximate line number or anchor]
- Alternative: New section titled "[Section Name]"

### Evidence (Occurrences)
1. **Occurrence 1** (Date):
   - Context: [Brief description]
   - Error/Issue: [What went wrong]
   - Resolution: [How it was fixed]

2. **Occurrence 2** (Date):
   - Context: [Brief description]
   - Error/Issue: [What went wrong]
   - Resolution: [How it was fixed]

3. **Occurrence 3** (Date):
   - Context: [Brief description]
   - Error/Issue: [What went wrong]
   - Resolution: [How it was fixed]

### Expected Impact
- **Positive**: What this rule will prevent or improve
- **Negative**: Any potential downsides or limitations

### Related Rules
- Links to existing rules in CLAUDE.md, PATTERNS.md, SCHEMA.md, or TROUBLESHOOTING.md
- Conflicts or overlaps to resolve

---

**User Decision**:
- [ ] Approve (merge into CLAUDE.md)
- [ ] Reject (delete with reason below)
- [ ] Revise (feedback below)

**User Notes**:
[User adds approval/rejection reason or revision feedback here]
```

---

## Example Proposal

## [PROP-001]: Always Use MAX for Sequential Numbers

**Date Proposed**: 2026-01-13
**Occurrences**: 3 times
**Severity**: High

### Problem Statement
Using COUNT to generate sequential numbers (order_number, quote_number) causes duplicate key errors when there are gaps in the sequence (e.g., deleted records).

### Current Behavior
When generating order numbers, code uses COUNT which returns total records, not highest number. If ORD-2026-005 is deleted, COUNT returns 8 but should generate ORD-2026-010 (next after 009).

### Proposed Rule
Add to CLAUDE.md in "Database Query Patterns" section:

> **Sequential Number Generation Rule**:
>
> When generating sequential numbers (order_number, quote_number, invoice_number), ALWAYS use MAX approach:
>
> ```python
> # ✅ CORRECT: Use MAX to find highest existing number
> query = select(func.max(Model.number_field)).where(
>     Model.number_field.like(f"PREFIX-{year}-%")
> )
> result = await db.execute(query)
> max_number = result.scalar_one_or_none()
> next_number = int(max_number.split("-")[-1]) + 1 if max_number else 1
>
> # ❌ INCORRECT: COUNT doesn't handle gaps
> query = select(func.count()).where(
>     Model.number_field.like(f"PREFIX-{year}-%")
> )
> ```
>
> **Why**: COUNT returns total records, which doesn't account for deleted records or gaps in sequence. MAX always finds the true highest number.

### Location in CLAUDE.md
- Section: "Common Query Patterns" or new "Sequential Number Generation" subsection
- After: Database Schema Reference section
- Before: Testing Requirements section

### Evidence (Occurrences)

1. **Occurrence 1** (2026-01-13):
   - Context: Creating new order via POST /api/orders
   - Error/Issue: `IntegrityError: duplicate key value violates unique constraint "orders_order_number_key" DETAIL: Key (order_number)=(ORD-2026-009) already exists`
   - Resolution: Changed generate_order_number() to use MAX instead of COUNT

2. **Occurrence 2** (2026-01-10):
   - Context: Testing order creation in development
   - Error/Issue: Same duplicate key error when order ORD-2026-005 was deleted earlier
   - Resolution: Manually assigned order number, noted pattern

3. **Occurrence 3** (2026-01-08):
   - Context: Quote number generation had same issue
   - Error/Issue: Duplicate quote_number after deleting old quotes
   - Resolution: Used MAX approach similar to order fix

### Expected Impact
- **Positive**:
  - Prevents duplicate key errors for sequential numbers
  - Handles deleted records correctly
  - Works with gaps in sequence
  - More robust and predictable

- **Negative**:
  - Slightly slower query (MAX vs COUNT) but negligible performance impact
  - Must parse string to extract number, but this is already done in most implementations

### Related Rules
- SCHEMA.md: Unique constraints on order_number, quote_number
- TROUBLESHOOTING.md: "IF: SQLAlchemy IntegrityError (unique constraint violation)"
- PATTERNS.md: "Generate Sequential Number" pattern (already uses MAX approach)

---

**User Decision**:
- [x] Approve (merge into CLAUDE.md) ← **APPROVED BY USER**
- [ ] Reject (delete with reason below)
- [ ] Revise (feedback below)

**User Notes**:
Good catch! This is a critical pattern. Merge this into CLAUDE.md under a new "Sequential Number Generation" subsection in the database patterns area. Also update any existing COUNT-based code in the codebase to use MAX.

---

## Rejected Proposals (Archive)

### Why Keep Rejected Proposals?
Learning from rejections helps Claude understand:
- What patterns the user doesn't want automated
- Edge cases or context that changed the decision
- Types of rules that don't fit this project

---

### [Example Rejection] PROP-002: Auto-format All Code on Save

**Rejected**: 2026-01-14
**Reason**: Project uses pre-commit hooks for formatting. Auto-formatting on save can cause git conflicts and interfere with developer workflow. Developers prefer manual control over when formatting runs.

---

## Guidelines for Claude

### When to Propose a Rule
✅ **DO propose** when:
- Same error pattern occurs 3+ times
- Pattern is project-specific (not generic best practice)
- Rule would prevent recurring mistakes
- Rule fills a gap in current documentation

❌ **DON'T propose** when:
- Issue only occurred once or twice
- Issue is covered in existing documentation
- Issue is user-specific (not systemic)
- Issue is due to external factors (API changes, library bugs)

### How to Write Good Proposals
1. **Be specific**: Exact error messages, line numbers, code snippets
2. **Show evidence**: Link to 3+ real occurrences with dates
3. **Provide solution**: Ready-to-use rule text, not vague suggestions
4. **Explain impact**: Both benefits and potential drawbacks
5. **Suggest location**: Where in CLAUDE.md this fits best

### Severity Levels
- **Low**: Nice-to-have, improves consistency
- **Medium**: Prevents errors, saves time
- **High**: Prevents data corruption or security issues
- **Critical**: Prevents production outages or data loss

---

## Statistics

**Total Proposals**: 1
**Approved**: 1
**Rejected**: 0
**Pending**: 0

**Success Rate**: 100% (approved / total)

---

*Last Updated: 2026-01-14*
*This file is part of the self-evolution protocol to keep CLAUDE.md lean and accurate*
