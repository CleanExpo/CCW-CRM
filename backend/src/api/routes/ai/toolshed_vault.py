"""Vault endpoints for toolshed API - separated for clarity."""
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

REPO_ROOT = Path(__file__).parents[6]
VAULT_ROOT = REPO_ROOT / ".obsidian-vault"
MEMORY_DIR = REPO_ROOT / ".claude" / "memory"
LAST_SYNC_FILE = MEMORY_DIR / "last-vault-sync.json"


async def sync_vault(
    entity_types: list[str],
    incremental: bool,
    verify_only: bool,
) -> dict:
    """Run vault-generator.py script to sync vault with codebase."""

    # Validate entity types
    valid_types = {"routes", "pages", "models", "components", "api-clients", "integrations", "all"}
    invalid = [t for t in entity_types if t not in valid_types]
    if invalid:
        return {
            "synced": {},
            "created": [],
            "updated": [],
            "skipped": [],
            "errors": [f"Invalid entity types: {', '.join(invalid)}"],
            "duration_ms": 0,
        }

    # Build command
    cmd = [
        "python",
        str(REPO_ROOT / "scripts" / "vault-generator.py"),
        "--entity-types", ",".join(entity_types),
    ]

    if not incremental:
        cmd.append("--full")

    if verify_only:
        cmd.append("--verify-only")

    logger.info("Running vault generator", cmd=" ".join(cmd))

    try:
        # Run vault-generator.py
        proc = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )

        # Parse output (script prints summary JSON)
        output_lines = proc.stdout.strip().split("\n")

        # Look for summary in last-vault-sync.json
        if LAST_SYNC_FILE.exists() and not verify_only:
            with open(LAST_SYNC_FILE) as f:
                sync_data = json.load(f)
                return sync_data.get("summary", {
                    "synced": {},
                    "created": [],
                    "updated": [],
                    "skipped": [],
                    "errors": [],
                    "duration_ms": 0,
                })

        # Fallback: parse output manually
        return {
            "synced": {t: 0 for t in entity_types},
            "created": [],
            "updated": [],
            "skipped": [],
            "errors": [proc.stderr] if proc.returncode != 0 else [],
            "duration_ms": 0,
        }

    except subprocess.TimeoutExpired:
        logger.error("Vault sync timeout")
        return {
            "synced": {},
            "created": [],
            "updated": [],
            "skipped": [],
            "errors": ["Timeout after 120 seconds"],
            "duration_ms": 120000,
        }
    except Exception as e:
        logger.error("Vault sync error", error=str(e))
        return {
            "synced": {},
            "created": [],
            "updated": [],
            "skipped": [],
            "errors": [str(e)],
            "duration_ms": 0,
        }


