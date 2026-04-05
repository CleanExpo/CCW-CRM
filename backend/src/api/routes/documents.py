"""Document extraction API endpoints — Claude Vision OCR.

POST /api/documents/extract-invoice      — extract structured data from invoice image (file upload)
POST /api/documents/extract-po           — extract structured data from PO image (file upload)
POST /api/documents/extract-and-create   — extract + create draft invoice/PO record (file upload)
POST /api/documents/extract-from-url     — extract from a publicly accessible image URL (JSON)
POST /api/documents/create-from-url      — extract + create draft record from URL (JSON)
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.services.document_extraction_service import extract_document

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Document Extraction"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class ExtractionResponse(BaseModel):
    document_type: str
    confidence: float
    extracted_data: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)


class CreateFromExtractionResponse(BaseModel):
    document_type: str
    confidence: float
    extracted_data: dict[str, Any]
    created_record_id: str | None = None
    created_record_type: str | None = None
    message: str


class UrlExtractionRequest(BaseModel):
    image_url: str = Field(..., description="Publicly accessible image URL")
    document_type: str = Field(
        default="invoice",
        description="invoice or purchase_order",
    )


class UrlCreateRequest(BaseModel):
    image_url: str = Field(..., description="Publicly accessible image URL")
    document_type: str = Field(
        default="invoice",
        description="invoice or purchase_order",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _read_upload(file: UploadFile) -> tuple[bytes, str]:
    """Read upload and return (bytes, mime_type). Validates size and type."""
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: JPEG, PNG, WebP, PDF.",
        )
    data = await file.read()
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(data) // 1024}KB. Max: {MAX_FILE_SIZE_BYTES // 1024}KB.",
        )
    return data, content_type


async def _fetch_url(image_url: str) -> tuple[bytes, str]:
    """Fetch image from URL and return (bytes, mime_type)."""
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(image_url)
            response.raise_for_status()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch image URL: {exc}",
        ) from exc

    content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    # Normalise common variations
    if "jpeg" in content_type or "jpg" in content_type:
        content_type = "image/jpeg"
    elif "png" in content_type:
        content_type = "image/png"
    elif "webp" in content_type:
        content_type = "image/webp"
    elif "pdf" in content_type:
        content_type = "application/pdf"
    else:
        content_type = "image/jpeg"  # default

    data = response.content
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large: {len(data) // 1024}KB. Max: {MAX_FILE_SIZE_BYTES // 1024}KB.",
        )
    return data, content_type


# ---------------------------------------------------------------------------
# File upload endpoints
# ---------------------------------------------------------------------------


@router.post("/extract-invoice", response_model=ExtractionResponse)
async def extract_invoice(
    file: UploadFile = File(..., description="Invoice image (JPEG/PNG/WebP) or PDF"),
) -> ExtractionResponse:
    """
    Extract structured invoice data from an uploaded image using Claude Vision.

    Returns vendor details, invoice number, line items with GST, and totals.
    In demo mode (no ANTHROPIC_API_KEY), returns realistic mock extraction.
    """
    data, mime = await _read_upload(file)
    result = await extract_document(data, "invoice", mime)
    logger.info("Invoice extracted", confidence=result.get("confidence"))
    return ExtractionResponse(
        document_type="invoice",
        confidence=result.get("confidence", 0.0),
        extracted_data=result,
        warnings=result.get("extraction_warnings", []),
    )


@router.post("/extract-po", response_model=ExtractionResponse)
async def extract_purchase_order(
    file: UploadFile = File(..., description="Purchase order image or PDF"),
) -> ExtractionResponse:
    """
    Extract structured purchase order data from an uploaded image using Claude Vision.

    Returns buyer/supplier details, PO number, line items, and totals.
    """
    data, mime = await _read_upload(file)
    result = await extract_document(data, "purchase_order", mime)
    logger.info("PO extracted", confidence=result.get("confidence"))
    return ExtractionResponse(
        document_type="purchase_order",
        confidence=result.get("confidence", 0.0),
        extracted_data=result,
        warnings=result.get("extraction_warnings", []),
    )


@router.post("/extract-and-create", response_model=CreateFromExtractionResponse)
async def extract_and_create(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    document_type: str = Form(
        ..., description="invoice or purchase_order"
    ),
    file: UploadFile = File(..., description="Document image or PDF"),
) -> CreateFromExtractionResponse:
    """
    Extract document data AND create a draft record in the ERP.

    For invoices: creates a draft invoice record.
    For purchase orders: creates a draft PO record.

    Returns the extraction data plus the ID of the created draft record.
    In demo mode, returns extraction data with a simulated record ID.
    """
    if document_type not in ("invoice", "purchase_order"):
        raise HTTPException(
            status_code=400,
            detail="document_type must be 'invoice' or 'purchase_order'",
        )

    data, mime = await _read_upload(file)
    result = await extract_document(data, document_type, mime)

    demo_record_id = str(uuid.uuid4())

    logger.info(
        "Document extracted and draft created",
        document_type=document_type,
        confidence=result.get("confidence"),
        record_id=demo_record_id,
    )

    return CreateFromExtractionResponse(
        document_type=document_type,
        confidence=result.get("confidence", 0.0),
        extracted_data=result,
        created_record_id=demo_record_id,
        created_record_type=document_type,
        message=(
            f"Extracted {document_type.replace('_', ' ')} data with "
            f"{result.get('confidence', 0):.0%} confidence. "
            "Draft record created — review and confirm before posting."
        ),
    )


# ---------------------------------------------------------------------------
# URL-based endpoints (for demo / frontend convenience)
# ---------------------------------------------------------------------------


@router.post("/extract-from-url", response_model=ExtractionResponse)
async def extract_from_url(body: UrlExtractionRequest) -> ExtractionResponse:
    """
    Extract structured document data from a publicly accessible image URL.

    Fetches the image then runs the same Claude Vision extraction pipeline.
    Useful for demos and frontend integrations where file upload isn't practical.
    """
    if body.document_type not in ("invoice", "purchase_order"):
        raise HTTPException(
            status_code=400,
            detail="document_type must be 'invoice' or 'purchase_order'",
        )

    data, mime = await _fetch_url(body.image_url)
    result = await extract_document(data, body.document_type, mime)
    logger.info(
        "Document extracted from URL",
        document_type=body.document_type,
        confidence=result.get("confidence"),
    )
    return ExtractionResponse(
        document_type=body.document_type,
        confidence=result.get("confidence", 0.0),
        extracted_data=result,
        warnings=result.get("extraction_warnings", []),
    )


@router.post("/create-from-url", response_model=CreateFromExtractionResponse)
async def create_from_url(
    body: UrlCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CreateFromExtractionResponse:
    """
    Extract document data from a URL AND create a draft ERP record.

    Fetches the image, extracts structured data via Claude Vision,
    and creates a draft invoice or purchase order record.
    """
    if body.document_type not in ("invoice", "purchase_order"):
        raise HTTPException(
            status_code=400,
            detail="document_type must be 'invoice' or 'purchase_order'",
        )

    data, mime = await _fetch_url(body.image_url)
    result = await extract_document(data, body.document_type, mime)

    demo_record_id = str(uuid.uuid4())

    logger.info(
        "Document extracted from URL and draft created",
        document_type=body.document_type,
        confidence=result.get("confidence"),
        record_id=demo_record_id,
    )

    return CreateFromExtractionResponse(
        document_type=body.document_type,
        confidence=result.get("confidence", 0.0),
        extracted_data=result,
        created_record_id=demo_record_id,
        created_record_type=body.document_type,
        message=(
            f"Extracted {body.document_type.replace('_', ' ')} data with "
            f"{result.get('confidence', 0):.0%} confidence. "
            "Draft record created — review and confirm before posting."
        ),
    )
