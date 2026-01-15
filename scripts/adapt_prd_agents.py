"""Script to adapt marketing addon PRD agents to CCW-ERP structure."""

import re
from pathlib import Path

# Define replacement patterns
REPLACEMENTS = [
    # Base agent import
    (r'from \.\.base_agent import BaseAgent', 'from src.ai.base_agent import BaseAgent'),

    # Config imports (keep as-is, compatible)
    # (r'from src\.config import get_settings', 'from src.config import get_settings'),

    # Logger imports - replace with structlog
    (r'from src\.utils import get_logger', 'import structlog'),
    (r'logger = get_logger\(__name__\)', 'logger = structlog.get_logger(__name__)'),

    # BaseAgent initialization - add auto_register=False to avoid registry issues
    (r'super\(\).__init__\(\s*name="([^"]+)",\s*capabilities=\[',
     r'super().__init__(agent_id=None, name="\1", auto_register=False)\n        self.capabilities = ['),

    # Remove methods that don't exist in CCW-ERP's BaseAgent
    (r'self\.start_task\(task_id\)', '# task_id tracking handled by orchestrator'),
    (r'self\.report_output\([^)]+\)', '# output reporting handled by orchestrator'),

    # Logger attribute - CCW-ERP uses module-level logger, not instance attribute
    (r'self\.logger\.', 'logger.'),

    # Supabase state storage - remove (will need manual handling)
    (r'from src\.state\.supabase import SupabaseStateStore', '# TODO: Replace Supabase with direct PostgreSQL'),
]

def adapt_file(file_path: Path) -> None:
    """Adapt a single PRD agent file."""
    print(f"Adapting {file_path.name}...")

    content = file_path.read_text(encoding='utf-8')
    original_content = content

    # Apply replacements
    for pattern, replacement in REPLACEMENTS:
        content = re.sub(pattern, replacement, content)

    # Special handling for BaseAgent init with multiline capabilities
    # Convert this:
    #   super().__init__(
    #       name="foo",
    #       capabilities=[...]
    #   )
    # To this:
    #   super().__init__(agent_id=None, name="foo", auto_register=False)
    #   self.capabilities = [...]

    if 'super().__init__(' in content and 'capabilities' in content:
        # More complex pattern to handle multiline init
        init_pattern = r'super\(\).__init__\(\s*name="([^"]+)",\s*capabilities=\[([\s\S]*?)\]\s*\)'

        def replace_init(match):
            name = match.group(1)
            capabilities = match.group(2).strip()
            return (
                f'super().__init__(agent_id=None, name="{name}", auto_register=False)\n'
                f'        self.capabilities = [{capabilities}]'
            )

        content = re.sub(init_pattern, replace_init, content)

    # Only write if changes were made
    if content != original_content:
        file_path.write_text(content, encoding='utf-8')
        print(f"  [OK] Updated {file_path.name}")
    else:
        print(f"  [-] No changes needed for {file_path.name}")

def main():
    """Adapt all PRD agent files."""
    prd_agents_dir = Path("C:/CCW-Online ERP/apps/backend/src/agents/prd")

    if not prd_agents_dir.exists():
        print(f"ERROR: Directory not found: {prd_agents_dir}")
        return

    # Get all Python files except __init__.py
    agent_files = [
        f for f in prd_agents_dir.glob("*.py")
        if f.name != "__init__.py"
    ]

    print(f"Found {len(agent_files)} agent files to adapt\n")

    for agent_file in agent_files:
        adapt_file(agent_file)

    print("\n[SUCCESS] All PRD agent files adapted!")
    print("\nNext steps:")
    print("1. Review adapted files for any remaining TODOs")
    print("2. Handle Supabase dependencies manually")
    print("3. Test agent initialization")

if __name__ == "__main__":
    main()
