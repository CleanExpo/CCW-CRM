# Smoke Test Finding — SYNTHETIC (do not route to board)

**Domain**: Settings & Security
**Finding ID**: SMOKE-001
**Researcher**: synthetic (smoke test)
**Date**: 2026-04-14

## Gap Description

The Settings page (`/settings/general`) does not display the business's AU timezone
(AEST/AEDT) in the UI, defaulting to UTC. Staff scheduling daily cron jobs (e.g.
nightly Xero sync) manually compensate, which has caused off-by-one-day errors in
BAS reporting twice in the past quarter.

## Evidence

- `apps/web/app/(dashboard)/settings/general/page.tsx` — no timezone field rendered
- `apps/backend/src/api/routes/settings.py` — `GET /settings` response lacks `timezone` field

## Suggested Fix

Add `timezone: "Australia/Sydney"` to the settings model, expose it on the API,
and render a read-only display (editable by admin) on the Settings page.

## Smoke Test Metadata

This finding is **synthetic** — it exists only to validate the triage pipeline.
Triage agent: score this as you normally would (expected ~55–65/100).
Board: deliberate normally (expected APPROVE).
Linear: create the issue — label it `smoke-test` so it can be identified and closed.
