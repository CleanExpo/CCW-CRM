"""Cin7 GL — Pydantic request/response schemas.

Demo data fixtures live in cin7_gl_demo.py.
SQLAlchemy models live in src/db/cin7_gl_models.py.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChartOfAccountResponse(BaseModel):
    id: str
    cin7_account_id: str
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: str | None
    is_active: bool
    currency: str
    description: str | None
    last_synced_at: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ChartOfAccountsListResponse(BaseModel):
    accounts: list[ChartOfAccountResponse]
    total: int


class SyncChartOfAccountsResponse(BaseModel):
    synced: int
    created: int
    updated: int
    message: str


class JournalLineResponse(BaseModel):
    id: str
    journal_entry_id: str
    account_id: str
    account_code: str | None = None
    account_name: str | None = None
    line_type: str
    amount: str
    description: str | None
    order_id: str | None
    tax_amount: str

    model_config = {"from_attributes": True}


class JournalEntryResponse(BaseModel):
    id: str
    cin7_journal_id: str | None
    journal_date: str
    reference: str | None
    description: str | None
    status: str
    total_debit: str
    total_credit: str
    currency: str
    source: str
    cin7_synced: bool
    created_at: str
    updated_at: str
    lines: list[JournalLineResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class JournalEntriesListResponse(BaseModel):
    entries: list[JournalEntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class JournalLineCreateRequest(BaseModel):
    account_id: str = Field(..., description="UUID of the GL account")
    line_type: str = Field(..., description="'debit' or 'credit'")
    amount: float = Field(..., gt=0, description="Positive amount")
    description: str | None = None
    tax_amount: float = Field(default=0.0, ge=0)


class JournalEntryCreateRequest(BaseModel):
    journal_date: str = Field(..., description="ISO date string YYYY-MM-DD")
    reference: str | None = None
    description: str | None = None
    currency: str = "AUD"
    lines: list[JournalLineCreateRequest] = Field(
        ..., min_length=2, description="At least one debit and one credit line"
    )


class AccountMappingResponse(BaseModel):
    id: str
    erp_entity_type: str
    erp_field: str
    cin7_account_id: str | None
    account_code: str | None
    account_name: str | None = None
    is_default: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class AccountMappingsListResponse(BaseModel):
    mappings: list[AccountMappingResponse]
    total: int


class UpsertAccountMappingRequest(BaseModel):
    erp_entity_type: str = Field(..., description="ERP entity type (order/invoice/...)")
    erp_field: str = Field(..., description="ERP field name (revenue/receivable/...)")
    account_code: str | None = None
    cin7_account_id: str | None = None
    is_default: bool = False
