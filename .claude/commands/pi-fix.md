# /pi-fix — Route Specific Gap Fix Through Agent Pipeline

Takes a specific gap and routes it through: Orchestrator → Planner → Coder pipeline.

## Pipeline

1. **Orchestrator** (this agent): Identifies the gap, loads context from catalogs
2. **Planner**: Creates implementation plan (using /plan template)
3. **Coder**: Implements the fix following the plan
4. **Health Check**: Runs relevant checks from /health-check-10x

## Supported Gap Types

- `frontend-page`: Create missing frontend page (reads backend route shape)
- `register-router`: Register unregistered route in main.py
- `api-client`: Create missing TypeScript API client
- `sidebar-nav`: Add missing nav item to sidebar
- `agent-skill`: Add/document missing agent skill

## Usage

/pi-fix [gap-type] [target]

## Examples

/pi-fix frontend-page contractors
/pi-fix register-router cron_jobs
/pi-fix api-client bank-feeds
/pi-fix sidebar-nav contractors

## Steps Per Gap Type

### frontend-page [name]:

1. Read docs/catalogs/ROUTES.md for [name] route shape
2. Read existing similar page as template (e.g., products/page.tsx)
3. Create: page.tsx, Form.tsx, DeleteDialog.tsx, types.ts, lib/api/[name].ts
4. Add to sidebar if missing
5. Run Check 2 + Check 3 from health-check-10x
