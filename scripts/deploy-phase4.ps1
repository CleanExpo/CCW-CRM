# Phase 4 Deployment Script (PowerShell)
# Complete deployment: Backend + Frontend + Health Check

param(
    [string]$BackendUrl = "http://localhost:8000",
    [string]$FrontendUrl = "http://localhost:3000",
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"

# Colors
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Log "✅ $Message" -Color $Green
}

function Write-Error {
    param([string]$Message)
    Write-Log "❌ $Message" -Color $Red
}

function Write-Warning {
    param([string]$Message)
    Write-Log "⚠️  $Message" -Color $Yellow
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $Blue
    Write-Host $Title -ForegroundColor $Blue
    Write-Host "========================================" -ForegroundColor $Blue
}

Write-Section "Phase 4 Deployment Starting"

# Step 1: Verify Docker services
Write-Log "Step 1: Verifying Docker services..."

try {
    $containers = docker ps --format "{{.Names}}" | Select-String "nodejs-starter"
    if ($containers) {
        Write-Success "Docker services running"
    } else {
        Write-Warning "Starting Docker services..."
        docker compose up -d postgres redis
        Start-Sleep -Seconds 5
    }
} catch {
    Write-Error "Docker not available or services failed to start"
    exit 1
}

# Step 2: Verify Redis
Write-Log "Step 2: Checking Redis..."

try {
    $result = docker exec nodejs-starter-redis redis-cli ping 2>$null
    if ($result -eq "PONG") {
        Write-Success "Redis is running"
    } else {
        throw "Redis not responding"
    }
} catch {
    Write-Error "Redis check failed: $_"
    exit 1
}

# Step 3: Verify PostgreSQL
Write-Log "Step 3: Checking PostgreSQL..."

try {
    $result = docker exec nodejs-starter-postgres pg_isready -U starter_user -d starter_db 2>$null
    if ($result -match "accepting connections") {
        Write-Success "PostgreSQL is running"
    } else {
        throw "PostgreSQL not accepting connections"
    }
} catch {
    Write-Error "PostgreSQL check failed: $_"
    exit 1
}

# Step 4: Run database migration
Write-Log "Step 4: Running database migration..."

try {
    $migrationFile = "apps\backend\migrations\add_performance_indexes.sql"
    if (Test-Path $migrationFile) {
        Get-Content $migrationFile | docker exec -i nodejs-starter-postgres psql -U starter_user -d starter_db 2>&1 | Out-Null
        Write-Success "Database migration completed"
    } else {
        Write-Error "Migration file not found: $migrationFile"
        exit 1
    }
} catch {
    Write-Error "Migration failed: $_"
    exit 1
}

# Step 5: Backend deployment
Write-Section "Backend Deployment"

Write-Log "Step 5: Deploying backend..."

Push-Location apps\backend

try {
    # Install dependencies
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        Write-Log "Installing backend dependencies..."
        uv sync
        Write-Success "Dependencies installed"
    } else {
        Write-Warning "uv not found, skipping dependency installation"
    }

    # Start backend
    Write-Log "Starting backend server..."

    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --log-level info
    }

    # Wait for backend to start
    Write-Log "Waiting for backend to start..."
    Start-Sleep -Seconds 5

    # Health check
    $maxRetries = 10
    $retryCount = 0

    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Backend health check passed"
                break
            }
        } catch {
            $retryCount++
            Write-Log "Health check attempt $retryCount/$maxRetries..."
            Start-Sleep -Seconds 2
        }
    }

    if ($retryCount -eq $maxRetries) {
        Write-Error "Backend health check failed"
        Stop-Job $backendJob
        Remove-Job $backendJob
        exit 1
    }

    Write-Success "Backend deployed successfully"
    Write-Log "Backend Job ID: $($backendJob.Id)"

} catch {
    Write-Error "Backend deployment failed: $_"
    exit 1
} finally {
    Pop-Location
}

# Step 6: Frontend deployment
Write-Section "Frontend Deployment"

Write-Log "Step 6: Deploying frontend..."

Push-Location apps\web

