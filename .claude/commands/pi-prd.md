# /pi-prd — Generate PRD from Gap Analysis Findings

Takes priority matrix from /pi-prioritize and generates a structured PRD.
Saves to docs/PRD-CCW-GAPS-[date].md

## Steps

1. Read /pi-prioritize output (or run it first)
2. Group gaps by epic/domain
3. Generate PRD with: overview, epics, user stories, acceptance criteria
4. Save to docs/PRD-CCW-GAPS-[date].md

## PRD Format

```markdown
# PRD: CCW ERP Gap Resolution — [Date]

## Executive Summary

[2-3 sentences on scope and priority]

## Epic 1: [Domain] — [N gaps]

### [Gap Name]

- **User Story**: As a [role], I need [feature] so that [outcome]
- **Acceptance Criteria**:
  - [ ] [criterion 1]
  - [ ] [criterion 2]
- **Priority Score**: [N]
- **Effort**: [Xh]

## Implementation Sequence

[Ranked list of all gaps]
```

## Usage

/pi-prd [optional: custom title]
