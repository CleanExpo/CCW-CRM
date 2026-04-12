"""
Example Linear API script for creating Phase 5 issues.

Setup:
1. Copy this file to create_phase5_issues.py
2. Create .linear-api-key in project root with:
   LINEAR_API_KEY=your_actual_key_here
   LINEAR_PROJECT_ID=your_project_id_here
3. Run: python scripts/create_phase5_issues.py
"""
import json
import urllib.request
import sys
import os
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Load from .linear-api-key file (recommended - gitignored)
config_file = Path(__file__).parent.parent / '.linear-api-key'
api_key = None
project_id = None

if config_file.exists():
    with open(config_file) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                if key == 'LINEAR_API_KEY':
                    api_key = value
                elif key == 'LINEAR_PROJECT_ID':
                    project_id = value

# Fallback to environment variables
if not api_key:
    api_key = os.environ.get("LINEAR_API_KEY")
if not project_id:
    project_id = os.environ.get("LINEAR_PROJECT_ID", "40c7dc3d-35ff-4e2c-ac1e-f903c1f5c856")

if not api_key or api_key == "YOUR_LINEAR_API_KEY_HERE":
    print("ERROR: LINEAR_API_KEY not configured!")
    print("Please create .linear-api-key file or set LINEAR_API_KEY environment variable")
    sys.exit(1)

# First, get the team ID and state IDs
team_query = """
query {
  teams(first: 1) {
    nodes {
      id
      states {
        nodes {
          id
          name
        }
      }
    }
  }
}
"""

data = json.dumps({"query": team_query}).encode('utf-8')
req = urllib.request.Request(
    "https://api.linear.app/graphql",
    data=data,
    headers={
        "Content-Type": "application/json",
        "Authorization": api_key
    }
)

with urllib.request.urlopen(req) as response:
    result = json.loads(response.read().decode('utf-8'))
    team_id = result['data']['teams']['nodes'][0]['id']
    states = result['data']['teams']['nodes'][0]['states']['nodes']
    todo_state = next(s['id'] for s in states if s['name'] == 'Todo')

    print(f"Team ID: {team_id}")
    print(f"Todo State ID: {todo_state}")

# Create Phase 5 issues
issues_to_create = [
    {
        "title": "Phase 5.1: Risk Assessment & Test Coverage (Week 1)",
        "priority": 1,
        "description": """# Phase 5.1: Risk Assessment & Test Coverage

## Goals
- Implement RiskAssessor class for automatic change categorization
- Increase test coverage to >80%
- Add E2E tests for critical paths

## Tasks
1. Create `apps/backend/src/agents/risk_assessor.py`
2. Add E2E tests for order flow, login, payment
3. Add security tests (SQL injection, XSS, CSRF)
4. Run coverage report and fix gaps

## Success Criteria
- Risk assessment works for sample PRs
- Test coverage >80%
- All critical paths have E2E tests

## Estimated Time: 40 hours (1 week)
"""
    },
    {
        "title": "Phase 5.2: Monitoring & Safety Guardrails (Week 2)",
        "priority": 1,
        "description": """# Phase 5.2: Monitoring & Safety Guardrails

## Goals
- Implement agent metrics tracking
- Add safety guardrails (protected files, circuit breaker)
- Set up observability dashboard

## Tasks
1. Create agent metrics module
2. Create safety guardrails module
3. Set up Grafana dashboard

## Success Criteria
- Agent decisions logged and auditable
- Protected files cannot be auto-merged
- Circuit breaker pauses autonomy on errors

## Estimated Time: 40 hours (1 week)
"""
    },
    {
        "title": "Phase 5.3: Documentation Autonomy (Week 3)",
        "priority": 2,
        "description": """# Phase 5.3: Documentation Autonomy

## Goals
- Enable auto-merge for documentation changes
- Monitor for issues
- Build confidence in autonomy

## Tasks
1. Update PR automation to auto-merge *.md files
2. Monitor for 1 week
3. Review first 10 auto-merged PRs

## Success Criteria
- >20 documentation PRs auto-merged
- 0 reverts
- No quality issues reported

## Estimated Time: 20 hours (1 week)
"""
    },
    {
        "title": "Phase 5.4: Gradual Autonomy Expansion (Week 4-8)",
        "priority": 3,
        "description": """# Phase 5.4: Gradual Autonomy Expansion

## Goals
- Expand autonomy to tests
- Expand autonomy to low-risk code (UI components)
- Continue monitoring and adjusting

## Tasks
1. Enable auto-merge for test additions
2. Monitor for 2 weeks
3. Enable auto-merge for UI components
4. Monitor for 4 weeks

## Success Criteria
- >50 auto-merged PRs
- <1% revert rate
- Positive developer feedback

## Estimated Time: 40 hours (5 weeks)
"""
    }
]

mutation = """
mutation($title: String!, $description: String!, $projectId: String!, $priority: Int!) {
  issueCreate(input: {
    title: $title
    description: $description
    projectId: $projectId
    priority: $priority
  }) {
    success
    issue {
      id
      identifier
      url
    }
  }
}
"""

print("\nCreating Phase 5 issues...\n")

for issue_data in issues_to_create:
    variables = {
        "title": issue_data["title"],
        "description": issue_data["description"],
        "projectId": project_id,
        "priority": issue_data["priority"]
    }

    data = json.dumps({"query": mutation, "variables": variables}).encode('utf-8')
    req = urllib.request.Request(
        "https://api.linear.app/graphql",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": api_key
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))

            if result and 'errors' in result:
                print(f"FAILED: {issue_data['title']}")
                print(f"  Errors: {json.dumps(result['errors'], indent=2)}\n")
            elif result and result.get('data', {}) and result['data'].get('issueCreate', {}).get('success'):
                issue = result['data']['issueCreate']['issue']
                print(f"SUCCESS: Created {issue['identifier']} - {issue_data['title']}")
                print(f"  URL: {issue['url']}\n")
            else:
                print(f"FAILED: {issue_data['title']}")
                print(f"  Response: {json.dumps(result, indent=2)}\n")
    except Exception as e:
        print(f"Error creating {issue_data['title']}: {e}")
        import traceback
        traceback.print_exc()

print("\nAll Phase 5 issues created!")
