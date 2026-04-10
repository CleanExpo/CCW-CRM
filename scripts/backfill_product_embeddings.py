#!/usr/bin/env python3
"""Backfill product embeddings for semantic search (Phase 4 / B1).

Wraps `EmbeddingService.batch_generate_embeddings()` with a CLI entry point so
embeddings can be (re)generated from the command line or a cron/CI job.

Usage
-----
    # Backfill all active products in English (default)
    cd apps/backend && uv run python ../../scripts/backfill_product_embeddings.py

    # Regenerate existing embeddings
    uv run python ../../scripts/backfill_product_embeddings.py --force

    # Backfill a specific language
    uv run python ../../scripts/backfill_product_embeddings.py --language zh-CN

    # Backfill a subset of products by UUID
    uv run python ../../scripts/backfill_product_embeddings.py \
        --product-id 11111111-1111-1111-1111-111111111111 \
        --product-id 22222222-2222-2222-2222-222222222222

Prerequisites
-------------
    - `OPENAI_API_KEY` env var must be set (uses text-embedding-3-small)
    - Backend deps installed: `cd apps/backend && uv sync`
    - Database reachable (DATABASE_URL env var)

This script is idempotent: products that already have embeddings for the given
language are skipped unless `--force` is passed. Batches of 100 are processed
concurrently (matching EmbeddingService.BATCH_SIZE).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import UUID

# Ensure the backend package is importable when run from the repo root
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_SRC = REPO_ROOT / "apps" / "backend"
sys.path.insert(0, str(BACKEND_SRC))

from src.config.database import AsyncSessionLocal  # noqa: E402
from src.services.embedding_service import EmbeddingService  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill product embeddings for semantic search.",
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Language code to generate embeddings for (default: en)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate embeddings even if they already exist",
    )
    parser.add_argument(
        "--product-id",
        action="append",
        dest="product_ids",
        default=None,
        help="Limit to specific product UUID(s). Pass multiple times for a list. "
        "If omitted, all active products are processed.",
    )
    return parser.parse_args()


async def run(args: argparse.Namespace) -> int:
    product_ids: list[UUID] | None = None
    if args.product_ids:
        try:
            product_ids = [UUID(pid) for pid in args.product_ids]
        except ValueError as exc:
            print(f"[ERROR] Invalid product UUID: {exc}", file=sys.stderr)
            return 2

    service = EmbeddingService()

    print("[INFO] Starting embedding backfill")
    print(f"       language       = {args.language}")
    print(f"       force_regen    = {args.force}")
    print(f"       product_ids    = {'all active' if not product_ids else len(product_ids)}")
    print(f"       model          = {service.MODEL}")
    print(f"       dimensions     = {service.DIMENSIONS}")
    print(f"       batch_size     = {service.BATCH_SIZE}")
    print()

    async with AsyncSessionLocal() as db:
        result = await service.batch_generate_embeddings(
            db=db,
            product_ids=product_ids,
            language=args.language,
            force_regenerate=args.force,
        )

    print()
    print("[RESULT]")
    print(f"       total          = {result.get('total', 0)}")
    print(f"       successful     = {result.get('successful', 0)}")
    print(f"       skipped        = {result.get('skipped', 0)} (already had embeddings)")
    print(f"       failed         = {result.get('failed', 0)}")

    errors = result.get("errors", [])
    if errors:
        print()
        print(f"[ERRORS] ({len(errors)}):")
        for err in errors[:20]:
            print(f"  - {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")

    return 0 if result.get("failed", 0) == 0 else 1


def main() -> int:
    args = parse_args()
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Backfill cancelled by user", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
