"""Xero Payroll API — STP Phase 2 (UNI-1860).

Implements ATO Single Touch Payroll Phase 2 requirements:
- Employee listing with employment classification
- Pay event submission with income type disaggregation (SAL)
- Leave balance retrieval
"""

from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)

PAYROLL_BASE = "https://api.xero.com/payroll.xro/1.0"


async def get_payroll_employees(xero_client) -> list[dict]:
    """Fetch employees from Xero Payroll API.

    Args:
        xero_client: Authenticated XeroClient instance.

    Returns:
        List of employee dicts with key STP Phase 2 fields.
    """
    url = f"{PAYROLL_BASE}/Employees"
    headers = xero_client._get_headers()

    async with xero_client._http_client as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    employees = data.get("Employees", [])
    return [
        {
            "employee_id": emp.get("EmployeeID"),
            "first_name": emp.get("FirstName"),
            "last_name": emp.get("LastName"),
            "tax_file_number_status": emp.get("TaxDeclaration", {}).get("TFNExemptionType", "PROVIDED"),
            "employment_basis": emp.get("EmploymentType", "FULLTIME"),
        }
        for emp in employees
    ]


async def submit_pay_event(xero_client, pay_run_data: dict) -> dict:
    """Submit a pay run to Xero with STP Phase 2 income type disaggregation.

    STP Phase 2 requires IncomeType disaggregation on each payslip line.
    Defaults to "SAL" (salary/wages) when not specified.

    Args:
        xero_client: Authenticated XeroClient instance.
        pay_run_data: Pay run payload (Xero PayRun schema).

    Returns:
        Xero API response dict.
    """
    # STP Phase 2: inject IncomeType on every payslip line item
    for payslip in pay_run_data.get("Payslips", []):
        for line in payslip.get("EarningsLines", []):
            line.setdefault("IncomeType", "SAL")

    url = f"{PAYROLL_BASE}/PayRuns"
    headers = xero_client._get_headers()

    async with xero_client._http_client as client:
        response = await client.post(url, headers=headers, json={"PayRuns": [pay_run_data]})
        response.raise_for_status()
        data = response.json()

    logger.info("Pay event submitted", pay_run_id=data.get("PayRuns", [{}])[0].get("PayRunID"))
    return data


async def get_leave_balances(xero_client, employee_id: str) -> dict:
    """Fetch leave balances for an employee.

    Args:
        xero_client: Authenticated XeroClient instance.
        employee_id: Xero employee UUID string.

    Returns:
        Dict with employee_id and list of leave balance records.
    """
    url = f"{PAYROLL_BASE}/Employees/{employee_id}/leavebalances"
    headers = xero_client._get_headers()

    async with xero_client._http_client as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    return {
        "employee_id": employee_id,
        "leave_balances": data.get("LeaveBalances", []),
    }
