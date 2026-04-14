"""Model parser - Extract metadata from SQLAlchemy model files using AST."""

import ast
from pathlib import Path
from typing import Any

from scripts.parsers.base_parser import BaseParser


class ModelParser(BaseParser):
    """Parse SQLAlchemy model files to extract schema metadata."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.models_dir = self.vault_root / "models"
        self.db_models = self.repo_root / "apps" / "backend" / "src" / "db"

    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse model file and generate vault markdown doc."""

        # Extract all models from file
        models = self._extract_models_from_file(file_path)

        results = []

        # Generate doc for each model
        for model_data in models:
            result = await self._generate_model_doc(model_data, file_path)
            results.append(result)

        # Return first result (or combined result for multi-model files)
        return results[0] if results else {"output_file": "none", "action": "skipped"}

    async def _generate_model_doc(self, model_data: dict[str, Any], file_path: Path) -> dict[str, Any]:
        """Generate markdown doc for a single model."""

        # Generate frontmatter
        frontmatter = self.format_frontmatter({
            "type": "model",
            "id": model_data["id"],
            "table": model_data["table"],
            "file": str(file_path.relative_to(self.repo_root)).replace("\\", "/"),
            "schema_locked": model_data["schema_locked"],
            "relationships": model_data["relationships"],
            "links": model_data["links"],
            "last_verified": self.today,
        })

        # Generate auto-generated content
        auto_content = self._generate_auto_content(model_data)

        # Build full content
        new_content = f"""---
{frontmatter}
---

# {model_data['id']}: {model_data['name']}

## Overview

{model_data['description']}

<!-- AUTO-GENERATED -->

{auto_content}

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

{self._get_schema_warning(model_data['schema_locked'])}

Add notes about:
- Why this table structure was chosen
- Historical schema changes
- Migration considerations
- Data integrity rules

## Business Logic

Document business rules enforced at the model level:
- Validation rules
- Calculated fields
- Triggers
- Cascade behaviors

## Performance Considerations

Document:
- Query optimization strategies
- Index usage patterns
- N+1 query risks
- Caching strategies

## Known Issues

Document:
- Data quality issues
- Missing constraints
- Technical debt

<!-- END HUMAN-CURATED -->

## Integration Points

See code for integration mappings

## Sample Queries

```python
# Example queries for this model
# See code for actual usage patterns
```

## Related Models

{self._format_related_models(model_data['relationships'])}

## Change History

| Date | Change | Author |
|------|--------|--------|
| {self.today} | Auto-generated from code | vault-generator.py |
"""

        # Output path
        output_path = self.models_dir / f"{model_data['id']}-{model_data['slug']}.md"

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
            "metadata": model_data,
        }

    def _extract_models_from_file(self, file_path: Path) -> list[dict[str, Any]]:
        """Extract all model classes from file using AST."""

        with open(file_path, encoding="utf-8") as f:
            source_code = f.read()

        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            return []

        models = []

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Check if it's a SQLAlchemy model (inherits from Base)
                if self._is_model_class(node):
                    model_data = self._extract_model_metadata(node, file_path)
                    models.append(model_data)

        return models

    def _is_model_class(self, node: ast.ClassDef) -> bool:
        """Check if class is a SQLAlchemy model."""

        for base in node.bases:
            if isinstance(base, ast.Name) and base.id == "Base":
                return True

        return False

    def _extract_model_metadata(self, node: ast.ClassDef, file_path: Path) -> dict[str, Any]:
        """Extract metadata from model class."""

        class_name = node.name
        table_name = self._find_table_name(node)

        # Generate ID and slug
        model_id, slug = self._generate_id_and_slug(class_name)

        # Check if schema is locked (demo_models.py)
        schema_locked = file_path.name == "demo_models.py"

        # Extract columns
        columns = self._extract_columns(node)

        # Extract relationships
        relationships = self._extract_relationships(node)

        # Extract indexes (if defined)
        indexes = self._extract_indexes(node)

        # Description from docstring
        description = ast.get_docstring(node) or f"Database model for {table_name} table"

        return {
            "id": model_id,
            "slug": slug,
            "name": class_name,
            "table": table_name,
            "file": file_path,
            "schema_locked": schema_locked,
            "columns": columns,
            "relationships": relationships,
            "indexes": indexes,
            "description": description,
            "links": [],
        }

    def _find_table_name(self, node: ast.ClassDef) -> str:
        """Find __tablename__ attribute."""

        for item in node.body:
            if isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name) and target.id == "__tablename__":
                        if isinstance(item.value, ast.Constant):
                            return item.value.value

        # Fallback to class name in snake_case
        import re
        name = re.sub(r'(?<!^)(?=[A-Z])', '_', node.name).lower()
        return name + "s"

    def _extract_columns(self, node: ast.ClassDef) -> list[dict[str, Any]]:
        """Extract column definitions."""

        columns = []

        for item in node.body:
            if isinstance(item, ast.AnnAssign):
                if isinstance(item.target, ast.Name):
                    column_name = item.target.id

                    # Skip private attributes
                    if column_name.startswith("_"):
                        continue

                    # Get type annotation
                    column_type = self._get_type_string(item.annotation)

                    columns.append({
                        "name": column_name,
                        "type": column_type,
                        "constraints": "TBD",  # Would need more analysis
                        "description": "Column description",
                    })

        return columns

    def _get_type_string(self, annotation) -> str:
        """Convert AST type annotation to string."""

        if isinstance(annotation, ast.Name):
            return annotation.id
        elif isinstance(annotation, ast.Subscript):
            if isinstance(annotation.value, ast.Name):
                return annotation.value.id  # e.g., "Mapped"
        elif isinstance(annotation, ast.Constant):
            return str(annotation.value)

        return "Unknown"

    def _extract_relationships(self, node: ast.ClassDef) -> list[dict[str, str]]:
        """Extract relationship() calls."""

        relationships = []

        for item in node.body:
            if isinstance(item, ast.AnnAssign) or isinstance(item, ast.Assign):
                # Look for relationship() calls in value
                if isinstance(item, ast.AnnAssign) and item.value:
                    value = item.value
                elif isinstance(item, ast.Assign):
                    value = item.value
                else:
                    continue

                if isinstance(value, ast.Call):
                    if isinstance(value.func, ast.Name) and value.func.id == "relationship":
                        # Extract target model
                        if value.args and isinstance(value.args[0], ast.Constant):
                            target_model = value.args[0].value
                            relationships.append({
                                "model": f"[[MODEL-XXX-{target_model.lower()}]]",
                                "type": "one-to-many",  # Simplified
                                "via": "foreign_key",
                            })

        return relationships

    def _extract_indexes(self, node: ast.ClassDef) -> list[str]:
        """Extract __table_args__ indexes."""
        # Simplified - would need more detailed parsing
        return []

    def _generate_id_and_slug(self, class_name: str) -> tuple[str, str]:
        """Generate MODEL-NNN ID and slug from class name."""

        # Convert CamelCase to snake-case for slug
        import re
        slug = re.sub(r'(?<!^)(?=[A-Z])', '-', class_name).lower()

        # ID placeholder
        model_id = "MODEL-XXX"

        return model_id, slug

    def _get_schema_warning(self, schema_locked: bool) -> str:
        """Get schema lock warning."""

        if schema_locked:
            return """⚠️ **Schema Locked**: This is a production table. Modifying this schema requires:
1. Explicit approval from project owner
2. Migration plan with rollback strategy
3. Data backfill plan for existing records
4. Testing in staging environment

**DO NOT MODIFY WITHOUT APPROVAL.**
"""
        return "This table can be modified with standard migration procedures."

    def _generate_auto_content(self, model_data: dict[str, Any]) -> str:
        """Generate AUTO-GENERATED section content."""

        content = f"""## Database Schema

**Table Name**: `{model_data['table']}`

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
"""

        for col in model_data["columns"]:
            content += f"| {col['name']} | {col['type']} | {col['constraints']} | {col['description']} |\n"

        if not model_data["columns"]:
            content += "| See code | - | - | Column details in source |\n"

        content += "\n**Indexes**: See code\n\n"
        content += "**Foreign Keys**: See code\n\n"

        content += "## Relationships\n\n"

        if model_data["relationships"]:
            for rel in model_data["relationships"]:
                content += f"- {rel['model']}: {rel['type']} via {rel['via']}\n"
        else:
            content += "No relationships defined\n"

        content += "\n## Used By Routes\n\nSee code for route usage\n"

        return content

    def _format_related_models(self, relationships: list[dict[str, str]]) -> str:
        """Format related models section."""
        if not relationships:
            return "No direct relationships"

        return "\n".join([f"- {rel['model']}: {rel['type']}" for rel in relationships])
