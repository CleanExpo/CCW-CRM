"""
CLI Script to Generate Embeddings for Products and Customers.

Usage:
    python -m scripts.generate_embeddings --type products
    python -m scripts.generate_embeddings --type customers
    python -m scripts.generate_embeddings --type all
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import src modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.config.database import get_async_engine
from src.db.demo_models import Customer, Product
from src.services.embedding_service import get_embedding_service

logger = structlog.get_logger(__name__)
settings = get_settings()


async def generate_product_embeddings(session: AsyncSession, force: bool = False):
    """
    Generate embeddings for all products using Product.embedding column.

    Args:
        session: Database session
        force: Regenerate existing embeddings
    """
    service = get_embedding_service()

    # Get products without embeddings (or all if force=True)
    if force:
        query = select(Product).where(Product.is_active == True)  # noqa: E712
    else:
        query = select(Product).where(
            Product.is_active == True,  # noqa: E712
            Product.embedding == None,  # noqa: E711
        )

    result = await session.execute(query)
    products = result.scalars().all()

    total = len(products)
    logger.info(f"Found {total} products to process", total=total, force=force)

    if total == 0:
        logger.info("No products need embedding generation")
        return {
            "success": True,
            "total": 0,
            "processed": 0,
            "failed": 0,
        }

    processed = 0
    failed = 0

    for idx, product in enumerate(products, 1):
        try:
            # Generate embedding text
            text = service._generate_text_for_embedding(product, "en")

            # Call OpenAI API
            embedding = await service._call_openai_embeddings(text)

            # Update product directly
            await session.execute(
                update(Product)
                .where(Product.id == product.id)
                .values(embedding=embedding)
            )

            processed += 1

            if idx % 10 == 0 or idx == total:
                logger.info(
                    f"Progress: {idx}/{total}",
                    processed=processed,
                    failed=failed,
                )

        except Exception as e:
            logger.error(
                f"Failed to generate embedding for product {product.sku}",
                error=str(e),
            )
            failed += 1

    await session.commit()

    logger.info(
        "Product embedding generation complete",
        total=total,
        processed=processed,
        failed=failed,
    )

    return {
        "success": True,
        "total": total,
        "processed": processed,
        "failed": failed,
    }


async def generate_customer_embeddings(session: AsyncSession, force: bool = False):
    """
    Generate embeddings for all customers using Customer.embedding column.

    Args:
        session: Database session
        force: Regenerate existing embeddings
    """
    import httpx

    api_key = settings.openai_api_key
    if not api_key:
        logger.error("OpenAI API key not configured")
        return {
            "success": False,
            "error": "OpenAI API key not configured",
        }

    client = httpx.AsyncClient(
        base_url="https://api.openai.com/v1",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )

    # Get customers without embeddings (or all if force=True)
    if force:
        query = select(Customer).where(Customer.is_active == True)  # noqa: E712
    else:
        query = select(Customer).where(
            Customer.is_active == True,  # noqa: E712
            Customer.embedding == None,  # noqa: E711
        )

    result = await session.execute(query)
    customers = result.scalars().all()

    total = len(customers)
    logger.info(f"Found {total} customers to process", total=total, force=force)

    if total == 0:
        logger.info("No customers need embedding generation")
        await client.aclose()
        return {
            "success": True,
            "total": 0,
            "processed": 0,
            "failed": 0,
        }

    processed = 0
    failed = 0

    for idx, customer in enumerate(customers, 1):
        try:
            # Generate embedding text
            parts = [
                f"Company: {customer.company_name}",
                f"Contact: {customer.contact_name}",
            ]
            if customer.address:
                parts.append(f"Address: {customer.address}")
            if customer.city:
                parts.append(f"City: {customer.city}")
            if customer.state:
                parts.append(f"State: {customer.state}")

            text = " | ".join(parts)

            # Call OpenAI API
            payload = {
                "model": "text-embedding-3-small",
                "input": text,
                "encoding_format": "float",
            }

            response = await client.post("/embeddings", json=payload)
            response.raise_for_status()

            data = response.json()
            embedding = data["data"][0]["embedding"]

            # Update customer directly
            await session.execute(
                update(Customer)
                .where(Customer.id == customer.id)
                .values(embedding=embedding)
            )

            processed += 1

            if idx % 10 == 0 or idx == total:
                logger.info(
                    f"Progress: {idx}/{total}",
                    processed=processed,
                    failed=failed,
                )

        except Exception as e:
            logger.error(
                f"Failed to generate embedding for customer {customer.company_name}",
                error=str(e),
            )
            failed += 1

    await session.commit()
    await client.aclose()

    logger.info(
        "Customer embedding generation complete",
        total=total,
        processed=processed,
        failed=failed,
    )

    return {
        "success": True,
        "total": total,
        "processed": processed,
        "failed": failed,
    }


async def get_embedding_coverage(session: AsyncSession):
    """Get embedding coverage statistics."""
    # Products
    products_total = await session.execute(
        select(Product).where(Product.is_active == True)  # noqa: E712
    )
    products_total_count = len(products_total.scalars().all())

    products_with_embeddings = await session.execute(
        select(Product).where(
            Product.is_active == True,  # noqa: E712
            Product.embedding != None,  # noqa: E711
        )
    )
    products_with_count = len(products_with_embeddings.scalars().all())

    # Customers
    customers_total = await session.execute(
        select(Customer).where(Customer.is_active == True)  # noqa: E712
    )
    customers_total_count = len(customers_total.scalars().all())

    customers_with_embeddings = await session.execute(
        select(Customer).where(
            Customer.is_active == True,  # noqa: E712
            Customer.embedding != None,  # noqa: E711
        )
    )
    customers_with_count = len(customers_with_embeddings.scalars().all())

    coverage = {
        "products": {
            "total": products_total_count,
            "with_embeddings": products_with_count,
            "coverage_percent": (
                round(products_with_count / products_total_count * 100, 2)
                if products_total_count > 0
                else 0
            ),
        },
        "customers": {
            "total": customers_total_count,
            "with_embeddings": customers_with_count,
            "coverage_percent": (
                round(customers_with_count / customers_total_count * 100, 2)
                if customers_total_count > 0
                else 0
            ),
        },
    }

    logger.info("Embedding Coverage", **coverage)
    return coverage


async def main():
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Generate embeddings for products and customers"
    )
    parser.add_argument(
        "--type",
        choices=["products", "customers", "all", "status"],
        required=True,
        help="Type of embeddings to generate or check status",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate existing embeddings",
    )

    args = parser.parse_args()

    # Create database session
    engine = get_async_engine()
    async with AsyncSession(engine) as session:
        if args.type == "status":
            await get_embedding_coverage(session)

        elif args.type == "products":
            logger.info("Starting product embedding generation...")
            result = await generate_product_embeddings(session, force=args.force)
            logger.info("Product embeddings complete", **result)

        elif args.type == "customers":
            logger.info("Starting customer embedding generation...")
            result = await generate_customer_embeddings(session, force=args.force)
            logger.info("Customer embeddings complete", **result)

        elif args.type == "all":
            logger.info("Starting embedding generation for all entities...")

            logger.info("Step 1/2: Products")
            products_result = await generate_product_embeddings(session, force=args.force)

            logger.info("Step 2/2: Customers")
            customers_result = await generate_customer_embeddings(session, force=args.force)

            logger.info(
                "All embeddings complete",
                products=products_result,
                customers=customers_result,
            )

            # Show final coverage
            await get_embedding_coverage(session)

    await engine.dispose()
    logger.info("Embedding generation complete")


if __name__ == "__main__":
    asyncio.run(main())
