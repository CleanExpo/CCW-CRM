"""Integration parser - Generate integration overview docs."""

from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class IntegrationParser(BaseParser):
    """Parse integration directories to generate overview docs."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.integrations_dir = self.vault_root / "integrations"
        self.backend_integrations = self.repo_root / "apps" / "backend" / "src" / "integrations"

    async def parse_and_generate(self, dir_path: Path) -> dict[str, Any]:
        """Parse integration directory and generate vault markdown doc."""

        metadata = self._extract_integration_metadata(dir_path)

        frontmatter = self.format_frontmatter({
            "type": "integration",
            "id": metadata["id"],
            "name": metadata["name"],
            "provider": metadata["provider"],
            "status": "Active",
            "config_file": metadata["config_file"],
            "client_file": metadata["client_file"],
            "models_file": metadata["models_file"],
            "routes_prefix": metadata["routes_prefix"],
            "links": [],
            "last_verified": self.today,
        })

        auto_content = f"""## Architecture

**Pattern**: Settings → Client (demo/live) → Routes → Frontend

## Configuration

**File**: `{metadata['config_file']}`

See configuration class in code

## Client Implementation

**File**: `{metadata['client_file']}`

See client class in code

## Database Models

**File**: `{metadata['models_file']}`

See model definitions in code

## API Routes

**Prefix**: `{metadata['routes_prefix']}`

See route definitions in code
"""

        new_content = f"""---
{frontmatter}
---

# {metadata['id']}: {metadata['name']}

## Overview

{metadata['description']}

<!-- AUTO-GENERATED -->

{auto_content}

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Setup Guide

Integration setup instructions

## Sync Workflow

Manual and webhook sync workflows

## Known Issues

Document known issues or limitations

<!-- END HUMAN-CURATED -->

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated | vault-generator.py |
"""

        self.integrations_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.integrations_dir / f"{metadata['id']}-{metadata['slug']}.md"
        existing_content = self.read_existing_file(output_path)

        if existing_content:
            final_content = self.merge_auto_and_human(existing_content, frontmatter, new_content)
        else:
            final_content = new_content

        action = self.write_vault_file(output_path, final_content)

        return {
            "output_file": output_path.relative_to(self.vault_root),
            "action": action,
            "metadata": metadata,
        }

    def _extract_integration_metadata(self, dir_path: Path) -> dict[str, Any]:
        """Extract integration metadata from directory."""

        name = dir_path.name.capitalize()
        slug = dir_path.name.lower()

        # Detect provider
        provider_map = {
            "cin7": "Cin7",
            "xero": "Xero",
            "shopify": "Shopify",
            "ap2": "AP2",
            "stripe": "Stripe",
        }
        provider = provider_map.get(slug, "Other")

        # Expected file locations
        config_file = f"apps/backend/src/config/{slug}_settings.py"
        client_file = f"apps/backend/src/integrations/{slug}/client.py"
        models_file = f"apps/backend/src/db/{slug}_models.py"
        routes_prefix = f"/api/integrations/{slug}"

        return {
            "id": f"INTEGRATION-XXX",
            "slug": slug,
            "name": name,
            "provider": provider,
            "config_file": config_file,
            "client_file": client_file,
            "models_file": models_file,
            "routes_prefix": routes_prefix,
            "description": f"{name} integration for CCW-ERP-CRM",
        }
