#!/usr/bin/env python3
"""
Fetch current priorities from Linear project.

Usage:
    # Set LINEAR_API_KEY environment variable first
    export LINEAR_API_KEY="<your_linear_api_key>"
    python scripts/get_linear_priorities.py

    # Or pass it inline
    LINEAR_API_KEY="your_key" python scripts/get_linear_priorities.py
"""

import sys
import os
import requests

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


def get_project_with_issues():
    """Get project details with all issues."""
    query = """
    query GetProject($projectId: String!) {
      project(id: $projectId) {
        id
        name
        description
        state
        progress
        url
        issues {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            state {
              name
              type
            }
            assignee {
              name
              email
            }
            createdAt
            updatedAt
            url
          }
        }
        projectUpdates {
          nodes {
            body
            createdAt
            user {
              name
            }
          }
        }
      }
    }
    """

    result = graphql_query(query, {"projectId": PROJECT_ID})
    return result.get("data", {}).get("project")


def format_priority(priority: int) -> str:
    """Convert Linear priority number to label."""
    priority_map = {
        0: "No Priority",
        1: "Urgent",
        2: "High",
        3: "Medium",
        4: "Low",
    }
    return priority_map.get(priority, "Unknown")


def main():
    """Main execution function."""
    print("=" * 80)
    print("Linear Project Priorities - CCW-ERP/CRM")
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
        print('  LINEAR_API_KEY="your_key" python scripts/get_linear_priorities.py')
        print()
        return 1

    try:
        print("[*] Fetching project and issues from Linear...")
        project = get_project_with_issues()

        if not project:
            print("[ERROR] Project not found")
            return 1

        print(f"[OK] Project: {project['name']}")
        print(f"     URL: {project['url']}")
        print(f"     State: {project['state']}")
        if project.get('progress'):
            print(f"     Progress: {project['progress']}%")
        print()

        # Get all issues
        issues = project.get("issues", {}).get("nodes", [])

        if not issues:
            print("[WARN] No issues found in project")
            return 0

        print(f"[*] Found {len(issues)} issues")
        print()

        # Group by priority
        priority_groups = {
            1: [],  # Urgent (P0)
            2: [],  # High (P1)
            3: [],  # Medium (P2)
            4: [],  # Low (P3)
            0: [],  # No Priority
        }

        for issue in issues:
            priority = issue.get("priority", 0)
            priority_groups[priority].append(issue)

        # Display issues by priority
        print("=" * 80)
        print("CURRENT PRIORITIES")
        print("=" * 80)
        print()

        # P0 - Urgent
        if priority_groups[1]:
            print("[!] URGENT (P0) - {} issue(s)".format(len(priority_groups[1])))
            print("-" * 80)
            for issue in priority_groups[1]:
                state_type = issue['state']['type']
                state_name = issue['state']['name']
                print(f"  {issue['identifier']}: {issue['title']}")
                print(f"    Status: {state_name} ({state_type})")
                if issue.get('assignee'):
                    print(f"    Assignee: {issue['assignee']['name']}")
                print(f"    URL: {issue['url']}")
                print()

        # P1 - High
        if priority_groups[2]:
            print("[*] HIGH (P1) - {} issue(s)".format(len(priority_groups[2])))
            print("-" * 80)
            for issue in priority_groups[2]:
                state_type = issue['state']['type']
                state_name = issue['state']['name']
                print(f"  {issue['identifier']}: {issue['title']}")
                print(f"    Status: {state_name} ({state_type})")
                if issue.get('assignee'):
                    print(f"    Assignee: {issue['assignee']['name']}")
                print(f"    URL: {issue['url']}")
                print()

        # P2 - Medium
        if priority_groups[3]:
            print("[*] MEDIUM (P2) - {} issue(s)".format(len(priority_groups[3])))
            print("-" * 80)
            for issue in priority_groups[3]:
                state_type = issue['state']['type']
                state_name = issue['state']['name']
                print(f"  {issue['identifier']}: {issue['title']}")
                print(f"    Status: {state_name} ({state_type})")
                if issue.get('assignee'):
                    print(f"    Assignee: {issue['assignee']['name']}")
                print()

        # P3 - Low
        if priority_groups[4]:
            print("[*] LOW (P3) - {} issue(s)".format(len(priority_groups[4])))
            print("-" * 80)
            for issue in priority_groups[4]:
                state_type = issue['state']['type']
                state_name = issue['state']['name']
                print(f"  {issue['identifier']}: {issue['title']}")
                print(f"    Status: {state_name} ({state_type})")
                print()

        # No Priority
        if priority_groups[0]:
            print("[*] NO PRIORITY - {} issue(s)".format(len(priority_groups[0])))
            print("-" * 80)
            for issue in priority_groups[0]:
                print(f"  {issue['identifier']}: {issue['title']}")
                print()

        print("=" * 80)
        print("NEXT ACTIONS")
        print("=" * 80)
        print()

        # Find next actionable items (not completed/cancelled)
        actionable_states = ['unstarted', 'started', 'backlog']
        next_actions = []

        # Check P0 first
        for issue in priority_groups[1]:
            if issue['state']['type'] in actionable_states:
                next_actions.append(('P0', issue))

        # Then P1
        if not next_actions:
            for issue in priority_groups[2]:
                if issue['state']['type'] in actionable_states:
                    next_actions.append(('P1', issue))

        # Show next actions
        if next_actions:
            print("[!] RECOMMENDED NEXT STEPS:")
            print()
            for priority, issue in next_actions[:3]:  # Show top 3
                print(f"  [{priority}] {issue['identifier']}: {issue['title']}")
                print(f"       Status: {issue['state']['name']}")
                print(f"       URL: {issue['url']}")
                print()
        else:
            print("[OK] No open issues found - all tasks complete or no priorities set!")

        # Show recent project updates
        updates = project.get("projectUpdates", {}).get("nodes", [])
        if updates:
            print("=" * 80)
            print("RECENT PROJECT UPDATES")
            print("=" * 80)
            print()
            latest = updates[0]
            print(f"Last update: {latest['createdAt']}")
            if latest.get('user'):
                print(f"By: {latest['user']['name']}")
            print()
            print("Summary:")
            # Show first 500 chars of latest update
            body = latest['body']
            if len(body) > 500:
                print(body[:500] + "...")
            else:
                print(body)
            print()

        print("=" * 80)
        print("[OK] Priority fetch complete!")
        print("=" * 80)

        return 0

    except requests.exceptions.HTTPError as e:
        print(f"[ERROR] HTTP Error: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"        Status: {e.response.status_code}")
            print(f"        Response: {e.response.text}")
        return 1
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
