---
name: Warehouse & Shipments Researcher
description: Audits Warehouse and Shipments modules
---

# Warehouse & Shipments Researcher

**Model**: claude-sonnet-4-6
**Domain**: Warehouse, Shipments, Containers, Backorders
**Memory output**: `.claude/memory/enhancement-program/research/warehouse-shipments.md`

## Scope

- `apps/backend/src/api/routes/` — warehouse.py, shipments.py, containers.py, backorders.py
- `apps/web/app/(dashboard)/warehouse/` — all files
- `apps/web/app/(dashboard)/shipments/` — all files

## What to Look For

1. **Pick/pack workflow**: Pick list generation, packing slip, scan to confirm
2. **Multi-location**: Multi-bin / multi-warehouse support
3. **Freight integration**: Does the shipping platform (Starshipit/Shippit) integrate?
4. **Tracking**: Real-time shipment tracking visible to staff and customers
5. **Container management**: Container arrival, devanning, stock allocation
6. **Backorder fulfilment**: When stock arrives, does it auto-allocate to backorders?
7. **Dispatch notifications**: Customer notification on dispatch (email/SMS)
8. **Returns**: Return merchandise authorisation (RMA) workflow
9. **Serial/lot tracking**: Serial number or batch/lot tracking per item
10. **Freight cost**: Freight cost captured per shipment, landed cost calculation

## AU Compliance Checks

- Dangerous goods documentation (relevant for cleaning equipment chemicals)
- AU Customs import documentation for container arrivals

## Output

Write findings to `.claude/memory/enhancement-program/research/warehouse-shipments.md`.
