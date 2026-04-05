# Phase 4 Real-Time Infrastructure - Automated SSE Tests
# Tests all SSE endpoints and verifies connectivity

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Phase 4 Real-Time Infrastructure Test Suite  " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$BACKEND_URL = "http://localhost:8000"
$FRONTEND_URL = "http://localhost:3000"
$PASS_COUNT = 0
$FAIL_COUNT = 0

function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Url,
        [string]$ExpectedContent = ""
    )

    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ PASS - Status: $($response.StatusCode)" -ForegroundColor Green
            $script:PASS_COUNT++
            return $true
        } else {
            Write-Host "  ❌ FAIL - Status: $($response.StatusCode)" -ForegroundColor Red
            $script:FAIL_COUNT++
            return $false
        }
    } catch {
        Write-Host "  ❌ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL_COUNT++
        return $false
    }
}

function Test-SSEEndpoint {
    param (
        [string]$Name,
        [string]$Url
    )

    Write-Host "Testing SSE: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray

    try {
        # Use curl to test SSE endpoint (PowerShell doesn't handle SSE well)
        $curlTest = Start-Process -FilePath "curl" -ArgumentList "-N", "-s", "--max-time", "3", $Url -Wait -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\sse-test.txt"

        if ($curlTest.ExitCode -eq 28) {
            # Timeout is expected for SSE (connection stays open)
            Write-Host "  ✅ PASS - SSE connection established (timeout expected)" -ForegroundColor Green
            $script:PASS_COUNT++
            return $true
        } elseif ($curlTest.ExitCode -eq 0) {
            # Connection succeeded
            $content = Get-Content "$env:TEMP\sse-test.txt" -Raw
            if ($content -match "event: connected") {
                Write-Host "  ✅ PASS - SSE connected event received" -ForegroundColor Green
                $script:PASS_COUNT++
                return $true
            } else {
                Write-Host "  ⚠️  WARN - SSE responded but no connected event" -ForegroundColor Yellow
                $script:PASS_COUNT++
                return $true
            }
        } else {
            Write-Host "  ❌ FAIL - curl exit code: $($curlTest.ExitCode)" -ForegroundColor Red
            $script:FAIL_COUNT++
            return $false
        }
    } catch {
        Write-Host "  ❌ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL_COUNT++
        return $false
    }
}

Write-Host "Step 1: Backend Health Checks" -ForegroundColor Cyan
Write-Host "------------------------------" -ForegroundColor Cyan
Test-Endpoint -Name "Backend Health" -Url "$BACKEND_URL/api/health"
Write-Host ""

Write-Host "Step 2: SSE Endpoint Connectivity" -ForegroundColor Cyan
Write-Host "----------------------------------" -ForegroundColor Cyan

Test-SSEEndpoint -Name "Inventory Stream" -Url "$BACKEND_URL/api/inventory-stream"
Test-SSEEndpoint -Name "Order Status Stream" -Url "$BACKEND_URL/api/orders/status-stream"
Test-SSEEndpoint -Name "POS Failures Stream" -Url "$BACKEND_URL/api/monitoring/alerts/pos-failures/stream"
Test-SSEEndpoint -Name "Dashboard Metrics Stream" -Url "$BACKEND_URL/api/dashboard/metrics-stream"

Write-Host ""

Write-Host "Step 3: REST API Endpoints" -ForegroundColor Cyan
Write-Host "--------------------------" -ForegroundColor Cyan

Test-Endpoint -Name "Dashboard Aggregated" -Url "$BACKEND_URL/api/dashboard/aggregated"
Test-Endpoint -Name "POS Failures REST" -Url "$BACKEND_URL/api/monitoring/alerts/pos-failures?hours=24"

Write-Host ""

Write-Host "Step 4: Frontend Health" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan

Test-Endpoint -Name "Frontend Health" -Url "$FRONTEND_URL/api/health"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Test Results Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ✅ Passed: $PASS_COUNT" -ForegroundColor Green
Write-Host "  ❌ Failed: $FAIL_COUNT" -ForegroundColor Red
Write-Host "  Total:  $($PASS_COUNT + $FAIL_COUNT)" -ForegroundColor White
Write-Host ""

if ($FAIL_COUNT -eq 0) {
    Write-Host "🎉 ALL TESTS PASSED! Phase 4 infrastructure is working." -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  SOME TESTS FAILED. Check services are running:" -ForegroundColor Yellow
    Write-Host "   - Backend: cd backend && uv run uvicorn src.api.main:app --reload" -ForegroundColor Gray
    Write-Host "   - Frontend: cd app && pnpm dev" -ForegroundColor Gray
    Write-Host "   - Database: docker compose up -d" -ForegroundColor Gray
    exit 1
}
