# CCW Digital Operations Hub - Specification v2

## Current Status ✅
- Homepage + Dashboard working
- API routes: `/api/equipment` ✅, `/api/approvals` ✅
- Kanban + Approval UI functional

## 404 Errors to Fix
- `/dashboard/agents` - Missing agents management page
- `/dashboard/inventory` - Missing inventory page

---

## Phase 6: Dashboard Sub-Pages

### `/dashboard/agents`
Agent management interface:
- List all registered agents (Marketing Specialist, Service Orchestrator)
- Show agent status (idle/running)
- Manual trigger for agent workflows
- View agent conversation logs

### `/dashboard/inventory`
Inventory management:
- Real-time stock levels across Boondall, Seven Hills, Bayswater
- Low stock alerts (< 5 units)
- Product search and filter
- Integration with `check_warehouse_stock` tool

---

## Phase 7: Agent Execution Layer

### Agent Runner API
- `POST /api/agents/run` - Trigger agent with input
- `GET /api/agents/status/:id` - Check execution status
- WebSocket for real-time agent activity feed

### HITL Terminal Integration
- Approval CLI commands
- `ccw approve <id>` / `ccw reject <id>`

---

## Phase 8: Production Readiness
- [ ] Seed database with real CCW equipment
- [ ] Connect to actual inventory system
- [ ] Deploy to Cloud Run (australia-southeast1)
- [ ] Set up CI/CD pipeline

---

## Priority Next Steps
1. Create `/dashboard/agents` page
2. Create `/dashboard/inventory` page
3. Add agent execution API
