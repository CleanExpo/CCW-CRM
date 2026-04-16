"""Utility endpoints (reference data, lookups)."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/utils", tags=["Utils"])

AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]


@router.get("/au-states")
async def get_au_states() -> dict:
    """Return the list of valid Australian states and territories."""
    return {"states": AU_STATES}
