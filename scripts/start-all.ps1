#!/usr/bin/env pwsh
# Unified startup script for CCW-Online ERP
# Starts the complete stack: Database, Backend, Frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CCW-Online ERP - Full Stack Startup  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/4] Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green

# Start database services
Write-Host ""
Write-Host "[2/4] Starting Database & Redis..." -ForegroundColor Yellow
docker-compose up -d postgres redis
Start-Sleep -Seconds 3
Write-Host "✓ PostgreSQL running on port 5433" -ForegroundColor Green
Write-Host "✓ Redis running on port 6381" -ForegroundColor Green

# Start backend
Write-Host ""
Write-Host "[3/4] Starting Backend (FastAPI)..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'apps\backend'; python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --reload"
) -PassThru -WindowStyle Normal
Start-Sleep -Seconds 5

# Test backend
$backendHealth = $null
try {
    $backendHealth = Invoke-WebRequest -Uri "http://localhost:8001/docs" -TimeoutSec 3 -UseBasicParsing 2>$null
} catch {}

if ($backendHealth -and $backendHealth.StatusCode -eq 200) {
    Write-Host "✓ Backend running on http://localhost:8001" -ForegroundColor Green
    Write-Host "  API Docs: http://localhost:8001/docs" -ForegroundColor Gray
} else {
    Write-Host "⚠ Backend may still be starting..." -ForegroundColor Yellow
    Write-Host "  Check the backend window for status" -ForegroundColor Gray
}

# Start frontend
Write-Host ""
Write-Host "[4/4] Starting Frontend (Next.js)..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'apps\web'; pnpm dev"
) -PassThru -WindowStyle Normal
Start-Sleep -Seconds 5
Write-Host "✓ Frontend starting on http://localhost:3000" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  System Status                        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database (PostgreSQL):  " -NoNewline
Write-Host "http://localhost:5433" -ForegroundColor Green
Write-Host "Redis:                  " -NoNewline
Write-Host "http://localhost:6381" -ForegroundColor Green
Write-Host "Backend API:            " -NoNewline
Write-Host "http://localhost:8001" -ForegroundColor Green
Write-Host "Backend Docs:           " -NoNewline
Write-Host "http://localhost:8001/docs" -ForegroundColor Green
Write-Host "Frontend:               " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Monitoring:"
Write-Host "  Prometheus:           " -NoNewline
Write-Host "http://localhost:9090" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login Credentials:" -ForegroundColor Yellow
Write-Host "  Email:    admin@demo.com"
Write-Host "  Password: demo123"
Write-Host ""
Write-Host "Press Ctrl+C in this window to view shutdown options" -ForegroundColor Gray
Write-Host ""

# Keep script running and wait for Ctrl+C
try {
    Write-Host "System is running. Press Ctrl+C to stop all services..." -ForegroundColor Cyan
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Yellow

    # Ask if user wants to stop all services
    $response = Read-Host "Stop all services? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Stopping backend and frontend..." -ForegroundColor Yellow
        if ($backendProcess -and !$backendProcess.HasExited) {
            Stop-Process -Id $backendProcess.Id -Force
        }
        if ($frontendProcess -and !$frontendProcess.HasExited) {
            Stop-Process -Id $frontendProcess.Id -Force
        }

        Write-Host "Stopping Docker services..." -ForegroundColor Yellow
        docker-compose stop

        Write-Host "✓ All services stopped" -ForegroundColor Green
    }
}