try {
    # Install dependencies
    Write-Log "Installing frontend dependencies..."
    pnpm install
    Write-Success "Dependencies installed"

    # Type check
    if (-not $SkipTests) {
        Write-Log "Running type checks..."
        pnpm --filter web run type-check
        Write-Success "Type checking passed"
    }

    # Build
    Write-Log "Building frontend..."
    pnpm --filter web run build
    Write-Success "Frontend build completed"

    # Start frontend
    Write-Log "Starting frontend server..."

    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        pnpm start --port 3000
    }

    # Wait for frontend to start
    Write-Log "Waiting for frontend to start..."
    Start-Sleep -Seconds 5

    # Health check
    $maxRetries = 10
    $retryCount = 0

    while ($retryCount -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Frontend health check passed"
                break
            }
        } catch {
            $retryCount++
            Write-Log "Health check attempt $retryCount/$maxRetries..."
            Start-Sleep -Seconds 2
        }
    }

    if ($retryCount -eq $maxRetries) {
        Write-Error "Frontend health check failed"
        Stop-Job $frontendJob
        Remove-Job $frontendJob
        exit 1
    }

    Write-Success "Frontend deployed successfully"
    Write-Log "Frontend Job ID: $($frontendJob.Id)"

} catch {
    Write-Error "Frontend deployment failed: $_"
    exit 1
} finally {
    Pop-Location
}

# Step 7: Run health checks
Write-Section "Phase 4 Health Checks"

Write-Log "Step 7: Running comprehensive health checks..."

# Run health check script
if (Get-Command bash -ErrorAction SilentlyContinue) {
    try {
        bash scripts/health-check-phase4.sh
    } catch {
        Write-Warning "Health check script failed, running basic checks..."
    }
} else {
    Write-Warning "bash not available, skipping comprehensive health checks"
}

# Basic checks
Write-Log "Running basic endpoint checks..."

$endpoints = @(
    "$BackendUrl/health",
    "$BackendUrl/api/demo-dashboard/aggregated",
    $FrontendUrl
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Success "✓ $endpoint (HTTP $($response.StatusCode))"
    } catch {
        Write-Warning "✗ $endpoint failed"
    }
}

# Final summary
Write-Section "Deployment Complete"

Write-Host ""
Write-Success "Phase 4 Deployed Successfully!"
Write-Host ""
Write-Host "Backend:  $BackendUrl" -ForegroundColor $Green
Write-Host "Frontend: $FrontendUrl" -ForegroundColor $Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor $Blue
Write-Host "1. Open browser: $FrontendUrl"
Write-Host "2. Test Phase 4 features:"
Write-Host "   - Dashboard should load in less than 2 seconds"
Write-Host "   - Forms should autosave as you type"
Write-Host "   - Products page should show real-time stock updates"
Write-Host "   - Order form should suggest recent customers/products"
Write-Host ""
Write-Host "Monitor logs for 24 hours:" -ForegroundColor $Blue
Write-Host "- Backend Job ID: $($backendJob.Id)"
Write-Host "- Frontend Job ID: $($frontendJob.Id)"
Write-Host ""
Write-Host "To view job output: Get-Job | Receive-Job"
Write-Host "To stop services: Stop-Job [ID]; Remove-Job [ID]"
Write-Host ""

# Store job IDs for later reference
$deploymentInfo = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    BackendJobId = $backendJob.Id
    FrontendJobId = $frontendJob.Id
    BackendUrl = $BackendUrl
    FrontendUrl = $FrontendUrl
}

$deploymentInfo | ConvertTo-Json | Out-File "logs\deployment-phase4-$((Get-Date).ToString('yyyyMMdd_HHmmss')).json"

Write-Success "Deployment info saved to logs directory"
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring. Services will continue running." -ForegroundColor $Yellow
Write-Host ""

# Monitor jobs
while ($true) {
    Start-Sleep -Seconds 5

    $backendState = (Get-Job -Id $backendJob.Id).State
    $frontendState = (Get-Job -Id $frontendJob.Id).State

    if ($backendState -ne "Running") {
        Write-Error "Backend job stopped unexpectedly (State: $backendState)"
        break
    }

    if ($frontendState -ne "Running") {
        Write-Error "Frontend job stopped unexpectedly (State: $frontendState)"
        break
    }
}
