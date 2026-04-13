---
name: Shipping & Stock Ordering Researcher
description: Audits the shipping/stock ordering platform integration (Starshipit or confirmed platform)
---

# Shipping & Stock Ordering Researcher

**Model**: claude-sonnet-4-6
**Domain**: Shipping and stock ordering platform (TBD — likely Starshipit or Shippit)
**Memory output**: `.claude/memory/enhancement-program/research/integrations-shipping.md`

## Platform Identification

First, determine which platform CCW uses:

1. Check `apps/backend/src/integrations/` for any shipping-related files
2. Check `apps/backend/src/api/routes/shipments.py` for any platform references
3. Search codebase: `grep -r "starshipit\|shippit\|auspost\|fastway\|couriers please" apps/`

If platform confirmed: fetch their developer docs.
If not confirmed: document as "Platform TBD" and note in findings that Phill needs to confirm.

## Starshipit docs (if confirmed):

- https://developers.starshipit.com/

## Shippit docs (if Shippit):

- https://developer.shippit.com/

## What to Look For

1. **Carrier integration**: Which carriers are supported? (AusPost, StarTrack, TNT, Toll, etc.)
2. **Label generation**: Auto-generate shipping labels from CCW dispatch
3. **Rate shopping**: Compare carrier rates at point of dispatch
4. **Tracking sync**: Real-time tracking events pushed to CCW shipments
5. **Customer notifications**: Auto SMS/email to customer with tracking link
6. **Returns portal**: Pre-paid return labels
7. **Address validation**: AU address validation at order entry
8. **Dangerous goods**: Dangerous goods declaration for cleaning chemicals
9. **Stock ordering**: If platform has stock ordering features, document them
10. **Reporting**: Freight cost reporting, carrier performance

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-shipping.md`.
Note platform name at top of file.
