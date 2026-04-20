# PR Handoff — Equipment Calculator Utility Modules

**Branch:** `fix/equipment-calculator`  
**Base:** `main`  
**Commit:** `0a1e44c`  
**Files added:** 2  

## Summary

Created two new TypeScript utility modules for water-damage restoration
equipment cost calculation, matching CCW's equipment catalogue:

| File | Purpose |
|------|---------|
| `apps/web/lib/equipment-calculator.ts` | Core catalogue + `calculateEquipment()` |
| `apps/web/lib/equipment-calculator-storm.ts` | Storm/Category-3 wrapper with IICRC S500 ratios |

### Key design contracts implemented

- **HEPA vacuum** — always present in storm mode (minimum 1 unit)
- **Large dehumidifier** (`CCW-DH-400`) — always present in storm mode; distinct SKU/price from standard (`CCW-DH-200`)
- **Negative quantity guard** — `Math.max(0, …)` coerces any negative or NaN input to 0
- **Zero-quantity exclusion** — items with effective quantity 0 are never emitted
- **Negative area guard** — storm calculator returns empty result for non-finite/negative area input
- **GST** — computed at 10%, all amounts rounded to 2dp

## PowerShell commands (Phill runs in `C:\CCW-Online ERP`)

```powershell
# 1. Pull the branch that was committed in the Pi CEO sandbox
git fetch origin fix/equipment-calculator
git checkout fix/equipment-calculator

# 2. Verify the two new files are present
Get-Item apps\web\lib\equipment-calculator.ts
Get-Item apps\web\lib\equipment-calculator-storm.ts

# 3. Push to GitHub
git push origin fix/equipment-calculator

# 4. Open PR (or use GitHub UI)
# Title: fix(web): add equipment-calculator and equipment-calculator-storm utility modules
# Base:  main
```

## Verification Checklist

| # | Where | How to get there | What to see | What NOT to see |
|---|-------|-----------------|-------------|-----------------|
| 1 | GitHub PR diff | Open PR → Files changed | 2 new files, 382 lines added | modifications to existing files |
| 2 | `equipment-calculator.ts` | Search for `HEPA_VACUUM` | Entry with `sku: 'CCW-HV-300'`, `dailyRate: 60` | Missing or undefined entry |
| 3 | `equipment-calculator.ts` | Search for `DEHUMIDIFIER_LARGE` | Entry with `sku: 'CCW-DH-400'`, `dailyRate: 135` | Same SKU/rate as standard dehumidifier |
| 4 | `equipment-calculator.ts` | Search for `Math.max(0` | Negative-input guard in `calculateEquipment()` | Raw use of `req.quantity` without coercion |
| 5 | `equipment-calculator-storm.ts` | Search for `HEPA_VACUUM: 1` | Minimum of 1 in `STORM_MINIMUMS` | `HEPA_VACUUM: 0` or missing entry |
| 6 | `equipment-calculator-storm.ts` | Search for `areaM2 === 0` | Early-return guard returning empty calc | Unchecked area passed to calculations |
| 7 | TypeScript (local) | `pnpm turbo run type-check --filter=web` | Exit 0, no new errors | Any type error in equipment-calculator*.ts |
