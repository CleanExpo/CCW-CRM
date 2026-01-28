#!/usr/bin/env python
"""Test products endpoint logic locally without FastAPI."""

import asyncio
import sys
sys.path.insert(0, 'src')

from sqlalchemy import func, select
from config.database import get_db
from db.erp_models import Product as ProductModel

async def test_products_query():
    print("Testing products query logic...")
    
    # Simulate what the products endpoint does
    async for db in get_db():
        try:
            # Build query (same as products endpoint)
            query = select(ProductModel)
            
            # Get total count
            count_query = select(func.count()).select_from(query.subquery())
            result = await db.execute(count_query)
            total = result.scalar_one()
            
            print(f"[PASS] Total products: {total}")
            
            # Get products with pagination
            page = 1
            page_size = 5
            query = query.offset((page - 1) * page_size).limit(page_size)
            query = query.order_by(ProductModel.created_at.desc())
            
            result = await db.execute(query)
            products = result.scalars().all()
            
            print(f"[PASS] Retrieved {len(products)} products")
            print(f"[PASS] Products query works!")
            
        except Exception as e:
            print(f"[FAIL] {e}")
            import traceback
            traceback.print_exc()
        finally:
            break  # Only test once

if __name__ == "__main__":
    asyncio.run(test_products_query())
