# Production-Quality Development Startup Script
# Starts all services in correct order with health checks

Write-Host "🚀 Starting CCW-Online ERP Development Environment" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Function to wait for service
function Wait-ForService {
    param(
        [string]$Name,
        [int]$Port,
        [int]$MaxAttempts = 30
    )

    Write-Host "⏳ Waiting for $Name on port $Port..." -ForegroundColor Yellow

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        if (Test-Port -Port $Port) {
            Write-Host "✅ $Name is ready!" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 2
    }

    Write-Host "❌ $Name failed to start" -ForegroundColor Red
    return $false
}

# Step 1: Start Docker services (PostgreSQL, Redis)
Write-Host "📦 Step 1: Starting Docker services..." -ForegroundColor Cyan
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker services failed to start. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

# Wait for PostgreSQL
if (-not (Wait-ForService -Name "PostgreSQL" -Port 5433)) {
    Write-Host "❌ PostgreSQL failed to start" -ForegroundColor Red
    exit 1
}

# Step 2: Start Backend API
Write-Host ""
Write-Host "🐍 Step 2: Starting FastAPI Backend..." -ForegroundColor Cyan

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\CCW-Online ERP\apps\backend'; python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000" -PassThru

# Wait for Backend
if (-not (Wait-ForService -Name "Backend API" -Port 8000)) {
    Write-Host "❌ Backend API failed to start" -ForegroundColor Red
    Stop-Process -Id $backendProcess.Id -Force
    exit 1
}

# Step 3: Start Frontend
Write-Host ""
Write-Host "⚛️  Step 3: Starting Next.js Frontend..." -ForegroundColor Cyan

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\CCW-Online ERP'; pnpm dev --filter=web" -PassThru

# Wait for Frontend
if (-not (Wait-ForService -Name "Next.js Frontend" -Port 3005)) {
    Write-Host "❌ Frontend failed to start" -ForegroundColor Red
    Stop-Process -Id $frontendProcess.Id -Force
    Stop-Process -Id $backendProcess.Id -Force
    exit 1
}

# Success!
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "✅ All services started successfully!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Frontend:  http://localhost:3005" -ForegroundColor Cyan
Write-Host "🔌 Backend:   http://localhost:8000" -ForegroundColor Cyan
Write-Host "📊 API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "🗄️  Database:  postgresql://localhost:5433" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Login: admin@demo.com / demo123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Gray

# Keep script running
Wait-Process -Id $frontendProcess.Id
