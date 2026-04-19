# Implementation Plan

**Session:** 0a63492ea7b0  
**Confidence:** 45%

**Risk notes:** Brief does not specify the exact bug — assumed from lessons-learned that the failure is: (1) equipment-calculator-storm.ts was never created, and (2) equipment-calculator.ts is missing HEPA vacuum and large dehumidifier entries and does not guard against negative quantity inputs. Actual file paths under apps/web/lib/ are assumed; if files live elsewhere (e.g. apps/web/src/lib/) the Glob/Read step in Unit 1 will surface the correct paths before any edits. If the bug is unrelated to these calculator files, confidence drops further and Unit 1 must redirect the plan.

## Unit 1: Reproduce & Diagnose: Locate equipment-calculator files and identify missing/broken logic
**Files:** `apps/web/lib/equipment-calculator.ts`, `apps/web/lib/equipment-calculator-storm.ts`
**Test scenarios:**
  - happy path: equipment-calculator.ts exports all required calculation functions without TypeScript errors
  - edge case: negative quantity inputs are clamped or rejected rather than producing negative cost totals
  - edge case: HEPA vacuum line item is present in storm-mode output
  - edge case: large dehumidifier variant is correctly distinguished from standard dehumidifier

## Unit 2: Fix: Create apps/web/lib/equipment-calculator-storm.ts with storm-specific equipment logic
**Files:** `apps/web/lib/equipment-calculator-storm.ts`
**Test scenarios:**
  - happy path: storm calculator returns line items including HEPA vacuum and large dehumidifier
  - edge case: zero-quantity items are excluded from output
  - edge case: negative input values are coerced to 0 before calculation

## Unit 3: Fix: Patch apps/web/lib/equipment-calculator.ts — add HEPA vacuum, large dehumidifier entries, guard against negative values
**Files:** `apps/web/lib/equipment-calculator.ts`
**Test scenarios:**
  - happy path: calculateEquipment() returns correct totals for standard restoration job
  - edge case: HEPA vacuum quantity of 0 does not appear in output line items
  - edge case: negative area/quantity inputs return 0 rather than negative cost
  - edge case: large dehumidifier is billed at the correct rate distinct from standard dehumidifier

## Unit 4: Verify: Run type-check and affected unit tests
**Files:** `apps/web/lib/equipment-calculator.ts`, `apps/web/lib/equipment-calculator-storm.ts`
**Test scenarios:**
  - happy path: pnpm turbo run type-check exits 0 with no errors
  - happy path: vitest tests for equipment-calculator pass without regressions

## Unit 5: Commit: Stage and commit fix with conventional commit message
**Files:** `apps/web/lib/equipment-calculator.ts`, `apps/web/lib/equipment-calculator-storm.ts`
