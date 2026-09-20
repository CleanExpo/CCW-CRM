# Workshop pilot — one-page scope

**Status:** draft for Toby (3 Sep 2026). The pilot does **not** run until Phase 1 stock is signed on a frozen as-of **and** this note is agreed.  
**Commercial track:** outside Phase 2. Phase 2 remains the eight reconciliation areas.  
**Pilot centre:** Brisbane (Toby). Sydney and Melbourne after Brisbane is reviewed.  
**Charge:** not Phase 2 hours. Price sits with Phill / Unite-Group against this note — not against the July Phase 2 SoW.

## What is built

Optix already has a workshop workspace: equipment register, service templates, staff bookings, and a reminder queue.

Added for this note:

- **Centres** — Brisbane / Sydney / Melbourne rows for technician hours, bays, labour rate, manager, and who approves outreach. Empty until Toby’s form lands.
- **Recall review** — due equipment listed for a tech to confirm customer and machine. Decisions: queued, ready to book (staff diary only), held, wrong customer, wrong machine.
- **Outreach gate** — send/send-pending on reminders is refused. No email or SMS to a customer from this flow.

## What it reads

- Customer-owned equipment (make, model, serial, location, next service date/hours).
- Customer company / contact on that asset (for staff eyes only).
- Service templates and estimated hours (packages).
- Centre capacity once the form is stored.

It does **not** read live Cin7 as the Phase 1 close. Stock close stays on a frozen as-of.

## What it writes

- Centre capacity fields when the form is entered.
- Recall review status and notes.
- Staff bookings on the existing schedule (no customer notification).

It does **not** write customer email, SMS, or a “sent” reminder.

## Week-one “done”

For **Brisbane only**, with real hours/rates/packages **when Toby sends the form** (he holds that until stock sign-off and this note):

1. Due machines appear on Recall review with customer, serial, make/model.
2. A tech can hold or flag a wrong customer/machine. Those rows never become outreach.
3. A tech can mark “ready to book” and create a **staff** booking.
4. Any control that would contact a customer returns blocked.
5. Totals shown are per centre, not named technician pay.

Week one is **not** “first customer heard from Optix.”

## Gates (Toby)

| Gate                                         | State                                         |
| -------------------------------------------- | --------------------------------------------- |
| Phase 1 five totals on a shared frozen as-of | Open                                          |
| SKU × branch × decimal at that as-of         | Area 1, not Phase 1 close                     |
| This scope note agreed                       | Open                                          |
| Centre form (BNE/SYD/MEL)                    | Toby collecting; released after the two gates |
| Customer contact                             | Blocked in product                            |

## Labour clock (Toby’s timesheet)

How hours are written today is in [`CCW-WORKSHOP-TIMESHEET-INSTRUCTIONS.md`](./CCW-WORKSHOP-TIMESHEET-INSTRUCTIONS.md) (Word original alongside). Quarter-hours, **0.50 minimum**, billable = **XLABOUR** on Cin7 invoices and production jobs, non-billable named, B/forward excluded from the weekly job total, un-accounted target zero. Optix must not invent a second clock.

## Out of scope

COGS, Xero, AI phone, manufacturer-document ingest, suppression-list product, and Phase 2 Areas 2–8.
