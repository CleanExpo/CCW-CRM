# SKILL: Receive and Act on Code Review (UNI-1742)

**When to use**: When the Review Orchestrator has returned findings and you need to act on them.

## Interpreting Verdicts

### SHIP ✅

No action needed. Proceed to create PR.

### NEEDS_WORK ⚠️

HIGH severity findings must be fixed. Process:

1. Read each finding carefully — do NOT dismiss without understanding
2. For each HIGH finding:
   - Fix the issue at the specified file:line
   - Run the relevant test to verify fix
3. For MEDIUM findings — fix if < 30 minutes work, otherwise document in PR
4. Re-request review: `@review-orchestrator re-review after fixes`
5. Do NOT proceed to PR until you get SHIP

### BLOCK 🚫

CRITICAL findings. Process:

1. **STOP** — do not push, do not create PR
2. Read the CRITICAL finding carefully
3. If it's a security issue (RLS bypass, hardcoded secret, injection):
   - Fix immediately, it's always top priority
4. If it requires architecture change:
   - Inform Phill before proceeding
   - Document the issue and proposed fix
5. Only re-request review after full fix

## Common Findings and Fixes

| Finding                  | Fix                                                      |
| ------------------------ | -------------------------------------------------------- |
| Hardcoded API key        | Move to env var, add to SECRETS.md                       |
| Missing RLS on new table | Add `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` migration |
| `any` TypeScript type    | Replace with proper type or `unknown` + type guard       |
| N+1 query                | Use `.in()` batch query or JOIN                          |
| Missing test             | Add test file in `tests/` matching source path           |
| Cross-layer import       | Move shared code to a proper shared layer                |

## Notes

- All CRITICAL findings are non-negotiable — they must be fixed
- "I'll fix it later" is not acceptable for HIGH/CRITICAL findings
- If you disagree with a finding, explain why in a comment and ask Phill to decide
