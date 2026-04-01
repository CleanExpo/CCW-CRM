"""
Contractor Availability API Routes (Supabase-enabled)

Australian-first API for managing contractor schedules with:
- ABN validation
- Australian mobile number format
- Brisbane location focus
- AEST timezone handling
- Supabase PostgreSQL database
"""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status

from src.models.contractor import (
    AustralianState,
    AvailabilitySlot,
    AvailabilitySlotCreate,
    AvailabilityStatus,
    Contractor,
    ContractorCreate,
    ContractorList,
    ContractorUpdate,
    ErrorResponse,
    Location,
)
from src.utils.supabase_client import supabase

# DEBUG: Print to confirm this is the Supabase version
print("=" * 60)
print("LOADING CONTRACTORS ROUTE (SUPABASE VERSION)")
print("=" * 60)

router = APIRouter(
    prefix="/contractors",
    tags=["contractors"],
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Contractor not found"
        },
        422: {
            "model": ErrorResponse,
            "description": "Validation error (invalid ABN, mobile, etc.)"
        },
    },
)


@router.get(
    "/",
    response_model=ContractorList,
    summary="List all contractors",
    description="Get paginated list of contractors with Australian formatting",
)
async def list_contractors(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    state: AustralianState | None = Query(
        None,
        description="Filter by Australian state (e.g., QLD, NSW)"
    ),
    specialisation: str | None = Query(
        None,
        description="Filter by specialisation"
    ),
) -> ContractorList:
    """
    List contractors with optional filtering from Supabase.

    **Australian Context:**
    - Phone numbers formatted as 04XX XXX XXX
    - ABN formatted as XX XXX XXX XXX
    - Timestamps in AEST/AEDT timezone
    - Locations include Australian state (QLD, NSW, etc.)
    """
    # Build query
    query = supabase.table("contractors").select("*, availability_slots(*)")

    # Apply specialisation filter
    if specialisation:
        query = query.ilike("specialisation", f"%{specialisation}%")

    # Execute query with pagination
    offset = (page - 1) * page_size
    response = query.range(offset, offset + page_size - 1).execute()

    # Convert database records to Pydantic models
    contractors = []
    for record in response.data:
        # Parse availability slots
        slots = []
        for slot_record in record.get("availability_slots", []):
            slots.append(AvailabilitySlot(
                id=slot_record["id"],
                date=slot_record["date"],
                start_time=slot_record["start_time"],
                end_time=slot_record["end_time"],
                location=Location(
                    suburb=slot_record["suburb"],
                    state=slot_record["state"],
                    postcode=slot_record.get("postcode")
                ),
                status=slot_record["status"],
                notes=slot_record.get("notes")
            ))

        # Filter by state if provided (post-query filter)
        if state and not any(slot.location.state == state for slot in slots):
            continue

        contractor = Contractor(
            id=record["id"],
            name=record["name"],
            mobile=record["mobile"],
            abn=record.get("abn"),
            email=record.get("email"),
            specialisation=record.get("specialisation"),
            created_at=record["created_at"],
            updated_at=record["updated_at"],
            availability_slots=slots
        )
        contractors.append(contractor)

    # Get total count (without pagination)
    count_query = supabase.table("contractors").select("id", count="exact")
    if specialisation:
        count_query = count_query.ilike("specialisation", f"%{specialisation}%")
    count_response = count_query.execute()
    total = count_response.count or 0

    return ContractorList(
        contractors=contractors,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get(
    "/{contractor_id}",
    response_model=Contractor,
    summary="Get contractor by ID",
    description="Retrieve contractor details with availability slots",
)
async def get_contractor(contractor_id: str) -> Contractor:
    """Get contractor by ID from Supabase."""
    # Query contractor with availability slots
    response = supabase.table("contractors").select(
        "*, availability_slots(*)"
    ).eq("id", contractor_id).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found"
        )

    record = response.data[0]

    # Parse availability slots
    slots = []
    for slot_record in record.get("availability_slots", []):
        slots.append(AvailabilitySlot(
            id=slot_record["id"],
            date=slot_record["date"],
            start_time=slot_record["start_time"],
            end_time=slot_record["end_time"],
            location=Location(
                suburb=slot_record["suburb"],
                state=slot_record["state"],
                postcode=slot_record.get("postcode")
            ),
            status=slot_record["status"],
            notes=slot_record.get("notes")
        ))

    contractor = Contractor(
        id=record["id"],
        name=record["name"],
        mobile=record["mobile"],
        abn=record.get("abn"),
        email=record.get("email"),
        specialisation=record.get("specialisation"),
        created_at=record["created_at"],
        updated_at=record["updated_at"],
        availabilitySlots=slots
    )

    return contractor


@router.post(
    "/",
    response_model=Contractor,
    status_code=status.HTTP_201_CREATED,
    summary="Create new contractor",
    description="Register a new contractor with Australian validation",
)
async def create_contractor(contractor: ContractorCreate) -> Contractor:
    """Create new contractor in Supabase."""
    # Insert into database
    insert_data = {
        "id": str(uuid4()),
        "name": contractor.name,
        "mobile": contractor.mobile,
        "abn": contractor.abn,
        "email": contractor.email,
        "specialisation": contractor.specialisation,
    }

    response = supabase.table("contractors").insert(insert_data).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create contractor"
        )

    record = response.data[0]

    return Contractor(
        id=record["id"],
        name=record["name"],
        mobile=record["mobile"],
        abn=record.get("abn"),
        email=record.get("email"),
        specialisation=record.get("specialisation"),
        created_at=record["created_at"],
        updated_at=record["updated_at"],
        availabilitySlots=[]
    )


