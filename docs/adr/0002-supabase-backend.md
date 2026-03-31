# ADR-0002: Use Supabase as Primary Backend

## Status
Accepted

## Context
CCW needed a database and authentication solution that could handle production workloads, provide row-level security for multi-tenant data, and integrate with Next.js frontend without significant backend complexity.

## Decision
Use Supabase Cloud as the primary backend providing PostgreSQL database, authentication, row-level security (RLS) policies, realtime subscriptions, and storage.

FastAPI remains as the application server for complex business logic and integrations (Cin7, Xero, Shopify).

## Consequences

**Easier**:
- RLS policies enforce data isolation at the database level
- Built-in auth with JWT support
- Realtime subscriptions for live data
- Excellent Next.js integration
- Migration tooling via Supabase CLI

**Harder**:
- RLS policy complexity grows with data model
- Supabase outages affect all services
- Service role key must be protected carefully (bypasses RLS)
- Local development requires Supabase CLI setup
