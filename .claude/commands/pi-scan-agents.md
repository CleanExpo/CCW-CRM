# /pi-scan-agents — Scan and Catalog All AI Agents

Reads all AI agent files and updates docs/catalogs/AGENTS.md.
Checks 1:10 skill compliance per agent.

## Steps

1. Scan apps/backend/src/ai/agents/ (all directories) for agent files
2. For each agent: extract class name, BaseAgent inheritance, skills/methods, API route
3. Check docs/catalogs/ROUTES.md for agent's API route
4. Count documented skills — flag if not exactly 10
5. Update docs/catalogs/AGENTS.md

## Output Format

```
### AGENT-NNN: [AgentName]
- **File**: apps/backend/src/ai/agents/[path]/[file].py
- **Class**: [ClassName]
- **Domain**: [domain]
- **BaseAgent**: Yes/No
- **API Route**: /api/ai/[endpoint] (ROUTE-NNN)
- **Skills Count**: [N] (target: 10)
- **Skills**: [skill1, skill2, ...]
- **1:10 Compliant**: Yes/No/Partial
- **Status**: Active/Partial/Planned/Blocked
- **Last Verified**: [date]
```

## 1:10 Compliance Check

Flag agents with != 10 documented skills as NON-COMPLIANT.

## Usage

/pi-scan-agents
