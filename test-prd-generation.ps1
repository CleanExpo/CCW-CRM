# Test PRD Generation Flow
Write-Host "Testing PRD Generation..." -ForegroundColor Cyan

# Step 1: Login to get auth token
Write-Host "`n1. Logging in..." -ForegroundColor Yellow
$loginResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"admin@demo.com","password":"demo123"}' `
    -SessionVariable session

$token = $loginResponse.access_token
$userId = $loginResponse.user.id
Write-Host "   OK Logged in as $($loginResponse.user.email)" -ForegroundColor Green
Write-Host "   User ID: $userId" -ForegroundColor Gray

# Step 2: Generate PRD
Write-Host "`n2. Starting PRD generation..." -ForegroundColor Yellow
$prdRequest = @{
    requirements = "I need a real-time inventory dashboard that displays current stock levels across multiple warehouses. The dashboard should show low stock alerts, display inventory movements in the last 24 hours, and provide quick search functionality to find specific products. Users should be able to filter by warehouse location and product category."
    context = @{
        target_users = "Warehouse managers, inventory staff"
        timeline = "3 months"
    }
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "X-User-Id" = $userId
    "Content-Type" = "application/json"
}

$generateResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/prd/generate" `
    -Method POST `
    -Headers $headers `
    -Body $prdRequest

$prdId = $generateResponse.id
Write-Host "   OK PRD generation started" -ForegroundColor Green
Write-Host "   PRD ID: $prdId" -ForegroundColor Gray
Write-Host "   Status: $($generateResponse.status)" -ForegroundColor Gray

# Step 3: Poll for completion
Write-Host "`n3. Monitoring progress..." -ForegroundColor Yellow
$maxAttempts = 60  # 2 minutes max
$attempt = 0

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++

    try {
        $statusResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/prd/$prdId" `
            -Method GET `
            -Headers $headers

        $status = $statusResponse.status
        $progress = [math]::Round(($attempt / $maxAttempts) * 100)

        Write-Host "   [$attempt/$maxAttempts] Status: $status (${progress}%)" -ForegroundColor Gray

        if ($status -eq "completed") {
            Write-Host "`nOK PRD Generation Complete!" -ForegroundColor Green
            Write-Host "`nResults:" -ForegroundColor Cyan
            Write-Host "  - User Stories: $($statusResponse.total_user_stories)" -ForegroundColor White
            Write-Host "  - API Endpoints: $($statusResponse.total_api_endpoints)" -ForegroundColor White
            Write-Host "  - Test Scenarios: $($statusResponse.total_test_scenarios)" -ForegroundColor White
            Write-Host "  - Sprints: $($statusResponse.total_sprints)" -ForegroundColor White
            Write-Host "  - Duration: $($statusResponse.estimated_duration_weeks) weeks" -ForegroundColor White

            if ($statusResponse.executive_summary) {
                Write-Host "`nExecutive Summary:" -ForegroundColor Cyan
                Write-Host $statusResponse.executive_summary -ForegroundColor White
            }

            Write-Host "`nView full PRD: http://localhost:3000/prd/$prdId" -ForegroundColor Cyan
            break
        }
        elseif ($status -eq "failed") {
            Write-Host "`nERROR PRD Generation Failed" -ForegroundColor Red
            Write-Host "Error: $($statusResponse.error_message)" -ForegroundColor Red
            break
        }
    }
    catch {
        Write-Host "   Error checking status: $_" -ForegroundColor Red
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "`nTimeout waiting for PRD generation" -ForegroundColor Yellow
}
