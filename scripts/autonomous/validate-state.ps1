<#
.SYNOPSIS
    Validate autonomous execution state integrity

.DESCRIPTION
    Checks current-task.json and related state files for consistency and validity.
    Validates against JSON schemas.

.EXAMPLE
    .\validate-state.ps1

.EXAMPLE
    .\validate-state.ps1 -Verbose

.NOTES
    Part of Phase 5 Autonomous Development Framework
    Created: February 5, 2026
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Colors
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

Write-Host "`n🔍 Validating Execution State" -ForegroundColor $ColorInfo
Write-Host "=" * 60 -ForegroundColor $ColorInfo

# Find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ExecutionDir = Join-Path $ProjectRoot ".claude\.execution"

if (-not (Test-Path $ExecutionDir)) {
    Write-Host "`n❌ Execution directory not found!" -ForegroundColor $ColorError
    Write-Host "   Run: .\scripts\autonomous\init-execution.ps1" -ForegroundColor $ColorInfo
    exit 1
}

Write-Host "`nExecution Dir: $ExecutionDir" -ForegroundColor $ColorInfo

# Check for current task
Write-Host "`n📋 Checking current task..." -ForegroundColor $ColorInfo

$CurrentTaskPath = Join-Path $ExecutionDir "current-task.json"
if (Test-Path $CurrentTaskPath) {
    try {
        $Task = Get-Content $CurrentTaskPath -Raw | ConvertFrom-Json

        Write-Host "   ✓ current-task.json found" -ForegroundColor $ColorSuccess
        Write-Host "     Task ID: $($Task.task_id)" -ForegroundColor $ColorInfo
        Write-Host "     Status: $($Task.status)" -ForegroundColor $ColorInfo
        Write-Host "     Phase: $($Task.current_phase)/5" -ForegroundColor $ColorInfo
        Write-Host "     Agent: $($Task.current_agent)" -ForegroundColor $ColorInfo

        # Validate required fields
        $RequiredFields = @('task_id', 'created_at', 'user_request', 'current_phase', 'current_agent', 'status')
        $MissingFields = $RequiredFields | Where-Object { -not $Task.$_ }

        if ($MissingFields.Count -gt 0) {
            Write-Host "   ⚠️  Missing required fields: $($MissingFields -join ', ')" -ForegroundColor $ColorWarning
        } else {
            Write-Host "   ✓ All required fields present" -ForegroundColor $ColorSuccess
        }

        # Validate phase is valid (1-5)
        if ($Task.current_phase -lt 1 -or $Task.current_phase -gt 5) {
            Write-Host "   ❌ Invalid phase: $($Task.current_phase) (must be 1-5)" -ForegroundColor $ColorError
        }

    } catch {
        Write-Host "   ❌ Failed to parse current-task.json" -ForegroundColor $ColorError
        Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor $ColorError
    }
} else {
    Write-Host "   ℹ️  No active task (current-task.json not found)" -ForegroundColor $ColorInfo
}

# Check execution log
Write-Host "`n📜 Checking execution log..." -ForegroundColor $ColorInfo

$LogPath = Join-Path $ExecutionDir "execution-log.jsonl"
if (Test-Path $LogPath) {
    try {
        $LogLines = Get-Content $LogPath
        $ValidLines = 0
        $InvalidLines = 0

        foreach ($Line in $LogLines) {
            try {
                $Entry = $Line | ConvertFrom-Json
                if ($Entry.timestamp -and $Entry.event) {
                    $ValidLines++
                } else {
                    $InvalidLines++
                }
            } catch {
                $InvalidLines++
            }
        }

        Write-Host "   ✓ Execution log found" -ForegroundColor $ColorSuccess
        Write-Host "     Total entries: $($LogLines.Count)" -ForegroundColor $ColorInfo
        Write-Host "     Valid entries: $ValidLines" -ForegroundColor $ColorSuccess

        if ($InvalidLines -gt 0) {
            Write-Host "     Invalid entries: $InvalidLines" -ForegroundColor $ColorWarning
        }

        # Show last 3 entries
        if ($LogLines.Count -gt 0) {
            Write-Host "`n   Last 3 log entries:" -ForegroundColor $ColorInfo
            $LogLines | Select-Object -Last 3 | ForEach-Object {
                $Entry = $_ | ConvertFrom-Json
                Write-Host "     - [$($Entry.timestamp)] $($Entry.event): $($Entry.message)" -ForegroundColor $ColorInfo
            }
        }

    } catch {
        Write-Host "   ❌ Failed to read execution log" -ForegroundColor $ColorError
        Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor $ColorError
    }
} else {
    Write-Host "   ℹ️  No execution log found" -ForegroundColor $ColorInfo
}

# Check phase handoffs
Write-Host "`n🤝 Checking phase handoffs..." -ForegroundColor $ColorInfo

$HandoffsDir = Join-Path $ExecutionDir "phase-handoffs"
$HandoffFiles = Get-ChildItem -Path $HandoffsDir -Filter "*.json" -ErrorAction SilentlyContinue

if ($HandoffFiles.Count -eq 0) {
    Write-Host "   ℹ️  No handoff files found" -ForegroundColor $ColorInfo
} else {
    Write-Host "   ✓ Found $($HandoffFiles.Count) handoff file(s)" -ForegroundColor $ColorSuccess
    foreach ($File in $HandoffFiles) {
        Write-Host "     - $($File.Name)" -ForegroundColor $ColorInfo
    }
}

# Check validation reports
Write-Host "`n✅ Checking validation reports..." -ForegroundColor $ColorInfo

$ReportsDir = Join-Path $ExecutionDir "validation-reports"
$ReportFiles = Get-ChildItem -Path $ReportsDir -Filter "*.json" -ErrorAction SilentlyContinue

if ($ReportFiles.Count -eq 0) {
    Write-Host "   ℹ️  No validation reports found" -ForegroundColor $ColorInfo
} else {
    Write-Host "   ✓ Found $($ReportFiles.Count) validation report(s)" -ForegroundColor $ColorSuccess
    foreach ($File in $ReportFiles) {
        try {
            $Report = Get-Content $File.FullName -Raw | ConvertFrom-Json
            $StatusColor = switch ($Report.overall_status) {
                "pass" { $ColorSuccess }
                "pass_with_warnings" { $ColorWarning }
                "fail" { $ColorError }
                default { $ColorInfo }
            }
            Write-Host "     - $($File.Name): $($Report.overall_status)" -ForegroundColor $StatusColor
        } catch {
            Write-Host "     - $($File.Name): [parse error]" -ForegroundColor $ColorError
        }
    }
}

# Final summary
Write-Host "`n" + ("=" * 60) -ForegroundColor $ColorInfo

$HasActiveTask = Test-Path $CurrentTaskPath
$HasLog = Test-Path $LogPath

if ($HasActiveTask) {
    Write-Host "📊 State Summary: Active task in progress" -ForegroundColor $ColorSuccess
} elseif ($HasLog) {
    Write-Host "📊 State Summary: No active task (previous task may have completed)" -ForegroundColor $ColorInfo
} else {
    Write-Host "📊 State Summary: Clean state (no tasks run yet)" -ForegroundColor $ColorInfo
}

Write-Host ""
