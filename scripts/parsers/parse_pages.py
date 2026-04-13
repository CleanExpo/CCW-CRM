"""Page parser - Extract metadata from Next.js page.tsx files."""

import re
from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class PageParser(BaseParser):
    """Parse Next.js page.tsx files to extract metadata."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages_dir = self.vault_root / "pages"
        self.web_pages = self.repo_root / "apps" / "web" / "app" / "(dashboard)"

    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse page.tsx file and generate vault markdown doc."""

        # Extract metadata from TypeScript file
        metadata = self._extract_page_metadata(file_path)

        # Generate frontmatter
        frontmatter = self.format_frontmatter({
            "type": "page",
            "id": metadata["id"],
            "route": metadata["route"],
            "file": str(metadata["file"].relative_to(self.repo_root)).replace("\\", "/"),
            "domain": metadata["domain"],
            "in_sidebar": metadata["in_sidebar"],
            "status": metadata["status"],
            "links": metadata["links"],
            "last_verified": self.today,
        })

        # Generate auto-generated content
        auto_content = self._generate_auto_content(metadata)

        # Build full content
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

## User Experience Notes

Add notes about UX decisions, user feedback, or design rationale here.

## Performance Considerations

Document any performance optimizations, lazy loading, or caching strategies.

## Accessibility

Note any WCAG compliance considerations or keyboard navigation patterns.

## Known Issues

Document any UI bugs, browser compatibility issues, or TODOs.

<!-- END HUMAN-CURATED -->

## Data Flow

```
User Action
  ↓
Component State Update
  ↓
API Call via apiClient
  ↓
Backend Route
  ↓
Database Query
  ↓
Response
  ↓
UI Update
```

## Related Pages

{self._format_related_pages(metadata.get('related_pages', []))}

## Screenshots

