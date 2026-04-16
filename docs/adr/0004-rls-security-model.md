# ADR-0004: Row-Level Security as Primary Access Control

## Status

Accepted

## Context

CCW's ERP/CRM handles sensitive business data including customer records, financial data, orders, and quotes. With multi-user access and an autonomous AI system, we needed a defence-in-depth approach to data access control.

## Decision

Use PostgreSQL Row-Level Security (RLS) policies as the primary access control mechanism for all user-facing data. Every table that contains user data must have RLS enabled. Service role is used only for system operations and CRON jobs.

Auth bridge column (`auth_id`) added to user records to link Supabase auth users to application users. Org-scoped policies applied to all 13 core tables.

## Consequences

**Easier**:

- Access control enforced at the database level (cannot be bypassed by application bugs)
- Consistent policy across all clients (frontend, backend, CRON)
- Audit trail via policy definitions

**Harder**:

- Service role key must be kept secret (bypasses all RLS)
- RLS policy changes require careful testing (both user and service_role contexts)
- Complex policies can slow query performance
- Every new table requires explicit RLS configuration
