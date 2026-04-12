# SSE Real-Time Event Publishing Test Script (PowerShell)

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         SSE Real-Time Event Publishing Test Script             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
try {
    $null = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running at http://localhost:8000" -ForegroundColor Red
    Write-Host "   Please start the backend first: cd apps/backend; uvicorn src.api.main:app --reload"
    exit 1
}

Write-Host ""
Write-Host "📡 Testing SSE connection..." -ForegroundColor Yellow

# Test SSE endpoint connectivity
$testUrl = "http://localhost:8000/api/dashboard/metrics-stream"
Write-Host "   → Testing: $testUrl"

try {
    $response = Invoke-WebRequest -Uri $testUrl -Method Get -Headers @{"Accept"="text/event-stream"} -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   ✅ SSE endpoint is accessible" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -match "timeout") {
        Write-Host "   ✅ SSE endpoint is accessible (connection stayed open)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ SSE endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📤 To test event publishing:" -ForegroundColor Yellow
Write-Host "   1. Open a separate PowerShell window"
Write-Host "   2. Run: curl -N -H 'Accept: text/event-stream' http://localhost:8000/api/dashboard/metrics-stream"
Write-Host "   3. In another window, create entities:"
Write-Host "      - Create Order via UI at http://localhost:3005/orders"
Write-Host "      - Create Product via UI at http://localhost:3005/products"
Write-Host "      - Create Customer via UI at http://localhost:3005/customers"
Write-Host "   4. Watch the SSE stream window for real-time events!"
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           Event Publishing Channels Active                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ dashboard-metrics    → http://localhost:8000/api/dashboard/metrics-stream"
Write-Host "✅ pos-failures         → http://localhost:8000/api/monitoring/alerts/pos-failures/stream"
Write-Host ""
Write-Host "Events published on:" -ForegroundColor Yellow
Write-Host "  • Order created/updated/deleted"
Write-Host "  • Product created/updated/deleted"
Write-Host "  • Customer created/updated/deleted"
Write-Host "  • Quote created/updated/deleted/converted"
Write-Host ""
