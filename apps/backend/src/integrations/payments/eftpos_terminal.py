"""EFTPOS terminal integration via PC-EFTPOS / Linkly protocol."""
import asyncio
import os
from decimal import Decimal

import httpx


class EFTPOSTerminal:
    """Linkly/PC-EFTPOS cloud API integration for AU retail EFTPOS."""

    BASE_URL = "https://pos.sandbox.cloud.pceftpos.com/v1"  # prod: pos.cloud.pceftpos.com

    def __init__(self):
        self.username = os.environ.get("EFTPOS_USERNAME", "")
        self.password = os.environ.get("EFTPOS_PASSWORD", "")
        self.pos_name = os.environ.get("EFTPOS_POS_NAME", "CCW-CRM")

    def _auth(self) -> tuple[str, str]:
        return (self.username, self.password)

    async def initiate_purchase(self, amount: Decimal, txn_ref: str) -> dict:
        """Initiate EFTPOS purchase transaction.

        Returns:
            dict with keys: session_id, status, qr_code_url (if applicable)
        """
        payload = {
            "amount": int(amount * 100),
            "txnRef": txn_ref,
            "txnType": "P",
            "posName": self.pos_name,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/sessions",
                json=payload,
                auth=self._auth(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_transaction_status(self, session_id: str) -> dict:
        """Poll transaction status.

        Returns:
            dict with keys: status, approved, receipt_text
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/sessions/{session_id}",
                auth=self._auth(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def initiate_refund(self, amount: Decimal, txn_ref: str) -> dict:
        """Initiate EFTPOS refund.

        Returns:
            dict with keys: session_id, status
        """
        payload = {
            "amount": int(amount * 100),
            "txnRef": txn_ref,
            "txnType": "R",
            "posName": self.pos_name,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/sessions",
                json=payload,
                auth=self._auth(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()
