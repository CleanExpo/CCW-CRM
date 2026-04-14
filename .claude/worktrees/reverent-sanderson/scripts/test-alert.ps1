# Test Alert Script (PowerShell)
# Triggers a test alert in AlertManager to verify email notifications

Write-Host "🧪 Testing AlertManager Email Notifications" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# AlertManager URL
$ALERTMANAGER_URL = "http://localhost:9093"

# Check if AlertManager is running
try {
    $null = Invoke-WebRequest -Uri "$ALERTMANAGER_URL/api/v2/status" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ AlertManager is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: AlertManager is not running at $ALERTMANAGER_URL" -ForegroundColor Red
    Write-Host "   Start it with: docker compose up -d alertmanager" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Send test alert
Write-Host "📧 Sending test critical alert..." -ForegroundColor Cyan
Write-Host ""

$startsAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$endsAt = (Get-Date).AddMinutes(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")

$body = @"
[
  {
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical",
      "service": "test",
      "instance": "localhost:9093"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Testing email notification system. This alert should trigger an email to dev-team@ccw-erp.com. If you receive this email, the alert system is working correctly."
    },
    "startsAt": "$startsAt",
    "endsAt": "$endsAt"
  }
]
"@

try {
    $response = Invoke-RestMethod -Uri "$ALERTMANAGER_URL/api/v1/alerts" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop

    Write-Host ""
    Write-Host "✅ Test alert sent successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to send test alert: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📬 What happens next:" -ForegroundColor Cyan
Write-Host "   1. AlertManager processes the alert (10 second wait)"
Write-Host "   2. Email is sent to dev-team@ccw-erp.com"
Write-Host "   3. If Slack is configured, notification sent to #alerts-critical"
Write-Host ""
Write-Host "🔍 Check alert status:" -ForegroundColor Cyan
Write-Host "   • AlertManager UI: http://localhost:9093"
Write-Host "   • Active alerts: http://localhost:9093/#/alerts"
Write-Host ""
Write-Host "⏱️  Please wait 10-30 seconds for email delivery" -ForegroundColor Yellow
Write-Host ""
Write-Host "❓ Troubleshooting:" -ForegroundColor Cyan
Write-Host "   • If no email arrives, check SMTP_PASSWORD in .env"
Write-Host "   • Check AlertManager logs: docker logs ccw-alertmanager"
Write-Host "   • Verify email configuration in monitoring/alertmanager/config.yml"
Write-Host ""
