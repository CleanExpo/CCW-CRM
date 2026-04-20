# Implementation Plan

**Session:** 691150a16381  
**Confidence:** 55%

**Risk notes:** Exact file path of the Linear script is unknown — lessons learned reference _fetch_states/_fetch_labels/_gql/_create_state but the repo manifest does not name the file explicitly. Unit 1 performs discovery; all downstream units assume the file found there. If the script lives outside scripts/ (e.g. inside .claude/skills/ or briefs/) the file list in units 2-5 must be updated accordingly. The bug description is inferred entirely from the lessons-learned fields (completeness 6/10, correctness 6/10) since no explicit bug report was provided in the brief — confidence is lowered to reflect this ambiguity.

## Unit 1: Locate Linear setup/sync script with truncated main and missing GraphQL error checks
**Files:** `scripts/linear_setup.py`, `apps/backend/src/integrations/linear.py`, `apps/backend/src/scripts/linear_setup.py`
**Test scenarios:**
  - happy path: glob/grep for _fetch_states, _fetch_labels, _gql, _create_state to find exact file path
  - edge case: script may live under .claude/skills/ or briefs/ directory

## Unit 2: Add GraphQL error-key checking to _fetch_states
**Files:** `scripts/linear_setup.py`
**Test scenarios:**
  - happy path: response with no 'errors' key proceeds normally and returns state list
  - edge case: response containing 'errors' key raises RuntimeError with message body
  - edge case: network/HTTP error still propagates correctly

## Unit 3: Add GraphQL error-key checking to _fetch_labels
**Files:** `scripts/linear_setup.py`
**Test scenarios:**
  - happy path: response with no 'errors' key proceeds and returns label list
  - edge case: response containing 'errors' key raises RuntimeError with message body
  - edge case: empty label list returned without error does not raise

## Unit 4: Complete truncated main() function with full error handling
**Files:** `scripts/linear_setup.py`
**Test scenarios:**
  - happy path: main() runs all 4 status creations and 7 label creations without exception
  - edge case: any _create_state/_create_label failure is caught, logged, and re-raised cleanly
  - edge case: missing API token env var exits with clear message before making any requests

## Unit 5: Run py_compile and ruff checks on patched script
**Files:** `scripts/linear_setup.py`
**Test scenarios:**
  - happy path: py_compile emits no SyntaxError
  - happy path: ruff reports zero violations

## Unit 6: Commit fix with conventional message
**Files:** `scripts/linear_setup.py`
