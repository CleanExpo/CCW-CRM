# /pi-issues — Sync PRD Items to Linear via Browser Automation

Takes PRD from /pi-prd and creates Linear issues via browser automation.

## Prerequisites

- PRD exists in docs/PRD-CCW-GAPS-[date].md
- User is logged into Linear in browser (linear.app)
- User has confirmed team and project to use

## Steps

1. Read most recent docs/PRD-CCW-GAPS-\*.md
2. Extract all issues with: title, description, priority, effort
3. Use browser automation (mcp**claude-in-chrome**\*) to:
   - Navigate to linear.app
   - Create issues one by one
   - Apply labels: gap, domain, priority
4. Document created issue IDs in decisions-log.md

## IMPORTANT

- Always ask user to confirm Linear project/team before creating issues
- Show issue list first, ask "Create these N issues?" before proceeding
- This uses browser automation — requires Chrome extension active

## Usage

/pi-issues [optional: Linear project ID]
