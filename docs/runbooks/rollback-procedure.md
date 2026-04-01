# Runbook: Rollback Procedure

## Symptoms
- Production errors after a recent deployment
- Data integrity issues after a migration
- Performance regression after code merge
- User-reported critical bugs in production

## Severity
**CRITICAL** for data integrity issues. **HIGH** for functional regressions.

## First Response
1. Identify the last known-good commit/deployment
2. Assess whether rollback is faster than forward-fix
3. Alert CTO and CEO before executing production rollback

## Code Rollback Procedure

### Step 1: Identify Commit to Revert
```bash
git log --oneline main | head -20
# Identify the merge commit that introduced the issue
```

### Step 2: Create Revert Commit (Never Force Push)
```bash
git checkout main
git revert <merge-commit-sha> --mainline 1 -m "Revert: <description>"
```

### Step 3: Push to Trigger CI
```bash
git push origin main
# CI will run automatically; Vercel will auto-deploy on pass
```

### Step 4: Verify Rollback
```bash
# Check production health
curl https://ccw-erp.vercel.app/api/health
# Check backend health
curl https://api.ccw-erp.com/api/health
```

## Database Migration Rollback

### Step 1: Identify Migration to Rollback
```bash
# Check migration history
node -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
db.from('_migration_history').select('*').order('applied_at', {ascending: false}).limit(10).then(({data}) => console.log(data));
"
```

### Step 2: Apply Rollback SQL
```bash
# Find rollback file
ls supabase/migrations/_rollback/
# Apply via Supabase MCP (requires CEO approval)
# node scripts/lib/migration-runner.js rollback <migration-id>
```

### Step 3: Verify Data Integrity
```bash
# Run data integrity checks for affected tables
```

## Post-Mortem Template
- Incident time:
- Rollback time:
- Root cause of original issue:
- Users affected:
- Data loss: Yes/No
- Prevention actions:
