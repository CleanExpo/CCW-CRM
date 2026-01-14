# CCW Digital Operations Hub

## Project Context
- **Project ID**: CCW-DOH-2026
- **Version**: 1.0.0-agentic
- **Business**: 100% Australian-owned cleaning equipment supplier
- **Hubs**: QLD (Boondall), NSW (Seven Hills), VIC (Bayswater)

## Rules
1. **Brand**: Always use CCW Navy (#003366) and Gold (#FFCC00)
2. **Context**: CCW is 100% Australian-owned with hubs in QLD, NSW, and VIC
3. **Architecture**: Use `@openai/agents` for multi-agent loops and `zod` for validation
4. **Constraint**: Never modify tests without permission. Prefer small, atomic diffs

## Commands
```bash
# Build
npm run build

# Test
npm test

# Deploy
gcloud run deploy ccw-hub --region australia-southeast1
```

## Agent Framework
Using `@openai/agents` (OpenAI Agents JS SDK).

### Agents
- **Marketing Strategist** → hands off to Copywriter, Visual Brand
- **Service Orchestrator** → manages Truckmount/Razorback repairs

### HITL (Human-in-the-Loop)
Sensitive actions require terminal confirmation:
- `publish_ad`
- `delete_inventory_record`
- `change_repair_status`

## Warehouse Locations
| Code | Location | State |
|------|----------|-------|
| Boondall | Brisbane | QLD |
| Seven Hills | Sydney | NSW |
| Bayswater | Melbourne | VIC |

## Key Directories
```
apps/web/src/agents/    # Agent definitions
apps/web/src/skills/    # Tool implementations
apps/web/src/components/ # UI components
```
