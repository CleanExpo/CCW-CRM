#!/usr/bin/env python3
"""
List available Linear teams to find the correct team key
"""

import os
import sys

import requests

LINEAR_API_KEY = os.environ.get("LINEAR_API_KEY")
if not LINEAR_API_KEY:
    print("Error: LINEAR_API_KEY environment variable is required")
    sys.exit(1)
LINEAR_API_URL = "https://api.linear.app/graphql"


def execute_graphql(query, variables=None):
    headers = {"Authorization": LINEAR_API_KEY, "Content-Type": "application/json"}
    payload = {"query": query, "variables": variables or {}}

    try:
        response = requests.post(LINEAR_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return {"errors": [str(e)]}


def list_teams():
    query = """
    query GetTeams {
        teams {
            nodes {
                id
                name
                key
                description
            }
        }
    }
    """

    result = execute_graphql(query)

    if "errors" in result:
        print(f"Error fetching teams: {result['errors']}")
        return

    teams = result.get("data", {}).get("teams", {}).get("nodes", [])

    if not teams:
        print("No teams found in your Linear workspace.")
        return

    print("\n" + "=" * 60)
    print("Available Linear Teams:")
    print("=" * 60 + "\n")

    for team in teams:
        print(f"Team Name: {team['name']}")
        print(f"Team Key:  {team['key']}")
        print(f"Team ID:   {team['id']}")
        if team.get("description"):
            print(f"Description: {team['description']}")
        print("-" * 60)

    print("\nTo import issues, use the TEAM_KEY from above.")
    print("Example: export LINEAR_TEAM_KEY=TEAMKEY")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    if not LINEAR_API_KEY:
        print("Error: LINEAR_API_KEY environment variable not set")
        sys.exit(1)

    list_teams()
