#!/bin/bash

# Test Alert Script
# Triggers a test alert in AlertManager to verify email notifications

echo "🧪 Testing AlertManager Email Notifications"
echo "============================================"
echo ""

# AlertManager URL
ALERTMANAGER_URL="http://localhost:9093"

# Check if AlertManager is running
if ! curl -s "$ALERTMANAGER_URL/api/v2/status" > /dev/null 2>&1; then
    echo "❌ Error: AlertManager is not running at $ALERTMANAGER_URL"
    echo "   Start it with: docker compose up -d alertmanager"
    exit 1
fi

echo "✅ AlertManager is running"
echo ""

# Send test alert
echo "📧 Sending test critical alert..."
echo ""

curl -s -X POST "$ALERTMANAGER_URL/api/v1/alerts" \
  -H "Content-Type: application/json" \
  -d '[
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
      "startsAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "endsAt": "'$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%S.000Z")'"
    }
  ]'

echo ""
echo ""
echo "✅ Test alert sent successfully!"
echo ""
echo "📬 What happens next:"
echo "   1. AlertManager processes the alert (10 second wait)"
echo "   2. Email is sent to dev-team@ccw-erp.com"
echo "   3. If Slack is configured, notification sent to #alerts-critical"
echo ""
echo "🔍 Check alert status:"
echo "   • AlertManager UI: http://localhost:9093"
echo "   • Active alerts: http://localhost:9093/#/alerts"
echo ""
echo "⏱️  Please wait 10-30 seconds for email delivery"
echo ""
echo "❓ Troubleshooting:"
echo "   • If no email arrives, check SMTP_PASSWORD in .env"
echo "   • Check AlertManager logs: docker logs ccw-alertmanager"
echo "   • Verify email configuration in your Alertmanager deployment"
echo ""
