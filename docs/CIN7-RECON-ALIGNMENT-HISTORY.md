# Cin7 reconciliation: alignment history & read-only gate

**Audience:** Toby Bredhauer / sign-off  
**Updated:** 2026-08-09

## What went wrong

Earlier live reconciliation **wrote Optix while measuring it** (auto field heal / stock qty align). That made field-diff counts fall when someone ran “Refresh from live Cin7,” so the report could not evidence whether sync alone was correct.

## What changed (precondition for sign-off)

| Requirement              | Implementation                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recon is read-only       | `buildCin7Reconciliation` no longer calls any heal/align. Notes state read-only explicitly.                                                                 |
| Repair is separate       | `POST /api/integrations/cin7/field-heal` and `POST /api/integrations/cin7/stock-prune` with confirm in UI                                                   |
| Logged + reversible      | `cin7_heal_audit_runs` / `cin7_heal_audit_rows` store before-images; `POST .../heal-audit/revert`                                                           |
| Immutable snapshots (B5) | Every fresh live pull and acceptance run stored on `cin7_recon_runs` (`immutable=true`, `mode=live\|acceptance`); list via `GET .../reconciliation/history` |
| Per-account ledgers      | All sync/recon rows scoped by `ownerUserId` — explained in UI                                                                                               |

## What the old auto-align wrote (historical)

When alignment lived inside recon, matched Optix keys could be overwritten from live Cin7 for:

- **products** — name, price, stock, isActive, visibility/category
- **customers / internal / suppliers / branches** — compared contact/branch fields
- **stock** — available, stockOnHand, incoming

It did **not** delete surplus stock rows. Surplus removal requires explicit **Prune surplus stock**.

Row counts changed “to date” must be taken from production logs / `cin7_heal_audit_*` after deploy (auto-heal inside recon left only console logs, not a durable audit table).

## Stock surplus blocker

Optix extras vs Cin7 (e.g. 13,749 vs 10,542) are fixed by:

1. Complete stock-levels sync for **that account**
2. Explicit **Prune surplus stock** (dry-run → apply → audit)
3. Read-only live recon to evidence the new counts

## Sign-off protocol

1. Agree the Optix account used for acceptance.
2. Run **Refresh from live Cin7** (read-only) → note `recon_run_id`.
3. Open the same id under Stored snapshots / history API.
4. Sign off against that stored snapshot — not a one-off screenshot.
