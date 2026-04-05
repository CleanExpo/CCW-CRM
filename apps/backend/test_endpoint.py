"""Test endpoint to debug serialization."""
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.schemas import Order, PaginatedResponse
from src.api.routes.orders import list_orders
from src.config.database import get_db
import uvicorn

app = FastAPI()

@app.get("/test", response_model=PaginatedResponse)
async def test_orders(db: AsyncSession = Depends(get_db)):
    result = await list_orders(page=1, page_size=1, search=None, status=None, customer_id=None, db=db)
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)
