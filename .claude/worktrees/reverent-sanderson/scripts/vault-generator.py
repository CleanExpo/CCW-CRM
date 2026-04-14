#!/usr/bin/env python3
"""
Vault Generator - Main orchestrator for auto-generating Obsidian vault docs.

Usage:
    python scripts/vault-generator.py --entity-types routes,pages,models --incremental
    python scripts/vault-generator.py --entity-types all --verify-only
"""

import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Literal

import click

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.parsers.parse_routes import RouteParser
from scripts.parsers.parse_pages import PageParser
from scripts.parsers.parse_models import ModelParser
from scripts.parsers.parse_components import ComponentParser
from scripts.parsers.parse_api_clients import ApiClientParser
from scripts.parsers.parse_integrations import IntegrationParser

REPO_ROOT = Path(__file__).parent.parent
VAULT_ROOT = REPO_ROOT / ".obsidian-vault"
MEMORY_DIR = REPO_ROOT / ".claude" / "memory"
LAST_SYNC_FILE = MEMORY_DIR / "last-vault-sync.json"

EntityType = Literal["routes", "pages", "models", "components", "api-clients", "integrations"]

PARSER_MAP = {
    "routes": RouteParser,
    "pages": PageParser,
    "models": ModelParser,
    "components": ComponentParser,
    "api-clients": ApiClientParser,
    "integrations": IntegrationParser,
}


def get_changed_files_since_last_sync(entity_types: list[str]) -> dict[str, list[Path]]:
    """Get files changed since last sync using git diff."""
    import subprocess

    if not LAST_SYNC_FILE.exists():
        # First run - scan all files
        return get_all_files_by_entity_type(entity_types)

    with open(LAST_SYNC_FILE) as f:
        last_sync_data = json.load(f)
        last_commit = last_sync_data.get("last_commit_hash", "HEAD~10")

    # Get changed files since last commit
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", last_commit, "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        changed_files = [REPO_ROOT / line for line in result.stdout.strip().split("\n") if line]
    except subprocess.CalledProcessError:
        # Fallback to all files if git command fails
        return get_all_files_by_entity_type(entity_types)

    # Filter by entity type
    filtered = {entity_type: [] for entity_type in entity_types}

    for file_path in changed_files:
        if not file_path.exists():
            continue

        # Route files
        if "routes" in entity_types and "apps/backend/src/api/routes" in str(file_path) and file_path.suffix == ".py":
            filtered["routes"].append(file_path)

        # Page files
        if "pages" in entity_types and "apps/web/app/(dashboard)" in str(file_path) and file_path.name == "page.tsx":
            filtered["pages"].append(file_path)

        # Model files
        if "models" in entity_types and "apps/backend/src/db" in str(file_path) and file_path.name.endswith("_models.py"):
            filtered["models"].append(file_path)

        # Component files
        if "components" in entity_types and "apps/web/components" in str(file_path) and file_path.suffix == ".tsx":
            filtered["components"].append(file_path)

        # API client files
        if "api-clients" in entity_types and "apps/web/lib/api" in str(file_path) and file_path.suffix == ".ts":
            filtered["api-clients"].append(file_path)

    return filtered


def get_all_files_by_entity_type(entity_types: list[str]) -> dict[str, list[Path]]:
    """Get all files for given entity types (full scan)."""
    files = {entity_type: [] for entity_type in entity_types}

    if "routes" in entity_types:
        routes_dir = REPO_ROOT / "apps" / "backend" / "src" / "api" / "routes"
        if routes_dir.exists():
            files["routes"] = list(routes_dir.rglob("*.py"))

    if "pages" in entity_types:
        pages_dir = REPO_ROOT / "apps" / "web" / "app" / "(dashboard)"
        if pages_dir.exists():
            files["pages"] = [p for p in pages_dir.rglob("page.tsx")]

    if "models" in entity_types:
        models_dir = REPO_ROOT / "apps" / "backend" / "src" / "db"
        if models_dir.exists():
            files["models"] = [p for p in models_dir.glob("*_models.py")]

    if "components" in entity_types:
        components_dir = REPO_ROOT / "apps" / "web" / "components"
        if components_dir.exists():
            files["components"] = list(components_dir.rglob("*.tsx"))

    if "api-clients" in entity_types:
        api_dir = REPO_ROOT / "apps" / "web" / "lib" / "api"
        if api_dir.exists():
            files["api-clients"] = [p for p in api_dir.glob("*.ts") if p.name != "client.ts"]

    if "integrations" in entity_types:
        # Integrations are meta-docs combining config + client + routes
        integrations_dir = REPO_ROOT / "apps" / "backend" / "src" / "integrations"
        if integrations_dir.exists():
            files["integrations"] = [d for d in integrations_dir.iterdir() if d.is_dir()]

    return files


def get_current_git_commit() -> str:
    """Get current git commit hash."""
    import subprocess

    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


async def generate_vault_docs(
    entity_types: list[str],
    incremental: bool = True,
    verify_only: bool = False,
    preserve_human_content: bool = True,
) -> dict:
    """Main orchestrator - generate vault docs with frontmatter from code."""

    start_time = time.time()

    # Get files to process
    if incremental:
        files_by_type = get_changed_files_since_last_sync(entity_types)
    else:
        files_by_type = get_all_files_by_entity_type(entity_types)

    summary = {
        "synced": {},
        "created": [],
        "updated": [],
        "skipped": [],
        "errors": [],
    }

    # Process each entity type
    for entity_type in entity_types:
        if entity_type not in PARSER_MAP:
            print(f"WARNING: Unknown entity type: {entity_type}")
            continue

        parser_class = PARSER_MAP[entity_type]
        parser = parser_class(
            vault_root=VAULT_ROOT,
            repo_root=REPO_ROOT,
            preserve_human_content=preserve_human_content,
            verify_only=verify_only,
        )

        files = files_by_type.get(entity_type, [])

        print(f"\n{'[VERIFY]' if verify_only else '[SYNC]'} {entity_type.upper()}: {len(files)} files")

        for file_path in files:
            try:
                result = await parser.parse_and_generate(file_path)

                if verify_only:
                    print(f"  OK Would generate: {result['output_file']}")
                    summary["skipped"].append(str(result["output_file"]))
                elif result["action"] == "created":
                    print(f"  OK Created: {result['output_file']}")
                    summary["created"].append(str(result["output_file"]))
                elif result["action"] == "updated":
                    print(f"  OK Updated: {result['output_file']}")
                    summary["updated"].append(str(result["output_file"]))
                else:
                    summary["skipped"].append(str(result["output_file"]))

            except Exception as e:
                error_msg = f"{entity_type}: {file_path.name} - {str(e)}"
                print(f"  ERROR Error: {error_msg}")
                summary["errors"].append(error_msg)

        summary["synced"][entity_type] = len(files)

    duration_ms = int((time.time() - start_time) * 1000)
    summary["duration_ms"] = duration_ms

    # Update last sync metadata (unless verify-only)
    if not verify_only:
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        with open(LAST_SYNC_FILE, "w") as f:
            json.dump({
                "last_commit_hash": get_current_git_commit(),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "entity_types": entity_types,
                "incremental": incremental,
                "summary": summary,
            }, f, indent=2)

    return summary


@click.command()
@click.option(
    "--entity-types",
    default="routes,pages,models",
    help="Comma-separated entity types to sync (routes,pages,models,components,api-clients,integrations,all)",
)
@click.option(
    "--incremental/--full",
    default=True,
    help="Incremental sync (git diff) or full scan",
)
@click.option(
    "--verify-only",
    is_flag=True,
    help="Dry-run mode - show what would be generated without writing files",
)
@click.option(
    "--no-preserve",
    is_flag=True,
    help="Do NOT preserve HUMAN-CURATED content blocks (dangerous)",
)
def main(entity_types: str, incremental: bool, verify_only: bool, no_preserve: bool):
    """Generate Obsidian vault documentation from codebase."""

    # Parse entity types
    if entity_types == "all":
        types = list(PARSER_MAP.keys())
    else:
        types = [t.strip() for t in entity_types.split(",")]

    # Validate entity types
    invalid = [t for t in types if t not in PARSER_MAP]
    if invalid:
        print(f"ERROR: Invalid entity types: {', '.join(invalid)}")
        print(f"Valid types: {', '.join(PARSER_MAP.keys())}, all")
        sys.exit(1)

    print(f"Vault Generator")
    print(f"  Entity types: {', '.join(types)}")
    print(f"  Mode: {'Incremental (git diff)' if incremental else 'Full scan'}")
    print(f"  Preserve human content: {not no_preserve}")
    print(f"  Verify only: {verify_only}")

    # Run generator
    summary = asyncio.run(generate_vault_docs(
        entity_types=types,
        incremental=incremental,
        verify_only=verify_only,
        preserve_human_content=not no_preserve,
    ))

    # Print summary
    print(f"\n{'='*60}")
    print(f"{'VERIFICATION SUMMARY' if verify_only else 'SYNC SUMMARY'}")
    print(f"{'='*60}")

    for entity_type, count in summary["synced"].items():
        print(f"  {entity_type}: {count} files")

    if not verify_only:
        print(f"\n  Created: {len(summary['created'])} files")
        print(f"  Updated: {len(summary['updated'])} files")

    print(f"  Skipped: {len(summary['skipped'])} files")

    if summary["errors"]:
        print(f"\n  ERRORS: {len(summary['errors'])}")
        for error in summary["errors"][:5]:  # Show first 5
            print(f"    - {error}")

    print(f"\n  Duration: {summary['duration_ms']}ms")
    print(f"{'='*60}")

    sys.exit(1 if summary["errors"] else 0)


if __name__ == "__main__":
    main()
