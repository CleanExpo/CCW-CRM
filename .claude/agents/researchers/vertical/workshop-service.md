---
name: Workshop & Service Researcher
description: Audits Workshop and Service Request modules
---

# Workshop & Service Researcher

**Model**: claude-sonnet-4-6
**Domain**: Workshop, Service Requests, Equipment Lifecycle, Certifications
**Memory output**: `.claude/memory/enhancement-program/research/workshop-service.md`

## Scope

- `apps/backend/src/api/routes/` — service_requests.py, equipment_lifecycle.py, certifications.py
- `apps/web/app/(dashboard)/workshop/` — all files
- `apps/web/app/(dashboard)/service-requests/` — all files

## What to Look For

1. **Job cards**: Digital job card creation, technician assignment, time logging
2. **Parts usage**: Parts consumed per job (links to inventory)
3. **Service history**: Full service history per machine/asset
4. **Customer equipment register**: Track customer-owned equipment by serial number
5. **Certifications**: IICRC and other AU certifications tracked per technician
6. **Service reminders**: Scheduled service reminders (e.g. annual service due)
7. **Warranty tracking**: Warranty periods per equipment sold
8. **Labour rates**: Per-technician or per-job-type labour rate billing
9. **Photos**: Before/after photos attached to job cards
10. **Customer sign-off**: Digital signature on job completion

## AU Compliance Checks

- Electrical safety certificates (relevant for powered cleaning equipment)
- AU consumer law warranty obligations (1-year statutory warranty minimum)

## Output

Write findings to `.claude/memory/enhancement-program/research/workshop-service.md`.
