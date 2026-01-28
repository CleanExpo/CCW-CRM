"""
Email Service.

Handles sending notification emails via SendGrid.
"""

import os
from datetime import date
from typing import Any

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = structlog.get_logger(__name__)


class EmailService:
    """Service for sending emails via SendGrid."""

    def __init__(self):
        """Initialize email service with SendGrid API key."""
        self.api_key = os.getenv("SENDGRID_API_KEY", "")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@ccw-erp.com")
        self.accounts_team_email = os.getenv("ACCOUNTS_TEAM_EMAIL", "accounts@ccw-erp.com")

        if not self.api_key:
            logger.warning("SendGrid API key not configured - emails will not be sent")

    async def send_bank_feed_sync_summary(
        self,
        date_range: tuple[date, date],
        total_transactions: int,
        total_auto_matched: int,
        account_results: list[dict[str, Any]],
    ) -> None:
        """Send bank feed sync summary email to accounts team.

        Args:
            date_range: (start_date, end_date) tuple
            total_transactions: Total number of transactions synced
            total_auto_matched: Total number of auto-matched transactions
            account_results: List of per-account results

        Raises:
            Exception: If email sending fails (logged but not raised to avoid breaking sync job)
        """
        if not self.api_key:
            logger.warning("SendGrid not configured - skipping email notification")
            return

        start_date, end_date = date_range
        reconciliation_rate = (
            (total_auto_matched / total_transactions * 100) if total_transactions > 0 else 0
        )

        # Build account results table
        account_rows = []
        for result in account_results:
            if "error" in result:
                account_rows.append(
                    f"""
                    <tr style="background-color: #fee;">
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['account_name']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['provider']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">-</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">-</td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: #c00;">Error: {result['error']}</td>
                    </tr>
                    """
                )
            else:
                account_rows.append(
                    f"""
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['account_name']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['provider']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['transactions_synced']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{result['auto_matched']}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: #0a0;">✓ Success</td>
                    </tr>
                    """
                )

        # Email HTML template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Bank Feed Sync Summary</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Bank Feed Sync Summary</h1>

            <p>The daily bank feed synchronization has completed. Here's the summary:</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h2 style="margin-top: 0;">Overall Summary</h2>
                <ul style="list-style: none; padding: 0;">
                    <li><strong>Date Range:</strong> {start_date} to {end_date}</li>
                    <li><strong>Total Transactions Synced:</strong> {total_transactions}</li>
                    <li><strong>Auto-Matched Transactions:</strong> {total_auto_matched}</li>
                    <li><strong>Reconciliation Rate:</strong> {reconciliation_rate:.1f}%</li>
                </ul>
            </div>

            <h2>Account Details</h2>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #333; color: white;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Account</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Provider</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Synced</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Matched</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(account_rows)}
                </tbody>
            </table>

            <div style="margin-top: 30px; padding: 15px; background-color: #e7f3ff; border-left: 4px solid #2196F3;">
                <p style="margin: 0;"><strong>Next Steps:</strong></p>
                <ul style="margin: 10px 0 0 0;">
                    <li>Review unmatched transactions in the POS Reconciliation dashboard</li>
                    <li>Manually reconcile any transactions with confidence &lt; 80%</li>
                    <li>Verify all reconciliations before month-end close</li>
                </ul>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

            <p style="color: #666; font-size: 12px;">
                This is an automated notification from CCW ERP System.<br>
                View full details in the <a href="http://localhost:3000/pos/reconciliation">POS Reconciliation Dashboard</a>
            </p>
        </body>
        </html>
        """

        # Plain text version
        text_content = f"""
Bank Feed Sync Summary

Date Range: {start_date} to {end_date}
Total Transactions Synced: {total_transactions}
Auto-Matched Transactions: {total_auto_matched}
Reconciliation Rate: {reconciliation_rate:.1f}%

Please review unmatched transactions in the POS Reconciliation dashboard.
        """

        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=self.accounts_team_email,
                subject=f"Bank Feed Sync Summary - {date.today()}",
                html_content=html_content,
                plain_text_content=text_content,
            )

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            logger.info(
                "Bank feed sync summary email sent",
                status_code=response.status_code,
                to=self.accounts_team_email,
            )

        except Exception as e:
            logger.error(
                "Failed to send bank feed sync summary email",
                error=str(e),
            )
            # Don't raise - email failure shouldn't break the sync job

    async def send_reconciliation_alert(
        self,
        unmatched_count: int,
        low_confidence_count: int,
    ) -> None:
        """Send alert when reconciliation rate is low.

        Args:
            unmatched_count: Number of unmatched transactions
            low_confidence_count: Number of low-confidence matches
        """
        if not self.api_key:
            logger.warning("SendGrid not configured - skipping email notification")
            return

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reconciliation Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                <h2 style="margin-top: 0; color: #856404;">⚠️ Reconciliation Alert</h2>
                <p>There are transactions requiring manual review:</p>
                <ul>
                    <li><strong>{unmatched_count}</strong> unmatched transactions</li>
                    <li><strong>{low_confidence_count}</strong> low-confidence matches</li>
                </ul>
            </div>

            <p><strong>Action Required:</strong></p>
            <ol>
                <li>Review unmatched transactions in the reconciliation dashboard</li>
                <li>Manually match transactions where possible</li>
                <li>Investigate any discrepancies</li>
            </ol>

            <p style="margin-top: 30px;">
                <a href="http://localhost:3000/pos/reconciliation"
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    View Reconciliation Dashboard
                </a>
            </p>
        </body>
        </html>
        """

        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=self.accounts_team_email,
                subject="⚠️ POS Reconciliation Alert",
                html_content=html_content,
            )

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            logger.info(
                "Reconciliation alert email sent",
                status_code=response.status_code,
            )

        except Exception as e:
            logger.error(
                "Failed to send reconciliation alert email",
                error=str(e),
            )
