#!/usr/bin/env python3
"""
Update Linear with deployment preparation status.

Usage:
    # Set LINEAR_API_KEY environment variable first
    export LINEAR_API_KEY="<your_linear_api_key>"
    python scripts/update_linear_deployment_prep.py

    # Or pass it inline
    LINEAR_API_KEY="your_key" python scripts/update_linear_deployment_prep.py
"""

import sys
import os
import requests
from datetime import datetime

# Linear API configuration
LINEAR_API_KEY = os.getenv("LINEAR_API_KEY", "")
LINEAR_API_URL = "https://api.linear.app/graphql"
PROJECT_ID = "40c7dc3d-35ff-4e2c-ac1e-f903c1f5c856"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": LINEAR_API_KEY,
}


def graphql_query(query: str, variables: dict = None) -> dict:
    """Execute a GraphQL query against Linear API."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    response = requests.post(LINEAR_API_URL, json=payload, headers=HEADERS)
    response.raise_for_status()
    return response.json()


def add_project_update(project_id: str, body: str):
    """Add project update."""
    mutation = """
    mutation CreateProjectUpdate($projectId: String!, $body: String!) {
      projectUpdateCreate(input: {projectId: $projectId, body: $body}) {
        success
        projectUpdate {
          id
        }
      }
    }
    """
    result = graphql_query(mutation, {"projectId": project_id, "body": body})
    return result.get("data", {}).get("projectUpdateCreate")


def main():
    """Main execution function."""
    print("=" * 80)
    print("Linear Update - Deployment Preparation Complete")
    print("=" * 80)
    print()

    # Check for API key
    if not LINEAR_API_KEY:
        print("[ERROR] LINEAR_API_KEY environment variable not set")
        print()
        print("Set it with:")
        print('  export LINEAR_API_KEY="<your_linear_api_key>"')
        print()
        print("Or run with:")
        print('  LINEAR_API_KEY="your_key" python scripts/update_linear_deployment_prep.py')
        print()
        return 1

    # Prepare deployment prep update
    deployment_prep_update = """## [*] UNI-478: Deployment Preparation COMPLETE (2026-02-11)

### Status: Ready for Production Deployment

**Phase**: Preparation Complete
**Next**: Execute deployment to Vercel + Railway + Supabase

### Production Readiness Checks [OK]
- [OK] Type-check: PASSED (21.5s, 0 errors)
- [OK] Lint: PASSED (179ms, 163 non-blocking warnings)
- [OK] Tests: PASSED (154/154 tests in 7.03s)
- [OK] Production Readiness Score: 70/70
- [OK] Database Health: 100/100 (Perfect)
- [OK] Build Verified: 93 routes compiled, 550ms start time

### Deployment Documentation Created

**DEPLOYMENT-GUIDE.md** (1000+ lines)
- Step-by-step deployment instructions
- 8 detailed sections covering all aspects
- Troubleshooting guide for common issues
- Platform-specific configuration

**DEPLOYMENT-CHECKLIST.md**
- Quick reference with checkboxes
- Environment variables to collect
- Success criteria for each step
- Deployment metrics tracking

**Scripts**
- `update_deployment_status.py` - Linear automation post-deployment
- `get_linear_priorities.py` - Priority tracking

### Deployment Stack Configuration [OK]

**Frontend (Vercel)**
- Configuration: `apps/web/vercel.json`
- Security headers configured
- Cron jobs configured
- Environment template: `/.env.example` (copy subset to `apps/web/.env.local`)

**Backend (Railway)**
- Configuration: `apps/backend/railway.json`
- Dockerfile ready: `apps/backend/Dockerfile`
- Health checks configured
- Environment template: `/.env.example` (copy subset to `apps/backend/.env`)

**Database (Supabase)**
- PostgreSQL 15 + pgvector
- Schema migrations ready
- Extensions list prepared

**Cache (Upstash Redis)**
- Redis configuration ready
- Connection pooling configured

### Deployment Tasks Breakdown

**Step 1**: Supabase Project Setup (~10 min)
- Create project
- Enable pgvector + uuid-ossp extensions
- Run schema migrations
- Copy connection details

**Step 2**: Upstash Redis Setup (~5 min)
- Create Redis database
- Copy connection URL

**Step 3**: Railway Backend Deployment (~10 min)
- Create project from GitHub
- Configure environment variables
- Deploy backend
- Test health endpoint

**Step 4**: Vercel Frontend Deployment (~10 min)
- Import project
- Configure build settings
- Add environment variables
- Deploy frontend

**Step 5**: Configuration & Testing (~60 min)
- Update CORS origins
- Run smoke tests
- Configure monitoring
- Set up backups

**Total Estimated Time**: 2-3 hours

### Git Status [OK]
- Commit: f0b4242
- Branch: main
- Status: Pushed to origin
- Files: DEPLOYMENT-GUIDE.md, DEPLOYMENT-CHECKLIST.md, scripts/

### Next Immediate Actions

1. Review deployment documentation
2. Gather required credentials:
   - Anthropic API key
   - Google AI API key (for translations)
   - Supabase account credentials
   - Railway account credentials
   - Vercel account credentials
   - Upstash account credentials
3. Follow DEPLOYMENT-CHECKLIST.md step by step
4. Run smoke tests after deployment
5. Update Linear with deployment status (use update_deployment_status.py)

### Resources Ready

- Documentation: DEPLOYMENT-GUIDE.md
- Checklist: DEPLOYMENT-CHECKLIST.md
- GitHub: https://github.com/CleanExpo/CCW-CRM
- Linear: https://linear.app/unite-hub/issue/UNI-478

**Status**: READY FOR DEPLOYMENT [OK]
**Blocker**: None - all checks passed
**Risk Level**: LOW - comprehensive preparation complete

---
*Preparation completed: 2026-02-11 15:58 UTC*
*Commit: f0b4242*
*Branch: main*
"""

    print("[*] Adding project update to Linear...")
    result = add_project_update(PROJECT_ID, deployment_prep_update)

    if result and result.get("success"):
        print("[OK] Project update added successfully!")
        print(f"     Update ID: {result['projectUpdate']['id']}")
    else:
        print("[ERROR] Failed to add project update")
        return 1

    print()
    print("=" * 80)
    print("[OK] Linear updated with deployment preparation status!")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Review documentation:")
    print("     - DEPLOYMENT-GUIDE.md")
    print("     - DEPLOYMENT-CHECKLIST.md")
    print()
    print("  2. Gather credentials for:")
    print("     - Supabase (database)")
    print("     - Railway (backend)")
    print("     - Vercel (frontend)")
    print("     - Upstash (Redis)")
    print()
    print("  3. Execute deployment following the checklist")
    print()
    print("  4. After deployment, run:")
    print("     python scripts/update_deployment_status.py")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
