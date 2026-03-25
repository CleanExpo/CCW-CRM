# System Administrator Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: System Administrator
**Daily Modules**: Settings, Integrations, Monitoring, Alerts, Approvals, Agents, Workflows

---

## Your Daily Workflow

```
1. Check Monitoring dashboard and Alerts
2. Review pending Approvals
3. Verify integration sync statuses (Cin7, Xero, Shopify)
4. Check Agent health dashboard
5. Manage workflows and approval templates as needed
6. Handle user or settings changes
```

---

## Step 1: Getting Oriented — Admin Modules (3 min)

### Admin-relevant sidebar sections
| Module | URL | Purpose |
|---|---|---|
| Monitoring | `/monitoring` | System health, API uptime, errors |
| Alerts | `/alerts` | Active alerts requiring action |
| Approvals | `/approvals` | Approval queue and workflow management |
| Workflows | `/workflows` | Workflow template builder |
| Agents | `/agents` | AI agent health and status |
| Settings | `/settings/integrations` | All third-party integrations |
| Settings: Team | `/settings/team` | User and role management |
| Settings: Company | `/settings/company` | Organisation details |
| Settings: Account | `/settings/account` | Personal account settings |

---

## Step 2: Integrations Settings (10 min)

### Access the integrations hub
1. Navigate to `/settings/integrations`
2. The page shows integration cards for all connected services:
   - **Cin7** (inventory/product sync)
   - **Xero** (accounting/invoicing sync)
   - **Shopify** (e-commerce)
   - **AP2** (payment processing)
   - **Marketplace** (eBay, Facebook Marketplace)

### Cin7 integration
1. On the Cin7 card, the status shows: Connected / Disconnected / Demo Mode
2. **Demo Mode** — uses mock data; no real API calls. Safe for testing.
3. **Live Mode** — connects to your actual Cin7 account
4. Click **Configure** to view/update API credentials (API key, account ID)
5. The **Last Sync** timestamp shows when data was last pulled from Cin7
6. Click **Trigger Sync** to force an immediate sync of products, stock, and orders

**Cin7 sub-pages in settings**:
- `/settings/integrations/shadow` — Shadow inventory transition view (Cin7 ↔ ERP reconciliation)
- `/settings/integrations/gl` — General Ledger mapping (Cin7 accounts → Xero chart of accounts)

### Xero integration
1. On the Xero card, click **Connect Xero** if not yet connected
2. You are redirected to Xero's OAuth screen — log in and grant access
3. After connecting: invoices, payments, and customers sync automatically
4. If connection drops (token expiry), click **Reconnect** to re-authorise

### Shopify integration
1. On the Shopify card, enter your Shopify store URL and Admin API token
2. Enable the sync types: Products / Inventory / Orders
3. Marketplace integrations (eBay, Facebook Marketplace) are at `/settings/integrations/marketplace`

### AP2 (payment gateway)
1. Navigate to `/settings/integrations/ap2`
2. Enter AP2 API credentials (Merchant ID, API key)
3. AP2 handles payment mandates and direct debit transactions

---

## Step 3: Approval Workflow Templates (7 min)

### Understanding approvals
Approvals control which actions require sign-off before proceeding — e.g. a purchase order over $10,000 needs manager approval before it is sent to the supplier.

### View current approval queue
1. Navigate to `/approvals`
2. The page shows pending approvals grouped by type (Purchase Orders, Quotes, Invoices, etc.)
3. Each approval item shows: what is being approved, who submitted it, the value, and current status
4. Expand an item to see the full approval chain (e.g. Step 1: Line Manager → Step 2: Finance Director)

### Approve or reject an item (as an approver)
1. Click the approval item to expand it
2. Review the details
3. Click **Approve** or **Reject**
4. Add a comment if rejecting (required) or if approving with conditions
5. The submitter is notified automatically

### Create a workflow/approval template
Approval templates are managed in the Workflows module:
1. Navigate to `/workflows`
2. Click **+ New Workflow Template**
3. Fill in:
   - **Workflow Name** — e.g. "Purchase Order > $5,000 Approval"
   - **Trigger** — what action triggers this workflow (Purchase Order Created, Quote Accepted, etc.)
   - **Condition** — optional filter (e.g. only trigger if amount > 5000)
   - **Steps** — add approval steps in sequence:
     - Step 1: Approver role (e.g. Line Manager)
     - Step 2: Approver role (e.g. Finance Director)
   - **SLA** — how many hours each step has before escalation
