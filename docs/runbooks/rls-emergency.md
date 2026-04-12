# Runbook: RLS Policy Emergency

## Symptoms

- Users accessing data belonging to other organisations
- Service role bypassing tenant isolation
- Unexpected data returned in API responses
- Security audit log showing cross-tenant data access

## Severity

**CRITICAL** — Potential data breach. Escalate immediately.

## First Response (< 2 minutes)

1. Post to #ccw-security: "RLS EMERGENCY — [table name] — investigating"
2. Alert CTO and CEO
3. Do NOT attempt to fix before understanding the scope

## Diagnostic Steps

### Step 1: Identify Affected Table

```bash
# Check recent security log
tail -100 logs/security.jsonl | grep -i "rls\|bypass\|unauthorised"
```

### Step 2: Test RLS Policy

```sql
-- Run as authenticated user (not service_role)
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "test-user-id", "org_id": "test-org"}';
SELECT * FROM <affected_table> LIMIT 5;
-- Should only return rows for test-org
```

### Step 3: Check Policy Definition

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = '<affected_table>';
```

### Step 4: Check for Missing Policies

```sql
-- Tables without RLS enabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies
);
```

## Resolution Steps

### Option A: Hotfix RLS Policy

1. Create hotfix branch: `hotfix/UNI-XXXX-rls-emergency`
2. Write corrected RLS policy in `supabase/migrations/`
3. Test with both authenticated and service_role contexts
4. Apply via Supabase MCP (requires CEO approval)
5. Verify fix with penetration test scenario

### Option B: Emergency Table Lock (last resort)

```sql
-- Temporarily revoke all access while fixing
REVOKE ALL ON TABLE <affected_table> FROM authenticated;
-- Re-grant after fix is verified
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <affected_table> TO authenticated;
```

### Option C: Enable RLS on Unprotected Table

```sql
ALTER TABLE <affected_table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <affected_table> FORCE ROW LEVEL SECURITY;
-- Then add appropriate policies
```

## Post-Mortem Template

- Incident ID:
- Table(s) affected:
- Users potentially exposed:
- Discovery method:
- Time to containment:
- Root cause:
- AU Privacy Act obligations triggered: Yes/No
- Policy changes made:
- Prevention actions:
