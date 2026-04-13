#!/usr/bin/env python3
"""
Vault audit script - Detect documentation drift.

Usage:
    python scripts/audit-vault.py
    python scripts/audit-vault.py --strict  (exit code 1 if drift found)
"""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
VAULT_ROOT = REPO_ROOT / ".obsidian-vault"

# Entity type configurations
ENTITY_CONFIGS = {
    "routes": {
        "vault_dir": VAULT_ROOT / "routes",
        "source_dir": REPO_ROOT / "apps" / "backend" / "src" / "api" / "routes",
        "source_pattern": "*.py",
    },
    "pages": {
        "vault_dir": VAULT_ROOT / "pages",
        "source_dir": REPO_ROOT / "apps" / "web" / "app" / "(dashboard)",
        "source_pattern": "**/page.tsx",
    },
    "models": {
        "vault_dir": VAULT_ROOT / "models",
        "source_dir": REPO_ROOT / "apps" / "backend" / "src" / "db",
        "source_pattern": "*_models.py",
    },
}


def extract_file_path(vault_doc: Path) -> Path | None:
    """Extract source file path from vault doc frontmatter."""
    try:
        content = vault_doc.read_text(encoding="utf-8")
        match = re.search(r"^file:\s*(.+)$", content, re.MULTILINE)
        if match:
            file_path_str = match.group(1).strip().strip('"').strip("'")
            # Convert forward slashes to backslashes for Windows
            return REPO_ROOT / file_path_str.replace("/", "\\")
    except Exception:
        pass
    return None


def extract_last_verified(vault_doc: Path) -> datetime | None:
    """Extract last_verified date from vault doc frontmatter."""
    try:
        content = vault_doc.read_text(encoding="utf-8")
        match = re.search(r"^last_verified:\s*(\d{4}-\d{2}-\d{2})$", content, re.MULTILINE)
        if match:
            return datetime.strptime(match.group(1), "%Y-%m-%d")
    except Exception:
        pass
    return None


def audit_entity_type(entity_type: str, config: dict) -> dict:
    """Audit a single entity type (routes, pages, or models)."""
    vault_dir = config["vault_dir"]
    source_dir = config["source_dir"]
    source_pattern = config["source_pattern"]

    ghost_entries = []
    undocumented = []
    stale = []

    # Check vault docs for ghosts and stale entries
    if vault_dir.exists():
        for vault_doc in vault_dir.glob("*.md"):
            # Ghost check: vault doc exists but source file missing
            file_path = extract_file_path(vault_doc)
            if file_path and not file_path.exists():
                ghost_entries.append({
                    "vault_doc": str(vault_doc.relative_to(VAULT_ROOT)),
                    "source_file": str(file_path.relative_to(REPO_ROOT)),
                })

            # Stale check: last_verified > 30 days ago
            last_verified = extract_last_verified(vault_doc)
            if last_verified:
                days_ago = (datetime.now() - last_verified).days
                if days_ago > 30:
                    stale.append({
                        "vault_doc": str(vault_doc.relative_to(VAULT_ROOT)),
                        "days_ago": days_ago,
                    })

    # Check source files for undocumented entries
    if source_dir.exists():
        if "**" in source_pattern:
            source_files = list(source_dir.rglob(source_pattern.replace("**/", "")))
        else:
            source_files = list(source_dir.glob(source_pattern))

        for source_file in source_files:
            # Skip private files
            if source_file.name.startswith("_") or source_file.name.startswith("."):
                continue

            # Check if vault doc exists (simplified check by filename)
            # More sophisticated matching would parse frontmatter from all vault docs
            has_vault_doc = False
            if vault_dir.exists():
                for vault_doc in vault_dir.glob("*.md"):
                    file_path = extract_file_path(vault_doc)
                    if file_path and file_path == source_file:
                        has_vault_doc = True
                        break

            if not has_vault_doc:
                undocumented.append({
                    "source_file": str(source_file.relative_to(REPO_ROOT)),
                })

    return {
        "ghost_entries": ghost_entries,
        "undocumented": undocumented,
        "stale": stale,
    }


def print_audit_report(results: dict):
    """Print formatted audit report."""
    total_issues = sum(
        len(entity_results["ghost_entries"]) +
        len(entity_results["undocumented"]) +
        len(entity_results["stale"])
        for entity_results in results.values()
    )

    print("=" * 70)
    print("VAULT AUDIT REPORT")
    print("=" * 70)

    for entity_type, entity_results in results.items():
        print(f"\n{entity_type.upper()}:")

        if entity_results["ghost_entries"]:
            print(f"\n  Ghost Entries ({len(entity_results['ghost_entries'])}):")
            print("  (Documented but source file missing)")
            for item in entity_results["ghost_entries"][:10]:
                print(f"    - {item['vault_doc']}")
                print(f"      Source: {item['source_file']} (missing)")
            if len(entity_results["ghost_entries"]) > 10:
                print(f"    ... and {len(entity_results['ghost_entries']) - 10} more")

        if entity_results["undocumented"]:
            print(f"\n  Undocumented ({len(entity_results['undocumented'])}):")
            print("  (Source file exists but no vault doc)")
            for item in entity_results["undocumented"][:10]:
                print(f"    - {item['source_file']}")
            if len(entity_results["undocumented"]) > 10:
                print(f"    ... and {len(entity_results['undocumented']) - 10} more")

        if entity_results["stale"]:
            print(f"\n  Stale Documentation ({len(entity_results['stale'])}):")
            print("  (Not verified in 30+ days)")
            for item in entity_results["stale"][:10]:
                print(f"    - {item['vault_doc']} ({item['days_ago']} days ago)")
            if len(entity_results["stale"]) > 10:
                print(f"    ... and {len(entity_results['stale']) - 10} more")

    print("\n" + "=" * 70)
    print(f"TOTAL ISSUES: {total_issues}")
    print("=" * 70)

    if total_issues > 0:
        print("\nSUGGESTED ACTION:")
        print("  Run: /sync-vault all --full")
        print("  Or: python scripts/vault-generator.py --entity-types all --full")

    return total_issues


def main():
    parser = argparse.ArgumentParser(description="Audit Obsidian vault for drift")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 if any drift found (for pre-commit hook)",
    )
    args = parser.parse_args()

    # Audit each entity type
    results = {}
    for entity_type, config in ENTITY_CONFIGS.items():
        results[entity_type] = audit_entity_type(entity_type, config)

    # Print report
    total_issues = print_audit_report(results)

    # Exit with appropriate code
    if args.strict and total_issues > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
