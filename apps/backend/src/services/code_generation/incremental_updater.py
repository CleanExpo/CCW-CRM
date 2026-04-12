"""Incremental code updater — modifies existing files rather than generating new ones.

Supports:
- Adding a method/endpoint to an existing file
- Modifying an existing function (with smart preservation of surrounding code)
- Removing a function or block
- Applying a refactor instruction

Uses a diff-based approach: generates only the changed section and splices it
into the original file, preserving user customisations outside the change zone.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import unified_diff
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

# ============================================================================
# Data Models
# ============================================================================


ChangeType = Literal["add_method", "modify_function", "remove_function", "refactor"]


class UpdateRequest(BaseModel):
    """Request to modify an existing file."""

    file_path: str = Field(description="Relative path to the file to modify")
    change_type: ChangeType = Field(description="What kind of change to make")
    instruction: str = Field(description="Natural language change description")
    target_symbol: str | None = Field(
        default=None,
        description="Function/class name to modify or remove",
    )
    insert_after: str | None = Field(
        default=None,
        description="For add_method: insert after this symbol name",
    )
    preserve_markers: list[str] = Field(
        default_factory=list,
        description="Lines containing these strings must not be changed",
    )


class UpdateResult(BaseModel):
    """Result of an incremental update."""

    file_path: str
    original_content: str
    updated_content: str
    diff: str = Field(description="Unified diff of the change")
    syntax_valid: bool
    change_summary: str
    lines_added: int
    lines_removed: int
    preserved: bool = Field(
        description="True if all preserve_markers survived unchanged"
    )


# ============================================================================
# Incremental Updater
# ============================================================================


@dataclass
class IncrementalUpdater:
    """Modifies existing source files with targeted, context-aware changes.

    Usage:
        updater = IncrementalUpdater(project_root=Path("/path/to/project"))
        result = await updater.update(UpdateRequest(
            file_path="apps/backend/src/api/routes/products.py",
            change_type="add_method",
            instruction="Add GET /api/products/{id}/related endpoint returning similar products",
            insert_after="list_products",
        ))
        Path(result.file_path).write_text(result.updated_content)
    """

    project_root: Path
    anthropic_api_key: str | None = None
    model: str = "claude-sonnet-4-20250514"
    max_retries: int = 2

    def __post_init__(self) -> None:
        import os

        api_key = self.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set")
        self.client = anthropic.Anthropic(api_key=api_key)

    # ========================================================================
    # Public API
    # ========================================================================

    async def update(self, request: UpdateRequest) -> UpdateResult:
        """Apply a targeted change to an existing file.

        Strategy:
        - add_method: generate the new function, splice after target symbol
        - modify_function: extract the target function, regenerate it, splice back
        - remove_function: locate and excise the target symbol block
        - refactor: send full file + instruction, receive full updated file
        """
        full_path = self.project_root / request.file_path
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {request.file_path}")

        original = full_path.read_text(encoding="utf-8")
        language = self._detect_language(request.file_path)

        if request.change_type == "add_method":
            updated = await self._add_method(original, request, language)
        elif request.change_type == "modify_function":
            updated = await self._modify_function(original, request, language)
        elif request.change_type == "remove_function":
            updated = self._remove_function(original, request, language)
        else:  # refactor
            updated = await self._refactor(original, request, language)

        # Check preserve markers
        preserved = all(
            marker in updated for marker in request.preserve_markers
        )

        # Validate syntax
        syntax_valid = self._validate_syntax(updated, language)

        # Build diff
        diff = "".join(
            unified_diff(
                original.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile=f"a/{request.file_path}",
                tofile=f"b/{request.file_path}",
                n=3,
            )
        )

        orig_lines = set(original.splitlines())
        new_lines = set(updated.splitlines())
        added = len(new_lines - orig_lines)
        removed = len(orig_lines - new_lines)

        return UpdateResult(
            file_path=request.file_path,
            original_content=original,
            updated_content=updated,
            diff=diff,
            syntax_valid=syntax_valid,
            change_summary=f"{request.change_type}: {request.instruction[:100]}",
            lines_added=added,
            lines_removed=removed,
            preserved=preserved,
        )

    async def apply(self, result: UpdateResult) -> None:
        """Write the updated content to disk."""
        if not result.syntax_valid:
            raise ValueError(
                f"Refusing to write syntactically invalid code to {result.file_path}"
            )
        if not result.preserved:
            raise ValueError(
                "Refusing to write: preserve_markers were altered by the update"
            )
        full_path = self.project_root / result.file_path
        full_path.write_text(result.updated_content, encoding="utf-8")

    # ========================================================================
    # Change strategies
    # ========================================================================

    async def _add_method(
        self, original: str, request: UpdateRequest, language: str
    ) -> str:
        """Generate a new function and insert it after insert_after."""
        # Extract the insert_after function to use as style reference
        style_example = ""
        if request.insert_after:
            style_example = self._extract_symbol(original, request.insert_after, language)

        prompt = self._add_method_prompt(
            instruction=request.instruction,
            style_example=style_example,
            language=language,
            existing_imports=self._extract_imports(original, language),
        )
        new_code = await self._call_llm(prompt)
        new_code = self._clean_code(new_code)

        # Insert after the target symbol, or append at end
        if request.insert_after:
            insertion_point = self._find_symbol_end(
                original, request.insert_after, language
            )
            if insertion_point != -1:
                return original[:insertion_point] + "\n\n" + new_code + original[insertion_point:]

        # Fall back to appending at end of file
        return original.rstrip() + "\n\n\n" + new_code + "\n"

    async def _modify_function(
        self, original: str, request: UpdateRequest, language: str
    ) -> str:
        """Replace the body of an existing function."""
        if not request.target_symbol:
            raise ValueError("target_symbol required for modify_function")

        symbol_code = self._extract_symbol(original, request.target_symbol, language)
        if not symbol_code:
            raise ValueError(
                f"Symbol '{request.target_symbol}' not found in {request.file_path}"
            )

        prompt = self._modify_function_prompt(
            instruction=request.instruction,
            original_function=symbol_code,
            language=language,
        )
        updated_fn = await self._call_llm(prompt)
        updated_fn = self._clean_code(updated_fn)

        # Splice the updated function back
        return original.replace(symbol_code, updated_fn, 1)

    def _remove_function(
        self, original: str, request: UpdateRequest, language: str
    ) -> str:
        """Remove a function/method block entirely."""
        if not request.target_symbol:
            raise ValueError("target_symbol required for remove_function")

        symbol_code = self._extract_symbol(original, request.target_symbol, language)
        if not symbol_code:
            raise ValueError(
                f"Symbol '{request.target_symbol}' not found in {request.file_path}"
            )

        # Remove the block and clean up double blank lines
        updated = original.replace(symbol_code, "", 1)
        updated = re.sub(r"\n{3,}", "\n\n", updated)
        return updated

    async def _refactor(
        self, original: str, request: UpdateRequest, language: str
    ) -> str:
        """Send full file to LLM with refactor instruction."""
        prompt = self._refactor_prompt(
            instruction=request.instruction,
            original_code=original,
            language=language,
        )
        updated = await self._call_llm(prompt)
        return self._clean_code(updated)

    # ========================================================================
    # Prompt builders
    # ========================================================================

    def _add_method_prompt(
        self,
        instruction: str,
        style_example: str,
        language: str,
        existing_imports: str,
    ) -> str:
        return f"""You are an expert {language} developer.

