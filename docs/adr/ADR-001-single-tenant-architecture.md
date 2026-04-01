# ADR-001: Single-Tenant Architecture for CCW

**Date**: 2026-03-31
**Status**: Accepted
**Deciders**: Phill McGurk (CEO), Claude (AI Architect)

## Context

Linear issues UNI-1700 through UNI-1704 proposed migrating CCW to a multi-tenant SaaS architecture with Supabase Auth, auth_id columns, and org-scoped RLS policies.

CCW currently uses custom JWT auth (`JWT_SECRET_KEY` + bcrypt against `public.users.hashed_password`) and direct `DATABASE_URL` connections via SQLAlchemy — bypassing RLS entirely.

## Decision

**Reject multi-tenancy. Maintain single-tenant architecture.**

CCW is an internal business tool for one company (CCW). It does not serve multiple organisations. A full multi-tenant migration would require:
- 6+ weeks of risky schema changes
- Auth system replacement (currently locked per CLAUDE.md)
- Data migration of all existing records
- Risk of breaking the deployed production system

Instead, apply the minimal security fix: enable RLS on `public.users` as a deny-all PostgREST layer while leaving the FastAPI backend's `postgres` role unaffected.

## Consequences

- **Positive**: Zero migration risk, production stability maintained, months of rework avoided
- **Positive**: Security gap closed (PostgREST cannot read `hashed_password` anymore)
- **Negative**: Cannot pivot to SaaS multi-tenancy without revisiting this decision
- **Neutral**: If CCW ever onboards external tenants, this ADR must be revisited

## Implementation

Migration: `supabase/migrations/20260331190003_fix_rls_users_table.sql`
