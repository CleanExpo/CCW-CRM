"""Route parser - Extract metadata from FastAPI route files using AST."""

import ast
from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class RouteParser(BaseParser):
    """Parse FastAPI route files to extract endpoint metadata."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.routes_dir = self.vault_root / "routes"
        self.backend_routes = self.repo_root / "apps" / "backend" / "src" / "api" / "routes"

    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse route file and generate vault markdown doc."""

        # Extract metadata from Python file using AST
        metadata = self._extract_route_metadata(file_path)

        # Generate frontmatter
        frontmatter = self.format_frontmatter({
            "type": "route",
            "id": metadata["id"],
            "file": str(metadata["file"].relative_to(self.repo_root)).replace("\\", "/"),
            "prefix": metadata["prefix"],
            "domain": metadata["domain"],
            "auth": metadata["auth"],
            "status": metadata["status"],
            "endpoint_count": metadata["endpoint_count"],
            "registered": metadata["registered"],
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

## Architecture Notes

Add notes about design decisions, gotchas, or special considerations here.

## Testing Notes

Add notes about test coverage, edge cases, or manual testing steps here.

## Known Issues

Document any known issues, TODOs, or technical debt here.

<!-- END HUMAN-CURATED -->

## Related Pages

{self._format_related_pages(metadata['links'])}

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated from code | vault-generator.py |
"""

        # Output path
        output_path = self.routes_dir / f"{metadata['id']}-{metadata['slug']}.md"

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

    def _extract_route_metadata(self, file_path: Path) -> dict[str, Any]:
        """Extract metadata from route file using AST."""

        with open(file_path, encoding="utf-8") as f:
            source_code = f.read()

        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            # Fallback for unparseable files
            return self._fallback_metadata(file_path)

        # Find router definition
        router_prefix = self._find_router_prefix(tree)

        # Find all endpoint decorators
        endpoints = self._find_endpoints(tree)

        # Infer domain from file path
        domain = self._infer_domain(file_path)

        # Check registration in main.py
        registered = self._check_registration(file_path)

        # Generate ID and slug
        route_id, slug = self._generate_id_and_slug(file_path)

        # Infer auth type
        auth = self._infer_auth_type(endpoints, source_code)

        # Extract docstring as description
        description = self._extract_module_docstring(tree) or f"API endpoints for {slug.replace('-', ' ')}"

        return {
            "id": route_id,
            "slug": slug,
            "name": self._format_name(slug),
            "file": file_path,
            "prefix": router_prefix,
            "domain": domain,
            "auth": auth,
            "status": "Active" if registered else "Unregistered",
            "endpoint_count": len(endpoints),
            "registered": registered,
            "endpoints": endpoints,
            "description": description,
            "links": [],  # Will be populated by cross-ref analysis later
        }

    def _find_router_prefix(self, tree: ast.AST) -> str:
        """Find APIRouter prefix from assignments."""
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "router":
                        if isinstance(node.value, ast.Call):
                            for keyword in node.value.keywords:
                                if keyword.arg == "prefix":
                                    if isinstance(keyword.value, ast.Constant):
                                        return keyword.value.value

        return "/api"  # Default prefix

    def _find_endpoints(self, tree: ast.AST) -> list[dict[str, Any]]:
        """Find all endpoint decorators (@router.get, @router.post, etc.)."""
        endpoints = []

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Some AST nodes might not have decorators attribute
                if not hasattr(node, 'decorator_list'):
                    continue

                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Call):
                        if isinstance(decorator.func, ast.Attribute):
                            if isinstance(decorator.func.value, ast.Name) and decorator.func.value.id == "router":
                                method = decorator.func.attr.upper()
                                path = "/"

                                if decorator.args:
                                    if isinstance(decorator.args[0], ast.Constant):
                                        path = decorator.args[0].value

                                endpoints.append({
                                    "method": method,
                                    "path": path,
                                    "function": node.name,
                                    "docstring": ast.get_docstring(node) or "",
                                })

        return endpoints

    def _infer_domain(self, file_path: Path) -> str:
        """Infer domain from file path and name."""
        path_str = str(file_path).lower()
        name = file_path.stem.lower()

        # Check for known domains
        if any(x in path_str for x in ["health", "demo_health"]):
            return "Infrastructure"
        if any(x in path_str for x in ["customer", "contact", "crm", "activity"]):
            return "CRM"
        if any(x in path_str for x in ["inventory", "product", "stock", "warehouse"]):
            return "Inventory"
        if any(x in path_str for x in ["order", "quote", "invoice", "purchase"]):
            return "Orders"
        if any(x in path_str for x in ["billing", "payment", "accounting", "financial"]):
            return "Financial"
        if any(x in path_str for x in ["integration", "cin7", "xero", "shopify", "ap2"]):
            return "Integration"
        if any(x in path_str for x in ["analytics", "report", "dashboard", "metric"]):
            return "Analytics"
        if any(x in path_str for x in ["ai", "agent", "forecast", "anomaly"]):
            return "AI"

        return "Other"

    def _check_registration(self, file_path: Path) -> bool:
        """Check if route is registered in main.py."""
        main_py = self.repo_root / "apps" / "backend" / "src" / "api" / "main.py"

        if not main_py.exists():
            return False

        with open(main_py, encoding="utf-8") as f:
            main_content = f.read()

        # Check for import and include_router
        route_module = file_path.stem
        return route_module in main_content and "include_router" in main_content

    def _generate_id_and_slug(self, file_path: Path) -> tuple[str, str]:
        """Generate ROUTE-NNN ID and slug from file path."""

        # Slug from filename
        slug = file_path.stem.replace("demo_", "").replace("_", "-")

        # ID from catalog (simplified - just use sequential)
        # In production, this would read docs/catalogs/ROUTES.md to get next ID
        route_id = "ROUTE-XXX"  # Placeholder - will be assigned during full catalog sync

        return route_id, slug

    def _infer_auth_type(self, endpoints: list[dict], source_code: str) -> str:
        """Infer authentication type from endpoints."""

        # Check for Depends(get_current_user) or similar
        if "get_current_user" in source_code or "Depends(get_async_db)" in source_code:
            return "JWT"

        # Check for API key patterns
        if "api_key" in source_code.lower() or "x-api-key" in source_code.lower():
            return "API-Key"

        # Check if /health or public endpoint
        for endpoint in endpoints:
            if "health" in endpoint["path"] or endpoint["path"] == "/":
                return "Public"

        return "JWT"  # Default

    def _extract_module_docstring(self, tree: ast.AST) -> str | None:
        """Extract module-level docstring."""
        return ast.get_docstring(tree)

    def _format_name(self, slug: str) -> str:
        """Format slug to title case name."""
        return " ".join(word.capitalize() for word in slug.split("-"))

    def _generate_auto_content(self, metadata: dict[str, Any]) -> str:
        """Generate AUTO-GENERATED section content."""

        endpoints_md = "## Endpoints\n\n"

        for endpoint in metadata["endpoints"]:
            full_path = f"{metadata['prefix']}{endpoint['path']}"
            endpoints_md += f"### {endpoint['method']} {full_path}\n"
            endpoints_md += f"**Purpose**: {endpoint['docstring'] or 'Endpoint description'}\n\n"
            endpoints_md += "**Request Parameters**: See code\n\n"
            endpoints_md += "**Response**: See code\n\n"
            endpoints_md += f"**Authentication**: {metadata['auth']}\n\n"

        endpoints_md += "\n## Database Models Used\n\nSee code for model references\n\n"
        endpoints_md += "## Dependencies\n\n- External APIs: None\n- Internal services: Database\n- Background tasks: None\n"

        return endpoints_md

    def _format_related_pages(self, links: list[str]) -> str:
        """Format related pages links."""
        if not links:
            return "No related pages yet"

        return "\n".join([f"- {link}" for link in links])

    def _fallback_metadata(self, file_path: Path) -> dict[str, Any]:
        """Fallback metadata when AST parsing fails."""
        route_id, slug = self._generate_id_and_slug(file_path)

        return {
            "id": route_id,
            "slug": slug,
            "name": self._format_name(slug),
            "file": file_path,
            "prefix": "/api",
            "domain": self._infer_domain(file_path),
            "auth": "JWT",
            "status": "Active",
            "endpoint_count": 0,
            "registered": False,
            "endpoints": [],
            "description": f"Route file: {file_path.name}",
            "links": [],
        }