## Task
Add the following to an existing file: {instruction}

## Style reference (follow exactly)
```{language}
{style_example or "No reference available — follow project conventions."}
```

## Existing imports (do not re-import these)
{existing_imports}

## Rules
- Output ONLY the new function/method code
- No imports (they already exist or are not needed)
- No class wrappers — just the function body
- Match indentation and style of the reference exactly

New code:"""

    def _modify_function_prompt(
        self, instruction: str, original_function: str, language: str
    ) -> str:
        return f"""You are an expert {language} developer.

## Task
Modify the following function: {instruction}

## Original function
```{language}
{original_function}
```

## Rules
- Preserve the function signature (name, parameters, return type) unless the instruction changes it
- Keep docstring unless instructed to change it
- Output ONLY the complete updated function — no surrounding code, no markdown fences

Updated function:"""

    def _refactor_prompt(
        self, instruction: str, original_code: str, language: str
    ) -> str:
        return f"""You are an expert {language} developer.

## Refactoring task
{instruction}

## Original file
```{language}
{original_code}
```

## Rules
- Preserve all functionality unless explicitly changing it
- Keep all existing imports unless removing unused ones is part of the task
- Output ONLY the complete updated file content — no markdown fences, no explanation

Updated file:"""

    # ========================================================================
    # Symbol extraction helpers
    # ========================================================================

    def _extract_symbol(self, code: str, symbol: str, language: str) -> str:
        """Extract the complete source block for a named function/class."""
        if language == "python":
            return self._extract_python_symbol(code, symbol)
        return self._extract_ts_symbol(code, symbol)

    def _extract_python_symbol(self, code: str, symbol: str) -> str:
        """Extract a Python function or class by name using indentation."""
        lines = code.splitlines(keepends=True)
        start = -1
        base_indent = 0

        for i, line in enumerate(lines):
            stripped = line.lstrip()
            if stripped.startswith(("def ", "async def ", "class ")) and symbol in stripped:
                start = i
                base_indent = len(line) - len(stripped)
                break

        if start == -1:
            return ""

        end = len(lines)
        for i in range(start + 1, len(lines)):
            line = lines[i]
            if not line.strip():  # blank line — keep going
                continue
            indent = len(line) - len(line.lstrip())
            if indent <= base_indent and line.strip():
                end = i
                break

        return "".join(lines[start:end]).rstrip()

    def _extract_ts_symbol(self, code: str, symbol: str) -> str:
        """Extract a TypeScript function by scanning brace depth."""
        pattern = re.compile(
            rf"(?:export\s+)?(?:async\s+)?(?:function\s+{re.escape(symbol)}"
            rf"|(?:const|let|var)\s+{re.escape(symbol)}\s*=)"
        )
        match = pattern.search(code)
        if not match:
            return ""

        start = match.start()
        # Walk forward to find opening brace
        brace_start = code.find("{", start)
        if brace_start == -1:
            return code[start : code.find("\n", start) + 1]

        depth = 0
        for i in range(brace_start, len(code)):
            if code[i] == "{":
                depth += 1
            elif code[i] == "}":
                depth -= 1
                if depth == 0:
                    return code[start : i + 1]
        return code[start:]

    def _find_symbol_end(self, code: str, symbol: str, language: str) -> int:
        """Return the character position after the named symbol ends."""
        extracted = self._extract_symbol(code, symbol, language)
        if not extracted:
            return -1
        pos = code.find(extracted)
        if pos == -1:
            return -1
        return pos + len(extracted)

    def _extract_imports(self, code: str, language: str) -> str:
        """Extract the import block from the top of the file."""
        lines = code.splitlines()
        import_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(("import ", "from ")):
                import_lines.append(line)
            elif stripped and not stripped.startswith("#") and import_lines:
                # First non-import, non-blank, non-comment line after imports
                break
        return "\n".join(import_lines)

    # ========================================================================
    # Utility helpers
    # ========================================================================

    def _detect_language(self, file_path: str) -> str:
        if file_path.endswith((".ts", ".tsx")):
            return "typescript"
        return "python"

    def _validate_syntax(self, code: str, language: str) -> bool:
        if language == "python":
            import ast

            try:
                ast.parse(code)
                return True
            except SyntaxError:
                return False
        # TypeScript: basic brace balance check
        depth = sum(1 if c == "{" else (-1 if c == "}" else 0) for c in code)
        return depth == 0

    def _clean_code(self, raw: str) -> str:
        raw = re.sub(r"^```[a-zA-Z]*\n", "", raw)
        raw = re.sub(r"\n```$", "", raw)
        return raw.strip()

    async def _call_llm(self, prompt: str) -> str:
        """Call Claude API with retry logic."""
        import asyncio

        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    temperature=0.1,
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.content[0].text.strip()
            except anthropic.RateLimitError:
                if attempt < self.max_retries:
                    await asyncio.sleep(2**attempt)
                    continue
                raise
            except Exception:
                if attempt < self.max_retries:
                    continue
                raise
        raise RuntimeError("LLM call failed after all retries")
