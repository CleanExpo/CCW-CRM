# PowerShell script to run bug fix tests
# Usage: .\run_bugfix_tests.ps1

Write-Host "Bug Fix Test Runner" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "pyproject.toml")) {
    Write-Host "Error: Must be run from apps/backend directory" -ForegroundColor Red
    exit 1
}

# Install test dependencies if needed
Write-Host "Installing test dependencies..." -ForegroundColor Yellow
pip install -e ".[dev]" --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Dependencies installed successfully`n" -ForegroundColor Green

# Run tests
Write-Host "Running bug fix tests..." -ForegroundColor Yellow
Write-Host ""

pytest tests/api/test_erp_bugfixes.py -v --tb=short

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some tests failed" -ForegroundColor Red
    exit 1
}
