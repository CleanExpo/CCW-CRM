#!/usr/bin/env python3
"""
Import issues from CSV to Linear using GraphQL API
"""

import csv
import os
import sys
from typing import Dict, List, Optional

import requests

# Linear API configuration
LINEAR_API_KEY = os.environ.get("LINEAR_API_KEY")
if not LINEAR_API_KEY:
    print("Error: LINEAR_API_KEY environment variable is required")
    sys.exit(1)
TEAM_KEY = os.environ.get("LINEAR_TEAM_KEY", "UNI")

# GraphQL endpoint
LINEAR_API_URL = "https://api.linear.app/graphql"


class LinearImporter:
    def __init__(self, api_key: str, team_key: str):
        self.api_key = api_key
        self.team_key = team_key
        self.team_id = None
        self.headers = {"Authorization": api_key, "Content-Type": "application/json"}

    def execute_graphql(self, query: str, variables: Dict = None) -> Dict:
        """Execute a GraphQL query against Linear API"""
        payload = {"query": query, "variables": variables or {}}

        try:
            response = requests.post(LINEAR_API_URL, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error executing GraphQL query: {e}")
            return {"errors": [str(e)]}

    def get_team_id(self) -> Optional[str]:
        """Get the team ID from the team key"""
        query = """
        query GetTeam($key: String!) {
            teams(filter: { key: { eq: $key } }) {
                nodes {
                    id
                    name
                    key
                }
            }
        }
        """

        result = self.execute_graphql(query, {"key": self.team_key})

        if "errors" in result:
            print(f"Error fetching team: {result['errors']}")
            return None

        teams = result.get("data", {}).get("teams", {}).get("nodes", [])
        if not teams:
            print(f"Team with key '{self.team_key}' not found")
            return None

        self.team_id = teams[0]["id"]
        print(f"Found team: {teams[0]['name']} (ID: {self.team_id})")
        return self.team_id

    def create_issue(
        self,
        title: str,
        description: str,
        priority: int = 0,
        labels: List[str] = None,
        estimate: int = None,
    ) -> Optional[str]:
        """Create a single issue in Linear"""

        mutation = """
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    url
                }
            }
        }
        """

        # Map priority string to number
        priority_map = {
            "Critical": 1,  # Urgent
            "High": 2,  # High
            "Medium": 3,  # Medium
            "Low": 4,  # Low
        }

        input_data = {
            "title": title,
            "description": description,
            "teamId": self.team_id,
            "priority": priority_map.get(priority, 0),
        }

        if estimate:
            input_data["estimate"] = estimate

        result = self.execute_graphql(mutation, {"input": input_data})

        if "errors" in result:
            print(f"Error creating issue: {result['errors']}")
            return None

        issue_data = result.get("data", {}).get("issueCreate", {})
        if issue_data.get("success"):
            issue = issue_data["issue"]
            print(f"  Created: {issue['identifier']} - {issue['title']}")
            return issue["id"]
        else:
            print("  Failed to create issue")
            return None

    def create_epic(
        self, title: str, description: str, priority: int = 0
    ) -> Optional[str]:
        """Create an epic (using a label for now since Linear doesn't have native epics)"""
        # In Linear, we'll create these as issues with "epic" label
        return self.create_issue(
            title=f"[EPIC] {title}",
            description=description,
            priority=priority,
            labels=["epic"],
        )

    def import_from_csv(self, csv_file: str):
        """Import issues from CSV file"""

        print(f"\n{'=' * 60}")
        print("LINEAR IMPORT - CCW ERP Deployment Roadmap v2.0")
        print(f"{'=' * 60}\n")

        # First, get the team ID
        if not self.get_team_id():
            print("Failed to get team ID. Exiting.")
            return False

        # Read CSV file
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except FileNotFoundError:
            print(f"Error: CSV file not found: {csv_file}")
            return False
        except Exception as e:
            print(f"Error reading CSV: {e}")
            return False

        print(f"Found {len(rows)} issues to import\n")

        # Track created issues for parent relationships
        created_issues = {}
        stats = {"epics": 0, "issues": 0, "failed": 0}

        # First pass: Create all issues
        for row in rows:
            identifier = row.get("Identifier", "")
            title = row.get("Title", "")
            description = row.get("Description", "")
            priority = row.get("Priority", "Medium")
            estimate_str = row.get("Estimate (hours)", "")

            # Parse estimate
            try:
                estimate = int(estimate_str) if estimate_str else None
            except ValueError:
                estimate = None

            # Skip if no title
            if not title:
                continue

            print(f"Creating {identifier}: {title[:50]}...")

            # Create the issue
            issue_id = self.create_issue(
                title=title,
                description=description,
                priority=priority,
                estimate=estimate,
            )

            if issue_id:
                created_issues[identifier] = issue_id
                if identifier.startswith("EPIC"):
                    stats["epics"] += 1
                else:
                    stats["issues"] += 1
            else:
                stats["failed"] += 1

        # Print summary
        print(f"\n{'=' * 60}")
        print("IMPORT SUMMARY")
        print(f"{'=' * 60}")
        print(f"Epics created: {stats['epics']}")
        print(f"Issues created: {stats['issues']}")
        print(f"Failed: {stats['failed']}")
        print(f"Total: {stats['epics'] + stats['issues'] + stats['failed']}")
        print(f"{'=' * 60}\n")

        return stats["failed"] == 0


def main():
    """Main entry point"""
    # Get CSV file path
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    else:
        csv_file = "docs/linear-roadmap-v2.0.csv"

    # Check for API key
    if not LINEAR_API_KEY:
        print("Error: LINEAR_API_KEY environment variable not set")
        print("Set it with: export LINEAR_API_KEY=your_api_key")
        sys.exit(1)

    # Create importer and run
    importer = LinearImporter(LINEAR_API_KEY, TEAM_KEY)
    success = importer.import_from_csv(csv_file)

    if success:
        print("[SUCCESS] Import completed successfully!")
        sys.exit(0)
    else:
        print("[FAILED] Import completed with errors")
        sys.exit(1)


if __name__ == "__main__":
    main()
