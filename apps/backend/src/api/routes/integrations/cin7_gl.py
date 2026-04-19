"""Cin7 Financial/GL Integration — aggregator router (UNI-1931).

Composes domain sub-routers under /api/cin7:
  - Chart of Accounts  (cin7_gl_coa)
  - Journal Entries    (cin7_gl_journals + cin7_gl_journals_write)
  - Account Mappings   (cin7_gl_mappings)

main.py continues to import `cin7_gl.router` — public API unchanged.
"""

from fastapi import APIRouter

from .cin7_gl_coa import _coa_router
from .cin7_gl_journals import _journals_router
from .cin7_gl_journals_write import _journals_write_router
from .cin7_gl_mappings import _mappings_router

router = APIRouter(prefix="/api/cin7", tags=["Cin7 Financial/GL"])
router.include_router(_coa_router)
router.include_router(_journals_router)
router.include_router(_journals_write_router)
router.include_router(_mappings_router)
