# CCW-Online ERP Load Testing Scenarios (PowerShell)
#
# This script runs various load test scenarios to verify system performance
# under different load conditions.
#
# Prerequisites:
#   1. Install Locust: pip install locust
#   2. Ensure backend is running: http://localhost:8000
#   3. Ensure database has been seeded with test data
#
# Usage:
#   .\load_test_scenarios.ps1 -Scenario [scenario_name]
#
# Examples:
#   .\load_test_scenarios.ps1 -Scenario smoke
#   .\load_test_scenarios.ps1 -Scenario stress
#   .\load_test_scenarios.ps1 -Scenario all

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('smoke', 'normal', 'high', 'stress', 'multi-tenant', 'sustained', 'read-heavy', 'write-heavy', 'all')]
    [string]$Scenario = 'normal',

    [Parameter(Mandatory=$false)]
    [string]$Host = 'http://localhost:8000'
)

$ErrorActionPreference = "Stop"

# Configuration
$ResultsDir = ".\load_test_results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Create results directory
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

Write-Host "======================================" -ForegroundColor Green
Write-Host "CCW-Online ERP Load Testing" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Host: $Host"
Write-Host "Results: $ResultsDir"
Write-Host ""

function Run-Scenario {
    param(
        [string]$Name,
        [int]$Users,
        [int]$SpawnRate,
        [string]$RunTime,
        [string]$UserClass = "NormalUser",
        [string]$Tags = ""
    )

    Write-Host "Running scenario: $Name" -ForegroundColor Yellow
    Write-Host "  Users: $Users"
    Write-Host "  Spawn Rate: $SpawnRate/sec"
    Write-Host "  Duration: $RunTime"
    Write-Host "  User Class: $UserClass"
    if ($Tags) {
        Write-Host "  Tags: $Tags"
    }
    Write-Host ""

    $OutputFile = "$ResultsDir\${Name}_${Timestamp}"

    $Cmd = "locust -f locustfile.py --host=$Host --users=$Users --spawn-rate=$SpawnRate --run-time=$RunTime --headless --user-classes=$UserClass --html=${OutputFile}.html --csv=${OutputFile}"

    if ($Tags) {
        $Cmd += " --tags=$Tags"
    }

    Write-Host "Command: $Cmd"
    Write-Host ""

    try {
        Invoke-Expression $Cmd
        Write-Host "✅ Scenario '$Name' completed successfully" -ForegroundColor Green
        Write-Host "Results: ${OutputFile}.html"
        Write-Host ""
    } catch {
        Write-Host "❌ Scenario '$Name' failed" -ForegroundColor Red
        Write-Host $_.Exception.Message
        throw
    }
}

function Smoke-Test {
    Write-Host "=== SMOKE TEST ===" -ForegroundColor Green
    Write-Host "Quick validation of endpoints with minimal load"
    Write-Host ""
    Run-Scenario -Name "smoke" -Users 10 -SpawnRate 2 -RunTime "1m" -UserClass "NormalUser"
}

function Normal-Load {
    Write-Host "=== NORMAL LOAD TEST ===" -ForegroundColor Green
    Write-Host "Simulating typical production load"
    Write-Host ""
    Run-Scenario -Name "normal_load" -Users 100 -SpawnRate 10 -RunTime "5m" -UserClass "NormalUser"
}

function High-Load {
    Write-Host "=== HIGH LOAD TEST ===" -ForegroundColor Green
    Write-Host "Simulating peak traffic conditions"
    Write-Host ""
    Run-Scenario -Name "high_load" -Users 1000 -SpawnRate 50 -RunTime "10m" -UserClass "NormalUser"
}

function Stress-Test {
    Write-Host "=== STRESS TEST ===" -ForegroundColor Green
    Write-Host "Testing system limits with 10,000 concurrent users"
    Write-Host "Target: 95%+ success rate, p95 <500ms"
    Write-Host ""
    Run-Scenario -Name "stress_test" -Users 10000 -SpawnRate 100 -RunTime "10m" -UserClass "NormalUser"
}

function Multi-Tenant-Test {
    Write-Host "=== MULTI-TENANT ISOLATION TEST ===" -ForegroundColor Green
    Write-Host "Verifying tenant data isolation with 1,000 users across multiple organizations"
    Write-Host ""
    Run-Scenario -Name "multi_tenant" -Users 1000 -SpawnRate 50 -RunTime "10m" -UserClass "MultiTenantUser" -Tags "multi-tenant"
}

function Sustained-Load {
    Write-Host "=== SUSTAINED LOAD TEST ===" -ForegroundColor Green
    Write-Host "Testing system stability over 30 minutes"
    Write-Host ""
    Run-Scenario -Name "sustained_load" -Users 500 -SpawnRate 25 -RunTime "30m" -UserClass "NormalUser"
}

function Read-Heavy-Test {
    Write-Host "=== READ-HEAVY WORKLOAD TEST ===" -ForegroundColor Green
    Write-Host "Simulating read-heavy traffic (browsing, searching)"
    Write-Host ""
    Run-Scenario -Name "read_heavy" -Users 500 -SpawnRate 25 -RunTime "10m" -UserClass "ReadHeavyUser"
}

function Write-Heavy-Test {
    Write-Host "=== WRITE-HEAVY WORKLOAD TEST ===" -ForegroundColor Green
    Write-Host "Simulating write-heavy traffic (creating orders, quotes)"
    Write-Host ""
    Run-Scenario -Name "write_heavy" -Users 200 -SpawnRate 10 -RunTime "10m" -UserClass "WriteHeavyUser"
}

# Execute scenario based on parameter
switch ($Scenario) {
    'smoke' { Smoke-Test }
    'normal' { Normal-Load }
    'high' { High-Load }
    'stress' { Stress-Test }
    'multi-tenant' { Multi-Tenant-Test }
    'sustained' { Sustained-Load }
    'read-heavy' { Read-Heavy-Test }
    'write-heavy' { Write-Heavy-Test }
    'all' {
        Write-Host "Running ALL load test scenarios" -ForegroundColor Yellow
        Write-Host ""
        Smoke-Test
        Normal-Load
        Read-Heavy-Test
        Write-Heavy-Test
        High-Load
        Multi-Tenant-Test
        Stress-Test
        Write-Host ""
        Write-Host "All scenarios completed!" -ForegroundColor Green
        Write-Host "Note: Sustained load test (30 min) was skipped. Run manually if needed."
    }
}

# Summary
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Load Testing Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Results saved to: $ResultsDir"
Write-Host ""
Write-Host "Review HTML reports:"
Write-Host "  Get-ChildItem -Path $ResultsDir\*.html"
Write-Host ""
Write-Host "Performance targets:"
Write-Host "  ✅ p95 response time: <500ms"
Write-Host "  ✅ Success rate: >95%"
Write-Host "  ✅ Error rate: <5%"
Write-Host ""
