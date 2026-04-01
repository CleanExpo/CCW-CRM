# Customer Service Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: Customer Service Representative
**Daily Modules**: Customers, Contacts, Service Requests, Submissions, Activities, Staff Copilot (AI)

---

## Your Daily Workflow

```
1. Check unresolved service requests and submissions
2. Search for customer profile before any interaction
3. Review activity timeline for context on the customer
4. Log new service requests or enquiries
5. Monitor customer health scores for at-risk accounts
6. Use Staff Copilot AI for response drafts and escalation guidance
```

---

## Step 1: Getting Oriented (3 min)

### Key modules for customer service
| Module | URL | Purpose |
|---|---|---|
| Customers | `/customers` | Master customer database |
| Contacts | `/contacts` | Individual contact records |
| Service Requests | `/service-requests` | Customer support tickets |
| Submissions | `/submissions` | Web form submissions / enquiries |
| Activities | `/activities` | All logged interactions |
| Customer Health | `/customers/health` | At-risk account dashboard |
| AI Assistant | `/ai-assistant` | General AI chat |

### Start each day here
1. Open `/service-requests` — check for unresolved or new tickets
2. Open `/submissions` — check for new web form enquiries overnight
3. Scan `/customers/health` for any accounts flagged as at-risk

---

## Step 2: Customer Search and Profile View (7 min)

### Search for a customer
1. Navigate to `/customers`
2. Use the search bar to search by:
   - Company name (partial match works: "Clean" finds "Clean Sweep Solutions")
   - Contact name
   - Email address
   - Customer number (format: CCW-NNN)
3. Click the customer row to open their profile at `/customers/[id]`

### What the customer profile shows
- **Contact details** — phone, email, billing address
- **Account status** — active, inactive
- **Customer since** — tenure date
- **Total orders** — lifetime order count and value
- **Activity Timeline** — every interaction logged: calls, emails, orders, quotes, notes

### Finding a contact (individual person)
If you need to find a specific person (not the company):
1. Navigate to `/contacts`
2. Search by name or email
3. Click the contact to open their detail page at `/contacts/[id]`
4. The contact detail shows: their company, role, all activities linked to them specifically

---

## Step 3: Viewing the Activity Timeline (5 min)

The Activity Timeline is the single most important tool for customer service — it gives you the full history before picking up the phone.

### Access the timeline
1. Open a customer profile at `/customers/[id]`
2. Scroll to the **Activity Timeline** section
3. The timeline shows all events in reverse chronological order

### Types of events in the timeline
| Event Type | What it means |
|---|---|
| Order Created | A new order was placed |
| Quote Sent | A quote was delivered to the customer |
| Invoice Sent | Invoice has been issued |
| Payment Received | Payment was recorded |
| Service Request | A support ticket was raised |
| Note Added | Manual note logged by staff |
| Call Logged | Phone call recorded |
| Email Sent | Email communication recorded |

### Add a note to the timeline
1. On the customer profile, find the **Add Note** button in the Activity Timeline section
2. Type your note (e.g. "Customer called about delayed delivery on ORD-2026-042")
3. Click **Save** — the note appears at the top of the timeline immediately

---

## Step 4: Creating a Service Request (5 min)

Service requests track customer issues, complaints, warranty claims, and support queries.

### Create a new service request
1. Navigate to `/service-requests`
2. Click **+ New Service Request**
3. Fill in:
   - **Customer** — search and select the customer
   - **Contact** — the specific person who raised the issue (optional)
   - **Subject** — brief title (e.g. "Machine not turning on after delivery")
   - **Description** — full details of the issue
   - **Priority** — Low / Medium / High / Urgent
   - **Type** — Warranty / Repair / Enquiry / Complaint / Other
   - **Linked Order** — reference the order the issue relates to (optional)
4. Click **Create**

### Service request statuses
| Status | Meaning |
|---|---|
| Open | Newly created, unassigned |
| In Progress | Assigned and being worked on |
| Pending Customer | Waiting for customer response |
| Escalated | Raised to management/workshop |
| Resolved | Issue fixed, closed |
| Closed | Archived |

