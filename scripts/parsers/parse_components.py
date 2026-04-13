"""Component parser - Extract metadata from React component files."""

from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class ComponentParser(BaseParser):
    """Parse React component .tsx files."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.components_dir = self.vault_root / "components"
        self.web_components = self.repo_root / "apps" / "web" / "components"

    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse component file and generate vault markdown doc."""

        metadata = self._extract_component_metadata(file_path)

        frontmatter = self.format_frontmatter({
            "type": "component",
            "id": metadata["id"],
            "file": str(metadata["file"].relative_to(self.repo_root)).replace("\\", "/"),
            "category": metadata["category"],
            "reusable": metadata["reusable"],
            "reference_pattern": metadata["reference_pattern"],
            "status": "Active",
            "links": [],
            "last_verified": self.today,
        })

        auto_content = f"""## Component API

**File**: `{metadata['file'].relative_to(self.repo_root)}`

**Props**: See TypeScript interface in code

**Example Usage**: See component documentation

## Dependencies

See imports in code

## State Management

- Local state via React hooks
- Form state: React Hook Form (if applicable)

## Used By Pages

Cross-reference TBD
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

## Design Decisions

Document component design rationale

## Usage Guidelines

When to use this component

## Known Issues

Document any known issues or TODOs

<!-- END HUMAN-CURATED -->

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated | vault-generator.py |
"""

        output_path = self.components_dir / f"{metadata['id']}-{metadata['slug']}.md"
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

    def _extract_component_metadata(self, file_path: Path) -> dict[str, Any]:
        """Extract component metadata."""

        with open(file_path, encoding="utf-8") as f:
            source_code = f.read()

        name = file_path.stem
        slug = name.lower().replace("_", "-")

        # Infer category
        category = self._infer_category(file_path)

        # Check if reusable (in ui/ or shared/)
        reusable = "ui/" in str(file_path) or "shared/" in str(file_path)

        # Check if reference pattern (login-form.tsx is the reference)
        reference_pattern = file_path.name == "login-form.tsx"

        return {
            "id": "COMPONENT-XXX",
            "slug": slug,
            "name": name,
            "file": file_path,
            "category": category,
            "reusable": reusable,
            "reference_pattern": reference_pattern,
            "description": f"React component: {name}",
        }

    def _infer_category(self, file_path: Path) -> str:
        """Infer component category."""
        path_str = str(file_path).lower()

        if "/ui/" in path_str:
            return "ui"
        if "/forms/" in path_str or "/auth/" in path_str:
            return "forms"
        if "/layout/" in path_str:
            return "layout"
        if "/dashboard/" in path_str:
            return "dashboard"

        return "domain-specific"