def detect_vault_drift() -> dict:
    """Detect documentation drift by comparing vault docs vs filesystem."""

    import re

    drift_items = {
        "ghost_entries": [],
        "undocumented": [],
        "stale": [],
        "broken_links": [],
    }

    # Check routes
    routes_vault = VAULT_ROOT / "routes"
    routes_backend = REPO_ROOT / "apps" / "backend" / "src" / "api" / "routes"

    if routes_vault.exists():
        for vault_doc in routes_vault.glob("*.md"):
            # Extract file path from frontmatter
            content = vault_doc.read_text(encoding="utf-8")
            file_match = re.search(r"^file: (.+)$", content, re.MULTILINE)

            if file_match:
                file_path = REPO_ROOT / file_match.group(1).replace("/", "\\")
                if not file_path.exists():
                    drift_items["ghost_entries"].append({
                        "type": "ghost",
                        "entity_type": "routes",
                        "file_path": str(file_path.relative_to(REPO_ROOT)),
                        "vault_doc": str(vault_doc.relative_to(VAULT_ROOT)),
                        "reason": "Vault doc exists but source file missing",
                    })

            # Check last_verified date
            date_match = re.search(r"^last_verified: (\d{4}-\d{2}-\d{2})$", content, re.MULTILINE)
            if date_match:
                last_verified = datetime.strptime(date_match.group(1), "%Y-%m-%d")
                if datetime.now() - last_verified > timedelta(days=30):
                    drift_items["stale"].append({
                        "type": "stale",
                        "entity_type": "routes",
                        "file_path": None,
                        "vault_doc": str(vault_doc.relative_to(VAULT_ROOT)),
                        "reason": f"Not verified in {(datetime.now() - last_verified).days} days",
                    })

    # Check for undocumented routes
    if routes_backend.exists():
        for route_file in routes_backend.rglob("*.py"):
            if route_file.name.startswith("_"):
                continue

            # Check if vault doc exists
            # (Simplified - would need to match by slug, not exact filename)
            vault_doc_exists = any(
                route_file.stem in vault_doc.name
                for vault_doc in routes_vault.glob("*.md")
            ) if routes_vault.exists() else False

            if not vault_doc_exists:
                drift_items["undocumented"].append({
                    "type": "undocumented",
                    "entity_type": "routes",
                    "file_path": str(route_file.relative_to(REPO_ROOT)),
                    "vault_doc": None,
                    "reason": "Source file exists but no vault doc",
                })

    # Summary
    total_issues = (
        len(drift_items["ghost_entries"]) +
        len(drift_items["undocumented"]) +
        len(drift_items["stale"]) +
        len(drift_items["broken_links"])
    )

    summary = f"Found {total_issues} drift issues: "
    summary += f"{len(drift_items['ghost_entries'])} ghost, "
    summary += f"{len(drift_items['undocumented'])} undocumented, "
    summary += f"{len(drift_items['stale'])} stale, "
    summary += f"{len(drift_items['broken_links'])} broken links"

    return {
        **drift_items,
        "summary": summary,
    }


def query_vault(query: str, entity_type: str | None, linked_to: str | None) -> dict:
    """Query vault frontmatter metadata (simple Dataview-style queries)."""

    import re

    results = []

    # Determine which directories to search
    entity_dirs = []
    if entity_type:
        entity_dirs = [VAULT_ROOT / entity_type]
    else:
        entity_dirs = [
            VAULT_ROOT / "routes",
            VAULT_ROOT / "pages",
            VAULT_ROOT / "models",
            VAULT_ROOT / "components",
        ]

    for entity_dir in entity_dirs:
        if not entity_dir.exists():
            continue

        for doc_path in entity_dir.glob("*.md"):
            try:
                content = doc_path.read_text(encoding="utf-8")

                # Extract frontmatter
                frontmatter_match = re.search(r"^---\n(.+?)\n---", content, re.DOTALL | re.MULTILINE)
                if not frontmatter_match:
                    continue

                frontmatter_text = frontmatter_match.group(1)

                # Simple query evaluation (exact field match)
                # Example: "domain = CRM" or "status = Active"
                query_match = re.match(r"(\w+)\s*=\s*(.+)", query.strip())
                if query_match:
                    field, value = query_match.groups()
                    value = value.strip()

                    # Check if field matches value in frontmatter
                    field_pattern = rf"^{field}:\s*(.+)$"
                    field_match = re.search(field_pattern, frontmatter_text, re.MULTILINE)

                    if field_match and value.lower() in field_match.group(1).lower():
                        # Parse frontmatter into dict
                        frontmatter_dict = {}
                        for line in frontmatter_text.split("\n"):
                            if ":" in line:
                                key, val = line.split(":", 1)
                                frontmatter_dict[key.strip()] = val.strip()

                        results.append({
                            "doc_path": str(doc_path.relative_to(VAULT_ROOT)),
                            "frontmatter": frontmatter_dict,
                        })

                # Check linked_to filter
                if linked_to:
                    if f"[[{linked_to}]]" in content:
                        frontmatter_dict = {}
                        for line in frontmatter_text.split("\n"):
                            if ":" in line:
                                key, val = line.split(":", 1)
                                frontmatter_dict[key.strip()] = val.strip()

                        results.append({
                            "doc_path": str(doc_path.relative_to(VAULT_ROOT)),
                            "frontmatter": frontmatter_dict,
                        })

            except Exception as e:
                logger.warning("Error parsing vault doc", doc=str(doc_path), error=str(e))
                continue

    return {
        "results": results,
        "count": len(results),
    }
