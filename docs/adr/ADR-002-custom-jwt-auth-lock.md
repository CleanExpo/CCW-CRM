# ADR-002: Lock Custom JWT Authentication System

**Date**: 2026-03-31
**Status**: Accepted
**Deciders**: Phill McGurk (CEO)

## Context

CCW uses a custom JWT authentication system in:
- `apps/backend/src/api/routes/demo_auth.py` — auth endpoints
- `apps/web/middleware.ts` — JWT validation middleware

This system uses `JWT_SECRET_KEY` for signing and bcrypt against `public.users.hashed_password` for verification.

## Decision

**Lock these files. No modifications without explicit CEO approval.**

The auth system works correctly in production. Modifying auth code introduces severe risk:
- Production lockout if JWT validation breaks
- Security vulnerabilities from incorrect changes
- Breaking changes to the frontend auth flow

## Consequences

- **Positive**: Production auth stability guaranteed
- **Positive**: Security surface area does not expand
- **Negative**: Adding new auth features (OAuth, SSO) requires explicit approval workflow
- **Neutral**: Supabase Auth can be evaluated for future if needed

## Files Locked

- `apps/web/middleware.ts` — NEVER modify
- `apps/backend/src/api/routes/demo_auth.py` — NEVER modify