Add screenshots or link to Figma designs here.

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated from code | vault-generator.py |
"""

        # Output path
        output_path = self.pages_dir / f"{metadata['id']}-{metadata['slug']}.md"

        # Read existing file
        existing_content = self.read_existing_file(output_path)

        # Merge with human-curated content if exists
        if existing_content:
            final_content = self.merge_auto_and_human(existing_content, frontmatter, new_content)
        else:
            final_content = new_content

        # Write file
        action = self.write_vault_file(output_path, final_content)

        return {
            "output_file": output_path.relative_to(self.vault_root),
            "action": action,
            "metadata": metadata,
        }

    def _extract_page_metadata(self, file_path: Path) -> dict[str, Any]:
        """Extract metadata from page.tsx file."""

        with open(file_path, encoding="utf-8") as f:
            source_code = f.read()

        # Generate route path from file structure
        route = self._infer_route_path(file_path)

        # Infer domain
        domain = self._infer_domain(file_path)

        # Check if in sidebar
        in_sidebar = self._check_sidebar_presence(file_path)

        # Generate ID and slug
        page_id, slug = self._generate_id_and_slug(file_path)

        # Find API calls
        api_calls = self._find_api_calls(source_code)

        # Find components used
        components = self._find_components_used(source_code)

        # Extract title/description
        title = self._extract_title(source_code, file_path)
        description = f"Page at {route}"

        return {
            "id": page_id,
            "slug": slug,
            "name": title,
            "file": file_path,
            "route": route,
            "domain": domain,
            "in_sidebar": in_sidebar,
            "status": "Active",
            "api_calls": api_calls,
            "components": components,
            "description": description,
            "links": [],  # Will be populated by cross-ref
            "related_pages": [],
        }

    def _infer_route_path(self, file_path: Path) -> str:
        """Infer URL route from file path."""

        # Get relative path from (dashboard) directory
        rel_path = file_path.relative_to(self.web_pages)

        # Remove page.tsx and convert to route
        parts = rel_path.parts[:-1]  # Remove page.tsx

        if not parts:
            return "/dashboard"

        route = "/dashboard/" + "/".join(parts)
        return route

    def _infer_domain(self, file_path: Path) -> str:
        """Infer domain from file path."""
        path_str = str(file_path).lower()

        if any(x in path_str for x in ["customer", "contact", "crm", "activity"]):
            return "CRM"
        if any(x in path_str for x in ["inventory", "product", "stock", "warehouse"]):
            return "Inventory"
        if any(x in path_str for x in ["order", "quote", "invoice", "purchase"]):
            return "Orders"
        if any(x in path_str for x in ["billing", "payment", "settings/billing"]):
            return "Financial"
        if any(x in path_str for x in ["integration", "settings/integrations"]):
            return "Integrations"
        if any(x in path_str for x in ["ai", "agent", "marketing"]):
            return "AI"
        if any(x in path_str for x in ["settings", "config"]):
            return "Settings"

        if "dashboard" in path_str and file_path.stem == "page":
            return "Infrastructure"

        return "Other"

    def _check_sidebar_presence(self, file_path: Path) -> bool:
        """Check if page is in sidebar navigation."""

        # Read sidebar config
        sidebar_path = self.repo_root / "apps" / "web" / "components" / "layout" / "sidebar.tsx"

        if not sidebar_path.exists():
            return False

        with open(sidebar_path, encoding="utf-8") as f:
            sidebar_content = f.read()

        # Get route path
        route = self._infer_route_path(file_path)

        # Check if route is in sidebar
        return route in sidebar_content

    def _generate_id_and_slug(self, file_path: Path) -> tuple[str, str]:
        """Generate PAGE-NNN ID and slug from file path."""

        # Slug from directory path
        rel_path = file_path.relative_to(self.web_pages)
        parts = rel_path.parts[:-1]  # Remove page.tsx

        if not parts:
            slug = "dashboard"
        else:
            slug = "-".join(parts)

        # ID placeholder
        page_id = "PAGE-XXX"

        return page_id, slug

    def _find_api_calls(self, source_code: str) -> list[str]:
        """Find API client calls in source code."""
        api_calls = []

        # Pattern: apiClient.get/post/put/delete('/api/...')
        pattern = r"apiClient\.(get|post|put|delete)<.*?>\(['\"](/api/[^'\"]+)['\"]"
        for match in re.finditer(pattern, source_code):
            api_calls.append(f"{match.group(1).upper()} {match.group(2)}")

        # Pattern: someApi.method()
        pattern2 = r"(\w+Api)\.(\w+)\("
        for match in re.finditer(pattern2, source_code):
            api_calls.append(f"{match.group(1)}.{match.group(2)}()")

        return list(set(api_calls))  # Deduplicate

    def _find_components_used(self, source_code: str) -> list[str]:
        """Find React components imported and used."""
        components = []

        # Find imports from @/components
        pattern = r"import\s+\{([^}]+)\}\s+from\s+['\"]@/components/([^'\"]+)['\"]"
        for match in re.finditer(pattern, source_code):
            imported = [c.strip() for c in match.group(1).split(",")]
            components.extend(imported)

        return components

    def _extract_title(self, source_code: str, file_path: Path) -> str:
        """Extract page title from metadata or H1."""

        # Try to find metadata.title
        title_match = re.search(r"title:\s+['\"]([^'\"]+)['\"]", source_code)
        if title_match:
            return title_match.group(1)

        # Try to find <h1> tag
        h1_match = re.search(r"<h1[^>]*>([^<]+)</h1>", source_code)
        if h1_match:
            return h1_match.group(1)

        # Fallback to directory name
        rel_path = file_path.relative_to(self.web_pages)
        parts = rel_path.parts[:-1]
        if not parts:
            return "Dashboard"

        return " ".join(word.capitalize() for word in parts[-1].split("-"))

    def _generate_auto_content(self, metadata: dict[str, Any]) -> str:
        """Generate AUTO-GENERATED section content."""

        content = f"""## Route Information

**URL**: `{metadata['route']}`
**Layout**: Dashboard layout with sidebar
**Authentication**: Required (JWT)

## API Endpoints Used

"""

        if metadata["api_calls"]:
            for call in metadata["api_calls"]:
                content += f"- `{call}` - Purpose TBD\n"
        else:
            content += "No API calls detected\n"

        content += "\n## Components Used\n\n"

        if metadata["components"]:
            for comp in metadata["components"]:
                content += f"- `{comp}`: Purpose TBD\n"
        else:
            content += "No custom components detected\n"

        content += "\n## State Management\n\n"
        content += "- React hooks: `useState`, `useEffect`, `useRouter`\n"
        content += "- Form library: React Hook Form + Zod validation (if applicable)\n"
        content += "- Data fetching: apiClient from `@/lib/api/client`\n\n"

        content += "## Features\n\n"
        content += "See code for feature list\n"

        return content

    def _format_related_pages(self, pages: list[str]) -> str:
        """Format related pages links."""
        if not pages:
            return "No related pages yet"

        return "\n".join([f"- {page}" for page in pages])
