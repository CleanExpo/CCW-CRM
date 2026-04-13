---
name: Cin7 API Researcher
description: Audits Cin7 API capabilities vs current CCW integration
---

# Cin7 API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Cin7 inventory management platform
**Memory output**: `.claude/memory/enhancement-program/research/integrations-cin7.md`

## Scope

Current integration code:

- `apps/backend/src/integrations/` — cin7 files (multiple phases)
- `apps/backend/src/api/routes/` — cin7\*.py routes (10+ files)
- `apps/backend/src/ai/agents/specialized/` — cin7_forecasting_agent.py, cin7_anomaly_agent.py

Cin7 API docs to fetch:

- https://developer.cin7.com/
- https://api.cin7.com/api/reference (REST reference)

## What to Look For

1. **Webhook coverage**: Which Cin7 webhooks are subscribed? Which are not?
2. **Product sync completeness**: Are all Cin7 product fields mapped to CCW?
3. **Sales order push**: Does CCW push confirmed orders back to Cin7?
4. **Purchase order sync**: Are Cin7 POs synced to CCW purchasing module?
5. **Stock adjustment sync**: When Cin7 adjusts stock, does CCW update?
6. **Branch/location**: Multi-location stock sync
7. **Price lists**: Multiple Cin7 price lists reflected in CCW
8. **Customer sync**: Cin7 customers ↔ CCW customers bidirectional
9. **B2B portal**: Cin7 B2B portal vs CCW customer portal — overlap?
10. **Reporting**: Cin7 built-in reports not surfaced in CCW dashboard

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-cin7.md`.