4. Click **Save Template** to activate

### SLA escalation
If an approver does not act within the SLA window, the system:
1. Sends a reminder notification
2. Escalates to the next approver in the chain if still unactioned after a second timeout
3. Logs the escalation in the approval's audit trail

---

## Step 4: Monitoring and Alerts (5 min)

### Monitoring dashboard
1. Navigate to `/monitoring`
2. The monitoring page shows:
   - **API uptime** — backend service availability
   - **Error rate** — API errors per minute
   - **Database performance** — query latency
   - **Integration health** — each integration's last successful call
   - **Background job status** — scheduled jobs (cron, sync) and their last run times

### Alerts
1. Navigate to `/alerts`
2. Alerts are triggered automatically by:
   - System errors (5xx responses above threshold)
   - Integration failures (Cin7 sync failed)
   - Anomaly detection (unusual stock movements, payment patterns)
   - SLA breaches (approval not actioned in time)
3. For each alert:
   - **Acknowledge** — marks you have seen it; stops repeat notifications
   - **Resolve** — marks the issue as fixed
4. Resolved alerts are archived but not deleted (audit trail)

---

## Step 5: Agent Dashboard (3 min)

### What are agents?
The system includes AI agents that run automated tasks: inventory forecasting, anomaly detection, staff copilot, and marketing content generation.

### Monitor agent health
1. Navigate to `/agents`
2. The Agents page shows all registered agents with:
   - **Status** — Idle / Running / Error / Offline
   - **Last Run** — timestamp of last execution
   - **Task Count** — number of tasks processed
   - **Health** — green/amber/red indicator
3. Click an agent to see its full task history and any error logs

### If an agent shows Error or Offline
1. Click the agent to view the error details
2. Common causes: missing API key, downstream service unavailable, model rate limit
3. Check `/settings` → ensure API keys for the relevant provider (OpenAI, Google) are set
4. Restart the agent using the **Restart** button if the underlying issue is resolved

---

## Step 6: User Management Concepts (2 min)

### Team management
1. Navigate to `/settings/team`
2. View all users in your organisation
3. From here you can:
   - Invite new users (sends email invitation)
   - Deactivate users who have left
   - View user roles (Admin, Manager, Staff, Read-Only)

### Role access levels (conceptual)
| Role | What they can do |
|---|---|
| Admin | Full access including settings, integrations, user management |
| Manager | Full CRUD on all modules; approvals; no settings changes |
| Staff | CRUD on their assigned modules; cannot access settings |
| Read-Only | View only; no create/edit/delete |

### User access is currently managed via Supabase Auth
For production user management (creating users, resetting passwords, assigning roles), use the Supabase dashboard at your project URL. Role assignments are stored in the `users` table under `role`.

---

## Quick Reference

| Task | Where | Action |
|---|---|---|
| System monitoring | `/monitoring` | Sidebar: Monitoring |
| View alerts | `/alerts` | Sidebar: Alerts |
| Approve requests | `/approvals` | Expand item → Approve/Reject |
| Build workflow template | `/workflows` | + New Workflow Template |
| Cin7 integration | `/settings/integrations` | Cin7 card |
| Xero integration | `/settings/integrations` | Xero card → Connect/Reconnect |
| Shopify/Marketplace | `/settings/integrations/marketplace` | Marketplace card |
| AP2 payments | `/settings/integrations/ap2` | AP2 card |
| GL mapping (Cin7→Xero) | `/settings/integrations/gl` | GL Integration page |
| Shadow inventory | `/settings/integrations/shadow` | Shadow tab |
| Agent health | `/agents` | Sidebar: Agents |
| Team / users | `/settings/team` | Settings: Team |
| Company settings | `/settings/company` | Settings: Company |

---

## AI Features for Administrators

| Feature | Location | How to use |
|---|---|---|
| Agent Dashboard | `/agents` | Monitor all AI agents; view task logs; restart stuck agents |
| Anomaly Detection | `/alerts` | Auto-flagged anomalies from AI monitoring |
| AI Assistant | `/ai-assistant` | Ask system questions: "Which integrations have failed in the last 24 hours?" |
| Autonomous Dev | `/autonomous` | Advanced: AI-assisted system configuration (use with caution) |

**Pro tip**: Set up a daily habit of checking `/monitoring` at 8am and `/alerts` at 8:05am. Most integration failures occur overnight during scheduled syncs. Catching them at the start of day prevents staff from hitting errors during business hours.