@router.patch(
    "/{contractor_id}",
    response_model=Contractor,
    summary="Update contractor",
    description="Update contractor details (partial update)",
)
async def update_contractor(
    contractor_id: str,
    updates: ContractorUpdate,
) -> Contractor:
    """Update contractor in Supabase."""
    # Check if contractor exists
    existing = supabase.table("contractors").select("id").eq(
        "id", contractor_id
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found"
        )

    # Update only provided fields
    update_data = updates.model_dump(exclude_unset=True)

    if update_data:
        response = supabase.table("contractors").update(
            update_data
        ).eq("id", contractor_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update contractor"
            )

    # Return updated contractor
    return await get_contractor(contractor_id)


@router.delete(
    "/{contractor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete contractor",
    description="Remove contractor from system",
)
async def delete_contractor(contractor_id: str):
    """Delete contractor from Supabase (cascades to availability slots)."""
    # Check if contractor exists
    existing = supabase.table("contractors").select("id").eq(
        "id", contractor_id
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found"
        )

    # Delete contractor (cascades to availability_slots)
    supabase.table("contractors").delete().eq("id", contractor_id).execute()

    return None


@router.post(
    "/{contractor_id}/availability",
    response_model=AvailabilitySlot,
    status_code=status.HTTP_201_CREATED,
    summary="Add availability slot",
    description="Add availability slot for contractor (Brisbane focus)",
)
async def add_availability_slot(
    contractor_id: str,
    slot: AvailabilitySlotCreate,
) -> AvailabilitySlot:
    """Add availability slot to Supabase."""
    # Check if contractor exists
    existing = supabase.table("contractors").select("id").eq(
        "id", contractor_id
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found"
        )

    # Insert availability slot
    insert_data = {
        "id": str(uuid4()),
        "contractor_id": contractor_id,
        "date": slot.date.isoformat(),
        "start_time": slot.startTime,
        "end_time": slot.endTime,
        "suburb": slot.location.suburb,
        "state": slot.location.state,
        "postcode": slot.location.postcode,
        "status": slot.status,
        "notes": slot.notes,
    }

    response = supabase.table("availability_slots").insert(insert_data).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create availability slot"
        )

    record = response.data[0]

    return AvailabilitySlot(
        id=record["id"],
        date=record["date"],
        start_time=record["start_time"],
        end_time=record["end_time"],
        location=Location(
            suburb=record["suburb"],
            state=record["state"],
            postcode=record.get("postcode")
        ),
        status=record["status"],
        notes=record.get("notes")
    )


@router.get(
    "/{contractor_id}/availability",
    response_model=list[AvailabilitySlot],
    summary="Get contractor availability",
    description="List all availability slots for contractor",
)
async def get_contractor_availability(
    contractor_id: str,
    status_filter: AvailabilityStatus | None = Query(
        None,
        alias="status",
        description="Filter by status (available, booked, tentative)"
    ),
) -> list[AvailabilitySlot]:
    """Get contractor availability from Supabase."""
    # Check if contractor exists
    existing = supabase.table("contractors").select("id").eq(
        "id", contractor_id
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found"
        )

    # Query availability slots
    query = supabase.table("availability_slots").select(
        "*"
    ).eq("contractor_id", contractor_id)

    if status_filter:
        query = query.eq("status", status_filter.value)

    response = query.order("date").execute()

    # Convert to Pydantic models
    slots = []
    for record in response.data:
        slots.append(AvailabilitySlot(
            id=record["id"],
            date=record["date"],
            start_time=record["start_time"],
            end_time=record["end_time"],
            location=Location(
                suburb=record["suburb"],
                state=record["state"],
                postcode=record.get("postcode")
            ),
            status=record["status"],
            notes=record.get("notes")
        ))

    return slots


@router.get(
    "/search/by-location",
    response_model=ContractorList,
    summary="Search contractors by location",
    description="Find contractors available in specific Brisbane suburbs",
)
async def search_by_location(
    suburb: Annotated[str, Query(description="Brisbane suburb (e.g., Indooroopilly)")],
    state: AustralianState = Query(
        AustralianState.QLD,
        description="Australian state (default: QLD)"
    ),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ContractorList:
    """Search contractors by location in Supabase."""
    # Query availability slots matching location
    offset = (page - 1) * page_size

    # Get contractors with matching availability slots
    response = supabase.table("availability_slots").select(
        "contractor_id, contractors(*)"
    ).ilike("suburb", suburb).eq("state", state.value).execute()

    # Get unique contractors
    contractor_ids = set()
    contractors_map = {}

    for record in response.data:
        contractor_id = record["contractor_id"]
        if contractor_id not in contractor_ids:
            contractor_ids.add(contractor_id)
            contractor_data = record["contractors"]
            contractors_map[contractor_id] = contractor_data

    # Get full contractor details with availability
    contractors = []
    for contractor_id in list(contractor_ids)[offset:offset + page_size]:
        try:
            contractor = await get_contractor(contractor_id)
            contractors.append(contractor)
        except HTTPException:
            continue

    return ContractorList(
        contractors=contractors,
        total=len(contractor_ids),
        page=page,
        page_size=page_size
    )
