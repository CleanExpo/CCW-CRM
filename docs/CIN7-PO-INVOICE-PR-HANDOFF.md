# PR Handoff — fix(cin7): add missing PO and invoice event mappings

**Branch**: `fix/cin7-po-invoice-events`  
**Base**: `main`  
**Commit**: `7d8e3a6`

## What was fixed

Cin7 `purchase_order.*` and `invoice.*` webhook events were **silently dropped**
with a `"status": "ignored", "reason": "unknown_event_type"` response. Root cause:

1. `event_dispatcher.py` had no `CIN7_EVENT_PURCHASE_ORDER_CHANGED` or
   `CIN7_EVENT_INVOICE_CHANGED` constants, builder functions, or dispatch cases.
2. `cin7_webhooks.py` `CIN7_WEBHOOK_EVENT_MAP` had no entries for any PO or
   invoice webhook event types.

## Files changed

| File | Change |
|------|--------|
| `apps/backend/src/integrations/cin7/event_dispatcher.py` | Added 2 constants, 2 builder functions, 2 dispatch cases |
| `apps/backend/src/api/routes/integrations/cin7_webhooks.py` | Added 6 webhook event map entries + imports |
| `apps/backend/tests/integrations/cin7/__init__.py` | New (empty init) |
| `apps/backend/tests/integrations/cin7/test_event_dispatcher.py` | 30 new unit tests |

## New webhook types now handled

- `purchase_order.created` → `cin7.purchase_order.changed`
- `purchase_order.updated` → `cin7.purchase_order.changed`
- `purchase_order.received` → `cin7.purchase_order.changed`
- `invoice.created` → `cin7.invoice.changed`
- `invoice.updated` → `cin7.invoice.changed`
- `invoice.paid` → `cin7.invoice.changed`

## Verification checklist

**Where**: `POST /api/integrations/cin7/webhooks/receive`  
**How**: Send a JSON body with `{"event_type": "invoice.paid", "data": {...}}`  
**What to see**: `{"status": "accepted", "event_type": "invoice.paid", "internal_event": "cin7.invoice.changed"}`  
**What NOT to see**: `{"status": "ignored", "reason": "unknown_event_type"}`

Also: `GET /api/integrations/cin7/webhooks/status` should now list 14 supported
events (was 8).

## PowerShell push commands

```powershell
cd "C:\CCW-Online ERP"
git fetch origin
git checkout fix/cin7-po-invoice-events 2>$null || git checkout -b fix/cin7-po-invoice-events
git push -u origin fix/cin7-po-invoice-events
gh pr create --title "fix(cin7): add missing PO and invoice event mappings" --body "## Summary
- Add \`CIN7_EVENT_PURCHASE_ORDER_CHANGED\` and \`CIN7_EVENT_INVOICE_CHANGED\` event constants
- Wire \`purchase_order.{created,updated,received}\` and \`invoice.{created,updated,paid}\` into \`CIN7_WEBHOOK_EVENT_MAP\`
- Add \`build_purchase_order_event()\` and \`build_invoice_event()\` builder functions
- Add dispatch routing for \`purchase_order\` and \`invoice\` entity types in \`Cin7EventDispatcher\`
- 30 new unit tests (30/30 pass)

## Test plan
- [ ] \`GET /api/integrations/cin7/webhooks/status\` → 14 supported_events (was 8)
- [ ] \`POST /api/integrations/cin7/webhooks/receive\` with \`event_type: invoice.paid\` → \`status: accepted\`
- [ ] \`POST /api/integrations/cin7/webhooks/receive\` with \`event_type: purchase_order.created\` → \`status: accepted\`
- [ ] \`POST /api/integrations/cin7/webhooks/test?event_type=invoice.paid\` → \`status: sent\`
- [ ] \`cd apps/backend && pytest tests/integrations/cin7/ -v\` → 30 passed

🤖 Generated with [Claude Code](https://claude.com/claude-code)" --base main
```

## Test run output (sandbox)

```
30 passed in 0.42s
```
