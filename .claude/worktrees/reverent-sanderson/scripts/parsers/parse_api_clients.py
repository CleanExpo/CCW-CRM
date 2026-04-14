"""API client parser - Extract metadata from frontend API client files."""

import re
from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class ApiClientParser(BaseParser):
    """Parse frontend API client .ts files."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.clients_dir = self.vault_root / "api-clients"
        self.web_api = self.repo_root / "apps" / "web" / "lib" / "api"

    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse API client file and generate vault markdown doc."""

        metadata = self._extract_client_metadata(file_path)

        frontmatter = self.format_frontmatter({
            "type": "api-client",
            "id": metadata["id"],
            "file": str(metadata["file"].relative_to(self.repo_root)).replace("\\", "/"),
            "module": metadata["module"],
            "exports": metadata["exports"],
            "status": "Active",
            "links": [],
            "last_verified": self.today,
        })

        auto_content = f"""## Exported API

**File**: `{metadata['file'].relative_to(self.repo_root)}`

**Export**: `{metadata['exports']}`

**Methods**: See TypeScript definitions in code

## Type Definitions

See TypeScript interfaces in code

## Used By Pages

Cross-reference TBD
"""

        new_content = f"""---
{frontmatter}
---

# {metadata['id']}: {metadata['name']} API Client

## Overview

{metadata['description']}

<!-- AUTO-GENERATED -->

{auto_content}

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Usage Guidelines

Standard usage patterns for this API client

## Error Handling

Error handling strategy

## Known Issues

Document known issues or limitations

<!-- END HUMAN-CURATED -->

## Backend Mapping

See code for backend route mappings

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated | vault-generator.py |
"""

        self.clients_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.clients_dir / f"{metadata['id']}-{metadata['slug']}.md"
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

    def _extract_client_metadata(self, file_path: Path) -> dict[str, Any]:
        """Extract API client metadata."""

        with open(file_path, encoding="utf-8") as f:
            source_code = f.read()

        module = file_path.stem
        slug = module.lower().replace("_", "-")

        # Find exported API object (e.g., productsApi, customersApi)
        export_pattern = r"export\s+const\s+(\w+Api)\s*="
        match = re.search(export_pattern, source_code)
        exports = match.group(1) if match else f"{module}Api"

        return {
            "id": f"CLIENT-XXX",
            "slug": slug,
            "name": module.capitalize(),
            "file": file_path,
            "module": module,
            "exports": exports,
            "description": f"Frontend API client for {module} endpoints",
        }
