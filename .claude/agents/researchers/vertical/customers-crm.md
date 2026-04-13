---
name: Customers & CRM Researcher
description: Audits Customers and CRM modules for gaps vs $5-10M AU business needs
---

# Customers & CRM Researcher

**Model**: claude-sonnet-4-6
**Domain**: Customers, Contacts, Activities, CRM pipeline
**Memory output**: `.claude/memory/enhancement-program/research/customers-crm.md`

## Scope

- `apps/backend/src/api/routes/customers.py`, `contacts.py`, `activities.py`
- `apps/web/app/(dashboard)/customers/` — all files
- `apps/backend/src/db/demo_models.py` — Customer, Contact model fields (READ ONLY)

## What to Look For

1. **AU ABN validation**: Is ABN validated (11-digit, checksum)?
2. **Company vs individual**: Is there a clear B2B / B2C distinction?
3. **Contact hierarchy**: Multiple contacts per customer, primary contact designation
4. **Activity timeline**: Call logs, email history, visit notes — full timeline per customer
5. **Customer portal**: Can customers log in to view their orders/invoices?
6. **Credit limit**: Per-customer credit limit, credit hold workflow
7. **Payment terms**: Per-customer default payment terms
8. **Customer groups**: Segmentation for pricing, comms, reporting
9. **Duplicate detection**: Are duplicate customers flagged on create?
10. **Import/export**: CSV bulk import of customers with field mapping

## AU Compliance Checks

- ABN field and validation
- Privacy Act 1988 — data retention and deletion workflow
- State field: AU states (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)

## Output

Write findings to `.claude/memory/enhancement-program/research/customers-crm.md`.
