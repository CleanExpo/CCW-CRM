# Integration Test Runner for CCW-Online ERP (PowerShell)
#
# This script runs integration tests with various configurations.
#
# Usage:
#   .\run_integration_tests.ps1 [-Fast] [-Postgres] [-Coverage] [-Verbose] [-Module <name>] [-Class <name>]
#
# Parameters:
#   -Fast      Use SQLite in-memory (fastest)
#   -Postgres  Use PostgreSQL (most realistic)
#   -Coverage  Generate coverage report
#   -Verbose   Verbose output
#   -Module    Run specific test module
#   -Class     Run specific test class

param(
    [switch]$Fast,
    [switch]$Postgres,
    [switch]$Coverage,
    [switch]$Verbose,
    [string]$Module = "",
    [string]$Class = ""
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "CCW-Online ERP Integration Tests" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Configure database
if ($Postgres) {
    Write-Host "Using PostgreSQL database" -ForegroundColor Yellow
    $env:USE_IN_MEMORY_DB = "false"
    $env:TEST_DATABASE_URL = "postgresql://starter_user:local_dev_password@localhost:5432/starter_db_test"

    # Check if PostgreSQL is running
    try {
        $null = & pg_isready -h localhost -p 5432 2>&1
    } catch {
        Write-Host "Error: PostgreSQL is not running" -ForegroundColor Red
        Write-Host "Start PostgreSQL or use -Fast option for SQLite"
        exit 1
    }
} else {
    Write-Host "Using SQLite in-memory database" -ForegroundColor Yellow
    $env:USE_IN_MEMORY_DB = "true"
}

# Build test command
$TestCmd = "pytest tests/integration/"

if ($Module) {
    $TestCmd = "pytest tests/integration/$Module.py"
}

if ($Class) {
    if ($Module) {
        $TestCmd = "pytest tests/integration/${Module}.py::${Class}"
    } else {
        Write-Host "Error: -Class requires -Module" -ForegroundColor Red
        exit 1
    }
}

# Add verbosity
if ($Verbose) {
    $TestCmd += " -vv"
} else {
    $TestCmd += " -v"
}

# Add coverage
if ($Coverage) {
    Write-Host "Generating coverage report" -ForegroundColor Yellow
    $TestCmd += " --cov=src --cov-report=html --cov-report=term"
}

Write-Host ""
Write-Host "Running command: $TestCmd" -ForegroundColor Yellow
Write-Host ""

# Change to apps/backend directory
$BackendDir = Split-Path -Parent $PSScriptRoot
Set-Location $BackendDir

# Run tests
try {
    Invoke-Expression $TestCmd

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

    if ($Coverage) {
        Write-Host ""
        Write-Host "Coverage report generated:" -ForegroundColor Green
        Write-Host "  HTML: file://$PWD/htmlcov/index.html"
        Write-Host ""
        Write-Host "Open in browser:"
        Write-Host "  start htmlcov/index.html"
    }
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Tests failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
