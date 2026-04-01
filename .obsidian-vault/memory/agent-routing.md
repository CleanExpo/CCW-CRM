# Agent Routing Reference — v1.0

# Updated: 2026-03-03

## Domain Agent → Skill Mapping

| Agent                | Domain                | Backend File                  | Skills Count | Status             |
| -------------------- | --------------------- | ----------------------------- | ------------ | ------------------ |
| Inventory Agent      | Stock & Warehouse     | cin7_forecasting_agent.py     | 10           | Partial            |
| CRM Agent            | Customers & Contacts  | recommendation_agent.py       | 10           | Partial            |
| Orders Agent         | Sales & Fulfillment   | pricing_agent.py              | 10           | Partial            |
| Financial Agent      | Accounting & Payments | reconciliation_agent.py       | 10           | Partial            |
| Integration Agent    | External Systems      | NEW                           | 10           | Planned            |
| Content Agent        | SEO & Marketing       | content_generator.py          | 10           | Partial            |
| Analytics Agent      | Insights & Reporting  | cin7_anomaly_agent.py         | 10           | Partial            |
| Infrastructure Agent | System & DevOps       | NEW                           | 10           | Planned            |
| Search Agent         | Discovery             | search_agent.py               | 10           | BLOCKED (pgvector) |
| Project Intelligence | Meta/Audit/PRD        | project_intelligence_agent.py | 10           | Active             |

## Routing Rules

### By Task Type:

- **Inventory queries** → Inventory Agent
- **Customer/CRM** → CRM Agent
- **Order management** → Orders Agent
- **Financial/Xero/payments** → Financial Agent
- **External API integrations** → Integration Agent
- **SEO/content/marketing** → Content Agent
- **Reports/KPIs/analytics** → Analytics Agent
- **System health/deployment** → Infrastructure Agent
- **Search/discovery** → Search Agent (BLOCKED)
- **Codebase audit/PRD/gaps** → Project Intelligence Agent

### By Domain:

- **Routes & API endpoints** → pi-scan-routes + ROUTES catalog
- **Frontend pages** → pi-scan-pages + PAGES catalog
- **AI agents** → pi-scan-agents + AGENTS catalog
- **Packages/dependencies** → pi-scan-packages + PACKAGES catalog
- **DB models** → MODELS catalog
- **Integrations** → INTEGRATIONS catalog

## Token Budget

| Agent Role           | Model  | Max Session Tokens     |
| -------------------- | ------ | ---------------------- |
| Orchestrator         | Opus   | < 80K (compact at 70%) |
| Project Intelligence | Sonnet | < 40K                  |
| Domain Specialists   | Sonnet | < 60K per invocation   |
| Search Agent         | Sonnet | < 40K (blocked)        |