### Update a service request
1. Click the service request row to open it
2. Change status, add internal notes, attach files, or link to a workshop booking
3. All changes are time-stamped for audit trail

---

## Step 5: Managing Submissions and Enquiries (5 min)

### What are submissions?
Submissions are enquiries received through the website contact form or other intake channels. They appear in `/submissions` as raw leads or support requests not yet assigned to a customer.

### Process a submission
1. Navigate to `/submissions`
2. New/unprocessed submissions appear at the top (status: New)
3. Click a submission to review the content
4. Actions available:
   - **Convert to Customer** — creates a new customer record from the submission data
   - **Link to Existing Customer** — associates submission with an existing customer
   - **Create Service Request** — turns the submission into a tracked support ticket
   - **Mark Resolved** — close without further action (e.g. spam)
5. Add a response note before marking resolved

---

## Step 6: Customer Health Monitoring (5 min)

The Customer Health dashboard identifies accounts at risk of churning or needing proactive outreach.

### View the health dashboard
1. Navigate to `/customers/health`
2. Accounts are scored and displayed in tiers:
   - **Healthy** (green) — active, recent purchases, good payment history
   - **At Risk** (amber) — declining order frequency or overdue invoices
   - **Critical** (red) — no activity in 90+ days or significant outstanding debt

### Health score factors
The score is calculated from:
- Days since last order
- Total outstanding invoice value
- Number of open service requests
- Payment history (on-time vs. late)

### Respond to an at-risk account
1. Click any at-risk customer row to open their profile
2. Review the activity timeline for context
3. Assign a follow-up task or create an outreach note
4. Use Staff Copilot (below) to draft the outreach message

---

## Quick Reference

| Task | Where | Action |
|---|---|---|
| Search customers | `/customers` | Search bar |
| Customer profile | `/customers/[id]` | Click customer row |
| Contact detail | `/contacts/[id]` | Click contact row |
| Activity timeline | `/customers/[id]` | Scroll to timeline section |
| Add note | `/customers/[id]` | Add Note button in timeline |
| New service request | `/service-requests` | + New Service Request |
| View submissions | `/submissions` | Sidebar: Submissions |
| Customer health | `/customers/health` | Sidebar: Customer Health |
| Onboarding status | `/customers/onboarding` | Sidebar: Onboarding |
| Customer personas | `/customers/personas` | Sidebar: Personas |
| AI Staff Copilot | Integrated, via AI Assistant | `/ai-assistant` |

---

## AI Features for Customer Service

### Staff Copilot
The Staff Copilot is your most powerful tool. It is accessible via `/ai-assistant` and provides context-aware support for customer service scenarios.

**What it can do**:
- Draft reply emails to customer complaints
- Suggest resolution steps for common issues
- Summarise a customer's history before a call
- Recommend escalation paths for complex cases
- Generate service request descriptions from rough notes

**How to use it**:
1. Navigate to `/ai-assistant`
2. Describe the situation in plain language, e.g.:
   - "Customer is upset about a delayed delivery on order ORD-2026-088. Draft a professional apology email."
   - "Give me a summary of everything that has happened with customer ABC Cleaning in the last 3 months."
   - "What should I do if a customer's warranty claim is for a machine they modified themselves?"
3. The copilot responds with a draft or recommendation you can review and use

| AI Feature | Location | Use case |
|---|---|---|
| Staff Copilot | `/ai-assistant` | Draft emails, summarise customer history, guide escalations |
| AI Assistant | `/ai-assistant` | General queries about products, policies, process |
| Customer Health AI | `/customers/health` | AI-scored health dashboard with churn risk signals |
| Anomaly Detection | `/alerts` | Flags customers with unusual activity patterns |

**Pro tip**: Before any difficult customer call, paste the customer's name into the AI Assistant and ask for a plain-English summary of their account. It will give you order history, open issues, and payment status in 30 seconds — so you walk into the conversation prepared.
