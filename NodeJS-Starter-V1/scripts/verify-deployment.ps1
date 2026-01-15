# Verify Railway Deployment
# This script verifies that the backend deployment on Railway is working correctly
# Usage: .\scripts\verify-deployment.ps1 https://your-app.up.railway.app

param(
    [Parameter(Mandatory=$true)]
    [string]$BackendUrl
)

Write-Host "======================================"
Write-Host " Railway Deployment Verification"
Write-Host "======================================"
Write-Host ""
Write-Host "Backend URL: $BackendUrl"
Write-Host ""

$ErrorCount = 0
$SuccessCount = 0

# Remove trailing slash if present
$BackendUrl = $BackendUrl.TrimEnd('/')

# Test 1: Health Check
Write-Host "Test 1: Health Check Endpoint..."
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health" -Method Get -TimeoutSec 10
    if ($response.status -eq "healthy") {
        Write-Host "   ✅ PASS: Health check returned healthy status" -ForegroundColor Green
        $SuccessCount++
    } else {
        Write-Host "   ❌ FAIL: Health check status is not healthy: $($response.status)" -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "   ❌ FAIL: Health check failed - $($_.Exception.Message)" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 2: API Documentation
Write-Host "Test 2: API Documentation (Swagger UI)..."
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/docs" -Method Get -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ PASS: API docs accessible at $BackendUrl/docs" -ForegroundColor Green
        $SuccessCount++
    } else {
        Write-Host "   ❌ FAIL: API docs returned status code $($response.StatusCode)" -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "   ❌ FAIL: API docs failed - $($_.Exception.Message)" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 3: CORS Headers
Write-Host "Test 3: CORS Headers Configuration..."
try {
    $headers = @{
        "Origin" = "http://localhost:3000"
        "Access-Control-Request-Method" = "POST"
    }
    $response = Invoke-WebRequest -Uri "$BackendUrl/api/auth/login" -Method Options -Headers $headers -TimeoutSec 10
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -and ($corsHeader -eq "http://localhost:3000" -or $corsHeader -eq "*")) {
        Write-Host "   ✅ PASS: CORS configured correctly" -ForegroundColor Green
        $SuccessCount++
    } else {
        Write-Host "   ⚠️  WARN: CORS might not be configured (expected localhost:3000 or *)" -ForegroundColor Yellow
        Write-Host "   Current CORS origin: $corsHeader"
    }
} catch {
    Write-Host "   ⚠️  WARN: Could not verify CORS - $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Authentication Endpoint
Write-Host "Test 4: Authentication Endpoint..."
try {
    $body = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BackendUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10

    if ($response.access_token) {
        Write-Host "   ✅ PASS: Authentication working, token received" -ForegroundColor Green
        $SuccessCount++
    } else {
        Write-Host "   ❌ FAIL: Authentication succeeded but no token received" -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   ⚠️  WARN: Authentication failed - this is expected if demo user doesn't exist yet" -ForegroundColor Yellow
        Write-Host "   Run database migrations and seed data on Railway"
    } else {
        Write-Host "   ❌ FAIL: Authentication endpoint failed - $($_.Exception.Message)" -ForegroundColor Red
        $ErrorCount++
    }
}
Write-Host ""

# Test 5: Security Headers
Write-Host "Test 5: Security Headers..."
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/health" -Method Get -TimeoutSec 10

    $securityHeaders = @{
        "Content-Security-Policy" = $response.Headers["Content-Security-Policy"]
        "X-Frame-Options" = $response.Headers["X-Frame-Options"]
        "X-Content-Type-Options" = $response.Headers["X-Content-Type-Options"]
        "Referrer-Policy" = $response.Headers["Referrer-Policy"]
    }

    $missingHeaders = @()
    foreach ($header in $securityHeaders.Keys) {
        if (-not $securityHeaders[$header]) {
            $missingHeaders += $header
        }
    }

    if ($missingHeaders.Count -eq 0) {
        Write-Host "   ✅ PASS: All security headers present" -ForegroundColor Green
        $SuccessCount++
    } else {
        Write-Host "   ⚠️  WARN: Missing security headers: $($missingHeaders -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  WARN: Could not verify security headers - $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "======================================"
Write-Host " Verification Summary"
Write-Host "======================================"
Write-Host ""
Write-Host "Tests Passed: $SuccessCount" -ForegroundColor Green
Write-Host "Tests Failed: $ErrorCount" -ForegroundColor Red
Write-Host ""

if ($ErrorCount -eq 0) {
    Write-Host "✅ All critical tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host "1. Run database migrations via Railway dashboard shell"
    Write-Host "2. Load seed data: uv run python seed_data.py"
    Write-Host "3. Test login with admin@demo.com / demo123"
    Write-Host "4. Update frontend NEXT_PUBLIC_BACKEND_URL to $BackendUrl"
    exit 0
} else {
    Write-Host "❌ Some tests failed. Check Railway logs for errors." -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "1. Check Railway dashboard → Service → View Logs"
    Write-Host "2. Verify environment variables are set correctly"
    Write-Host "3. Check DATABASE_URL is accessible"
    Write-Host "4. Review RAILWAY_DEPLOYMENT.md for configuration steps"
    exit 1
}
