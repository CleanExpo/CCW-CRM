<#
.SYNOPSIS
    Resume an interrupted autonomous task

.DESCRIPTION
    Loads task state from execution directory and provides information for resuming.
    Used when a task was interrupted (Ctrl+C, session timeout, etc.)

.PARAMETER TaskId
    Specific task ID to resume (optional - defaults to current task)

.EXAMPLE
    .\resume-task.ps1

.EXAMPLE
    .\resume-task.ps1 -TaskId "task_20260205_143022"

.NOTES
    Part of Phase 5 Autonomous Development Framework
    Created: February 5, 2026
#>

[CmdletBinding()]
param(
    [string]$TaskId
)

$ErrorActionPreference = "Stop"

# Colors
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

Write-Host "`n🔄 Resume Autonomous Task" -ForegroundColor $ColorInfo
Write-Host "=" * 60 -ForegroundColor $ColorInfo

# Find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ExecutionDir = Join-Path $ProjectRoot ".claude\.execution"

if (-not (Test-Path $ExecutionDir)) {
    Write-Host "`n❌ Execution directory not found!" -ForegroundColor $ColorError
    Write-Host "   No tasks to resume." -ForegroundColor $ColorInfo
    exit 1
}

# Load current task
$CurrentTaskPath = Join-Path $ExecutionDir "current-task.json"

if (-not (Test-Path $CurrentTaskPath)) {
    Write-Host "`n❌ No current task found!" -ForegroundColor $ColorError
    Write-Host "   Nothing to resume." -ForegroundColor $ColorInfo
    exit 1
}

try {
    $Task = Get-Content $CurrentTaskPath -Raw | ConvertFrom-Json

    Write-Host "`n📋 Task Information:" -ForegroundColor $ColorInfo
    Write-Host "   Task ID: $($Task.task_id)" -ForegroundColor $ColorInfo
    Write-Host "   Created: $($Task.created_at)" -ForegroundColor $ColorInfo
    Write-Host "   Request: $($Task.user_request)" -ForegroundColor $ColorInfo
    Write-Host "   Status: $($Task.status)" -ForegroundColor $ColorWarning
    Write-Host "   Current Phase: $($Task.current_phase)/5" -ForegroundColor $ColorInfo
    Write-Host "   Current Agent: $($Task.current_agent)" -ForegroundColor $ColorInfo
    Write-Host "   Approval Mode: $($Task.approval_mode)" -ForegroundColor $ColorInfo

    # Show completed phases
    if ($Task.phases_completed -and $Task.phases_completed.Count -gt 0) {
        Write-Host "`n✅ Completed Phases:" -ForegroundColor $ColorSuccess
        foreach ($Phase in $Task.phases_completed) {
            $PhaseName = switch ($Phase) {
                1 { "Discovery" }
                2 { "Architecture" }
                3 { "Build" }
                4 { "Build Final" }
                5 { "Finalize" }
            }
            Write-Host "     Phase $Phase ($PhaseName)" -ForegroundColor $ColorSuccess
        }
    }

    # Show remaining phases
    if ($Task.phases_remaining -and $Task.phases_remaining.Count -gt 0) {
        Write-Host "`n⏳ Remaining Phases:" -ForegroundColor $ColorInfo
        foreach ($Phase in $Task.phases_remaining) {
            $PhaseName = switch ($Phase) {
                1 { "Discovery" }
                2 { "Architecture" }
                3 { "Build" }
                4 { "Build Final" }
                5 { "Finalize" }
            }
            Write-Host "     Phase $Phase ($PhaseName)" -ForegroundColor $ColorInfo
        }
    }

    # Load last handoff
    Write-Host "`n🤝 Last Phase Handoff:" -ForegroundColor $ColorInfo

    $LastPhase = $Task.current_phase - 1
    if ($LastPhase -ge 1) {
        $HandoffPath = Join-Path $ExecutionDir "phase-handoffs\phase-$LastPhase-*.json"
        $HandoffFiles = Get-ChildItem -Path $HandoffPath -ErrorAction SilentlyContinue

        if ($HandoffFiles.Count -gt 0) {
            $HandoffFile = $HandoffFiles | Select-Object -First 1
            $Handoff = Get-Content $HandoffFile.FullName -Raw | ConvertFrom-Json

            Write-Host "   ✓ Found: $($HandoffFile.Name)" -ForegroundColor $ColorSuccess
            Write-Host "   From: $($Handoff.from_agent)" -ForegroundColor $ColorInfo
            Write-Host "   To: $($Handoff.to_agent)" -ForegroundColor $ColorInfo
            Write-Host "   Validated: $(if ($Handoff.validation_passed) { 'Yes' } else { 'No' })" -ForegroundColor $(if ($Handoff.validation_passed) { $ColorSuccess } else { $ColorWarning })
        } else {
            Write-Host "   ⚠️  No handoff file found for Phase $LastPhase" -ForegroundColor $ColorWarning
        }
    } else {
        Write-Host "   ℹ️  Task at Phase 1 (no previous handoff)" -ForegroundColor $ColorInfo
    }

    # Show metadata
    if ($Task.metadata) {
        Write-Host "`n📊 Progress Metrics:" -ForegroundColor $ColorInfo
        if ($Task.metadata.elapsed_time_minutes) {
            Write-Host "   Elapsed Time: $($Task.metadata.elapsed_time_minutes) minutes" -ForegroundColor $ColorInfo
        }
        if ($Task.metadata.estimated_total_time_minutes) {
            Write-Host "   Estimated Total: $($Task.metadata.estimated_total_time_minutes) minutes" -ForegroundColor $ColorInfo
        }
        if ($Task.metadata.files_created) {
            Write-Host "   Files Created: $($Task.metadata.files_created.Count)" -ForegroundColor $ColorInfo
        }
        if ($Task.metadata.files_modified) {
            Write-Host "   Files Modified: $($Task.metadata.files_modified.Count)" -ForegroundColor $ColorInfo
        }
    }

    # Show error if failed
    if ($Task.status -eq "failed" -and $Task.error) {
        Write-Host "`n❌ Task Failed:" -ForegroundColor $ColorError
        Write-Host "   Phase: $($Task.error.phase)" -ForegroundColor $ColorError
        Write-Host "   Agent: $($Task.error.agent)" -ForegroundColor $ColorError
        Write-Host "   Message: $($Task.error.message)" -ForegroundColor $ColorError
        Write-Host "   Time: $($Task.error.timestamp)" -ForegroundColor $ColorError
    }

    # Instructions
    Write-Host "`n" + ("=" * 60) -ForegroundColor $ColorInfo
    Write-Host "📝 To Resume:" -ForegroundColor $ColorSuccess
    Write-Host "   Use: /autonomous --resume $($Task.task_id)" -ForegroundColor $ColorInfo
    Write-Host "`nOr in chat: `"Resume the previous autonomous task`"" -ForegroundColor $ColorInfo
    Write-Host ""

} catch {
    Write-Host "`n❌ Failed to load task state" -ForegroundColor $ColorError
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor $ColorError
    exit 1
}
