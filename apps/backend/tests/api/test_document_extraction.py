"""Integration tests for Sprint 3 Document Extraction endpoints.

Tests:
  POST /api/documents/extract-invoice     — Claude Vision invoice OCR
  POST /api/documents/extract-po          — Claude Vision PO OCR
  POST /api/documents/extract-and-create  — extract + create draft record

All tests run in demo mode (no ANTHROPIC_API_KEY required).
Uses a minimal PNG (1x1 pixel) as the upload payload — demo mode ignores image content.
"""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient

# Minimal 1×1 white pixel PNG (valid image for upload testing)
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _png_upload(filename: str = "test_invoice.png"):
    return {"file": (filename, io.BytesIO(MINIMAL_PNG), "image/png")}


@pytest.mark.asyncio
class TestExtractInvoice:
    """Tests for POST /api/documents/extract-invoice."""

    async def test_extract_invoice_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_extract_invoice_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("document_type", "confidence", "extracted_data", "warnings"):
            assert field in body, f"Missing field: {field}"

    async def test_extract_invoice_document_type(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        assert resp.json()["document_type"] == "invoice"

    async def test_extract_invoice_confidence_range(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        conf = resp.json()["confidence"]
        assert 0.0 <= conf <= 1.0

    async def test_extract_invoice_demo_has_line_items(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        extracted = resp.json()["extracted_data"]
        assert "line_items" in extracted
        assert len(extracted["line_items"]) > 0

    async def test_extract_invoice_demo_has_vendor(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        extracted = resp.json()["extracted_data"]
        assert "vendor" in extracted
        assert "name" in extracted["vendor"]

    async def test_extract_invoice_demo_has_totals(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files=_png_upload(),
            headers=auth_headers,
        )
        extracted = resp.json()["extracted_data"]
        assert "totals" in extracted

    async def test_extract_invoice_unsupported_type_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-invoice",
            files={"file": ("test.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
            headers=auth_headers,
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
class TestExtractPurchaseOrder:
    """Tests for POST /api/documents/extract-po."""

    async def test_extract_po_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-po",
            files=_png_upload("test_po.png"),
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_extract_po_document_type(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-po",
            files=_png_upload("test_po.png"),
            headers=auth_headers,
        )
        assert resp.json()["document_type"] == "purchase_order"

    async def test_extract_po_demo_has_line_items(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-po",
            files=_png_upload("test_po.png"),
            headers=auth_headers,
        )
        extracted = resp.json()["extracted_data"]
        assert "line_items" in extracted
        assert len(extracted["line_items"]) > 0

    async def test_extract_po_demo_has_po_number(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-po",
            files=_png_upload("test_po.png"),
            headers=auth_headers,
        )
        extracted = resp.json()["extracted_data"]
        assert "purchase_order" in extracted
        assert "po_number" in extracted["purchase_order"]


@pytest.mark.asyncio
class TestExtractAndCreate:
    """Tests for POST /api/documents/extract-and-create."""

    async def test_extract_and_create_invoice_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-and-create",
            data={"document_type": "invoice"},
            files=_png_upload(),
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_extract_and_create_returns_record_id(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-and-create",
            data={"document_type": "invoice"},
            files=_png_upload(),
            headers=auth_headers,
        )
        body = resp.json()
        assert body["created_record_id"] is not None
        assert len(body["created_record_id"]) > 0

    async def test_extract_and_create_po(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-and-create",
            data={"document_type": "purchase_order"},
            files=_png_upload("po.png"),
            headers=auth_headers,
        )
        body = resp.json()
        assert resp.status_code == 200
        assert body["document_type"] == "purchase_order"
        assert body["created_record_type"] == "purchase_order"

    async def test_extract_and_create_invalid_type_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-and-create",
            data={"document_type": "unknown"},
            files=_png_upload(),
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_extract_and_create_response_has_message(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/documents/extract-and-create",
            data={"document_type": "invoice"},
            files=_png_upload(),
            headers=auth_headers,
        )
        body = resp.json()
        assert "message" in body
        assert len(body["message"]) > 0

