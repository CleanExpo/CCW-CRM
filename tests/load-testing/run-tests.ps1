# Load Testing Runner Script for Windows
# UNI-481: Backend Load Testing
#
# Usage:
#   .\run-tests.ps1 -Test quick
#   .\run-tests.ps1 -Test comprehensive
#   .\run-tests.ps1 -Test all

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('quick', 'comprehensive', 'baseline', 'smoke', 'stress', 'all')]
    [string]$Test = 'quick',

    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = 'http://localhost:8000',

    [Parameter(Mandatory=$false)]
    [int]$Vus = 10,

    [Parameter(Mandatory=$false)]
    [string]$Duration = '5m'
)

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "CCW-ERP/CRM Load Testing - UNI-481" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Check if k6 is installed
$k6Installed = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6Installed) {
    Write-Host "[ERROR] k6 is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install k6:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://k6.io/docs/getting-started/installation/" -ForegroundColor Yellow
    Write-Host "  2. Or use chocolatey: choco install k6" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "[OK] k6 is installed" -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:API_URL = $ApiUrl
Write-Host "[*] API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host ""

# Create results directory
$resultsDir = "results"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Run-Test {
    param(
        [string]$TestName,
        [string]$ScriptPath,
        [string]$Options = ""
    )

    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "[*] Running $TestName" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host ""

    $resultFile = "$resultsDir/$TestName-$timestamp.json"
    $reportFile = "$resultsDir/$TestName-$timestamp.html"

    $k6Command = "k6 run $Options --out json=$resultFile $ScriptPath"
    Write-Host "Command: $k6Command" -ForegroundColor Gray
    Write-Host ""

    $startTime = Get-Date
    Invoke-Expression $k6Command
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    Write-Host ""
    Write-Host "[OK] $TestName completed in $duration seconds" -ForegroundColor Green
    Write-Host "     Results: $resultFile" -ForegroundColor Gray
    Write-Host ""
}

switch ($Test) {
    'quick' {
        Run-Test -TestName "quick-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus $Vus --duration $Duration"
    }
    'comprehensive' {
        Run-Test -TestName "comprehensive-test" -ScriptPath "scenarios/comprehensive-test.js"
    }
    'baseline' {
        Run-Test -TestName "baseline-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus 1 --duration 1m"
    }
    'smoke' {
        Run-Test -TestName "smoke-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus 5 --duration 2m"
    }
    'stress' {
        Run-Test -TestName "stress-test" -ScriptPath "scenarios/comprehensive-test.js" -Options "--vus 50 --duration 10m"
    }
    'all' {
        Write-Host "[*] Running all test suites..." -ForegroundColor Cyan
        Write-Host ""

        Run-Test -TestName "baseline-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus 1 --duration 1m"
        Start-Sleep -Seconds 5

        Run-Test -TestName "smoke-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus 5 --duration 2m"
        Start-Sleep -Seconds 5

        Run-Test -TestName "quick-test" -ScriptPath "scenarios/quick-test.js" -Options "--vus 10 --duration 5m"
        Start-Sleep -Seconds 5

        Run-Test -TestName "comprehensive-test" -ScriptPath "scenarios/comprehensive-test.js"

        Write-Host "================================================================================" -ForegroundColor Cyan
        Write-Host "[OK] All test suites completed!" -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "[OK] Load testing completed" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Results saved in: $resultsDir/" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review test results in $resultsDir/" -ForegroundColor Yellow
Write-Host "  2. Analyze performance metrics" -ForegroundColor Yellow
Write-Host "  3. Identify bottlenecks" -ForegroundColor Yellow
Write-Host "  4. Update Linear with findings (UNI-481)" -ForegroundColor Yellow
Write-Host ""
