"""Base parser with human-curated content preservation."""

import re
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any


class BaseParser(ABC):
    """Base parser for all entity types."""

    def __init__(
        self,
        vault_root: Path,
        repo_root: Path,
        preserve_human_content: bool = True,
        verify_only: bool = False,
    ):
        self.vault_root = vault_root
        self.repo_root = repo_root
        self.preserve_human_content = preserve_human_content
        self.verify_only = verify_only
        self.today = datetime.utcnow().strftime("%Y-%m-%d")

    @abstractmethod
    async def parse_and_generate(self, file_path: Path) -> dict[str, Any]:
        """Parse source file and generate vault markdown doc.

        Returns:
            dict with keys: output_file, action (created|updated|skipped)
        """
        pass

    def extract_human_curated_blocks(self, content: str) -> list[dict]:
        """Extract all HUMAN-CURATED content blocks from existing file."""
        blocks = []
        pattern = r"<!-- HUMAN-CURATED -->(.*?)<!-- END HUMAN-CURATED -->"

        for match in re.finditer(pattern, content, re.DOTALL):
            blocks.append({
                "content": match.group(1),
                "start": match.start(),
                "end": match.end(),
            })

        return blocks

    def merge_auto_and_human(
        self,
        existing_content: str,
        new_frontmatter: str,
        new_auto_content: str,
    ) -> str:
        """Merge new auto-generated content with existing human-curated blocks.

        Args:
            existing_content: Current file content (if exists)
            new_frontmatter: New YAML frontmatter
            new_auto_content: New AUTO-GENERATED section content

        Returns:
            Merged content with preserved human-curated blocks
        """
        if not existing_content or not self.preserve_human_content:
            return new_auto_content  # Return full new content

        # Extract human-curated blocks from existing content
        human_blocks = self.extract_human_curated_blocks(existing_content)

        if not human_blocks:
            return new_auto_content  # No human content to preserve

        # Replace frontmatter in new content (always overwrite)
        new_parts = new_auto_content.split("---\n", 2)
        if len(new_parts) == 3:
            # Has frontmatter - replace it
            merged = f"---\n{new_frontmatter}\n---\n{new_parts[2]}"
        else:
            merged = new_auto_content

        # Find AUTO-GENERATED section end marker
        auto_end_marker = "<!-- END AUTO-GENERATED -->"
        auto_end_pos = merged.find(auto_end_marker)

        if auto_end_pos == -1:
            return merged  # No auto-generated marker, return as-is

        # Split: before auto-end | after auto-end
        before_auto_end = merged[:auto_end_pos + len(auto_end_marker)]
        after_auto_end = merged[auto_end_pos + len(auto_end_marker):]

        # Find HUMAN-CURATED section in new content
        human_start_marker = "<!-- HUMAN-CURATED -->"
        human_start_pos = after_auto_end.find(human_start_marker)

        if human_start_pos == -1:
            # No human-curated section in template - append after auto-generated
            human_content = "\n\n".join([block["content"] for block in human_blocks])
            return f"{before_auto_end}\n\n{human_start_marker}{human_content}<!-- END HUMAN-CURATED -->{after_auto_end}"

        # Replace placeholder human content with preserved content
        # Find END HUMAN-CURATED in new content
        human_end_marker = "<!-- END HUMAN-CURATED -->"
        human_end_pos = after_auto_end.find(human_end_marker, human_start_pos)

        if human_end_pos == -1:
            return merged  # Malformed template

        # Extract parts: before human | human | after human
        before_human = after_auto_end[:human_start_pos + len(human_start_marker)]
        after_human = after_auto_end[human_end_pos:]

        # Combine preserved human blocks
        preserved_human = "\n\n".join([block["content"] for block in human_blocks])

        return f"{before_auto_end}{before_human}{preserved_human}{after_human}"

    def read_existing_file(self, output_path: Path) -> str | None:
        """Read existing vault file if it exists."""
        if not output_path.exists():
            return None

        try:
            with open(output_path, encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def write_vault_file(self, output_path: Path, content: str) -> str:
        """Write content to vault file.

        Returns:
            "created" or "updated"
        """
        if self.verify_only:
            return "skipped"

        action = "created" if not output_path.exists() else "updated"

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return action

    def format_frontmatter(self, data: dict[str, Any]) -> str:
        """Format dictionary as YAML frontmatter."""
        lines = []
        for key, value in data.items():
            if isinstance(value, list):
                if not value:
                    lines.append(f"{key}: []")
                else:
                    lines.append(f"{key}:")
                    for item in value:
                        if isinstance(item, dict):
                            # Handle list of dicts (e.g., relationships)
                            lines.append("  - " + ", ".join(f"{k}: {repr(v)}" for k, v in item.items()))
                        else:
                            lines.append(f"  - {repr(item)}")
            elif isinstance(value, bool):
                lines.append(f"{key}: {str(value).lower()}")
            elif isinstance(value, (int, float)):
                lines.append(f"{key}: {value}")
            elif value is None:
                lines.append(f"{key}: null")
            else:
                lines.append(f"{key}: {repr(value) if isinstance(value, str) else value}")

        return "\n".join(lines)
