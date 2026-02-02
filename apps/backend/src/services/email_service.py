"""Email service using SendGrid."""
import os
import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = structlog.get_logger(__name__)

class EmailService:
    def __init__(self, api_key=None, from_email=None, from_name=None):
        self.api_key = api_key or os.getenv("SENDGRID_API_KEY")
        self.from_email = from_email or os.getenv("SENDGRID_FROM_EMAIL", "noreply@ccw-erp.com")
        self.from_name = from_name or os.getenv("SENDGRID_FROM_NAME", "CCW Equipment ERP")
        if not self.api_key:
            raise ValueError("SendGrid API key not provided")
        self.client = SendGridAPIClient(self.api_key)

    async def send_email(self, to_email, subject, html_content, text_content=None, to_name=None):
        try:
            message = Mail(from_email=Email(self.from_email, self.from_name), to_emails=To(to_email, to_name), subject=subject, html_content=Content("text/html", html_content))
            if text_content:
                message.content = [Content("text/plain", text_content), Content("text/html", html_content)]
            response = self.client.send(message)
            logger.info("Email sent", to_email=to_email, status=response.status_code)
            return response.status_code in [200, 201, 202]
        except Exception as e:
            logger.error("Email failed", to_email=to_email, error=str(e))
            raise

    async def send_password_reset_email(self, to_email, to_name, reset_url):
        subject = "Reset Your Password - CCW ERP"
        html = f'<h1>Password Reset</h1><p>Hi {to_name},</p><p><a href="{reset_url}">Reset Password</a></p><p>Expires in 1 hour.</p>'
        text = f'Hi {to_name}, Reset: {reset_url} (Expires in 1 hour)'
        return await self.send_email(to_email, subject, html, text, to_name)

    async def send_magic_link_email(self, to_email, to_name, magic_link):
        subject = "Your Login Link - CCW ERP Portal"
        html = f'<h1>Portal Access</h1><p>Hi {to_name},</p><p><a href="{magic_link}">Access Portal</a></p><p>Expires in 1 hour.</p>'
        text = f'Hi {to_name}, Access: {magic_link} (Expires in 1 hour)'
        return await self.send_email(to_email, subject, html, text, to_name)

_email_service = None

def get_email_service():
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
