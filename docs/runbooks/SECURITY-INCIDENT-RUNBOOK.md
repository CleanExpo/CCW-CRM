# Runbook: Security Incident Response

**Last updated**: 2026-03-31
**Classification**: CONFIDENTIAL

## Severity Levels

| Level | Description                      | Response time     |
| ----- | -------------------------------- | ----------------- |
| P0    | Credential exposure, data breach | Immediate         |
| P1    | RLS bypass, auth weakness        | < 1 hour          |
| P2    | Suspicious access pattern        | < 4 hours         |
| P3    | Audit finding, non-critical      | Next business day |

---

## P0: Credential Exposure

If an API key, password, or secret has been committed or exposed:

1. **Immediately rotate** the exposed credential
   - Supabase: Dashboard → Settings → API → Regenerate
   - Stripe: Dashboard → Developers → API Keys → Roll key
   - Other: Follow vendor's key rotation process

2. **Remove from git history** (if committed)

   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch path/to/file' HEAD
   git push origin --force --all
   ```

3. **Audit access logs** for the exposed credential

4. **Update .env** and Vercel/Railway env vars with new credential

5. **Document** the incident in Linear (UNI) with timeline

---

## P1: RLS Bypass

If a row-level security policy can be bypassed:

1. **Immediately apply** a restrictive migration:

   ```sql
   ALTER TABLE public.affected_table ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON public.affected_table FROM anon, authenticated;
   ```

2. **Apply via Supabase MCP** — do not wait for migration file review

3. **Audit affected table** for unauthorised data access in logs

4. **Create a proper migration file** after the emergency patch

---

## Contacts

- CEO: Phill McGurk
- Database: Supabase dashboard (vwfgksqkajnpfjospbpe)
- Frontend: Vercel dashboard
- Backend: Railway dashboard
