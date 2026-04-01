<#
.SYNOPSIS
    Helper script for phase transitions in autonomous execution

.DESCRIPTION
    Validates phase completion and prepares for next phase.
    Used by Lead Agent to orchestrate phase transitions.

.PARAMETER TaskId
    Task ID to transition

.PARAMETER FromPhase
    Current phase number (1-5)

.PARAMETER ToPhase
    Next phase number (1-5)

.PARAMETER ValidationPassed
    Whether validation passed for current phase

.EXAMPLE
    .\transition-phase.ps1 -TaskId "task_20260205_150000" -FromPhase 1 -ToPhase 2 -ValidationPassed $true

.NOTES
    Part of Phase 5 Autonomous Development Framework
    Created: February 5, 2026
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$TaskId,

    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 5)]
    [int]$FromPhase,

    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 5)]
    [int]$ToPhase,

    [Parameter(Mandatory=$true)]
    [bool]$ValidationPassed
)

$ErrorActionPreference = "Stop"

# Colors
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

Write-Host "`n🔄 Phase Transition" -ForegroundColor $ColorInfo
Write-Host "=" * 60 -ForegroundColor $ColorInfo

# Find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ExecutionDir = Join-Path $ProjectRoot ".claude\.execution"

Write-Host "`nTask ID: $TaskId" -ForegroundColor $ColorInfo
Write-Host "Transition: Phase $FromPhase → Phase $ToPhase" -ForegroundColor $ColorInfo
Write-Host "Validation: $(if ($ValidationPassed) { '✅ PASSED' } else { '❌ FAILED' })" -ForegroundColor $(if ($ValidationPassed) { $ColorSuccess } else { $ColorError })

# Validate execution directory exists
if (-not (Test-Path $ExecutionDir)) {
    Write-Host "`n❌ Execution directory not found!" -ForegroundColor $ColorError
    Write-Host "   Run: .\scripts\autonomous\init-execution.ps1" -ForegroundColor $ColorInfo
    exit 1
}

# Load current task
$CurrentTaskPath = Join-Path $ExecutionDir "current-task.json"
if (-not (Test-Path $CurrentTaskPath)) {
    Write-Host "`n❌ Task not found!" -ForegroundColor $ColorError
    Write-Host "   Task ID: $TaskId" -ForegroundColor $ColorInfo
    exit 1
}

try {
    $Task = Get-Content $CurrentTaskPath -Raw | ConvertFrom-Json

    # Verify task ID matches
    if ($Task.task_id -ne $TaskId) {
        Write-Host "`n⚠️  Task ID mismatch!" -ForegroundColor $ColorWarning
        Write-Host "   Expected: $TaskId" -ForegroundColor $ColorInfo
        Write-Host "   Found: $($Task.task_id)" -ForegroundColor $ColorInfo
        exit 1
    }

    # Verify current phase matches FromPhase
    if ($Task.current_phase -ne $FromPhase) {
        Write-Host "`n⚠️  Phase mismatch!" -ForegroundColor $ColorWarning
        Write-Host "   Expected current phase: $FromPhase" -ForegroundColor $ColorInfo
        Write-Host "   Actual current phase: $($Task.current_phase)" -ForegroundColor $ColorInfo
        exit 1
    }

} catch {
    Write-Host "`n❌ Failed to load task state" -ForegroundColor $ColorError
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor $ColorError
    exit 1
}

# Check if validation passed
if (-not $ValidationPassed) {
    Write-Host "`n❌ Cannot transition: Validation failed" -ForegroundColor $ColorError
    Write-Host "   Phase $FromPhase validation must pass before proceeding to Phase $ToPhase" -ForegroundColor $ColorInfo
    exit 1
}

# Verify handoff document exists
$HandoffFile = "phase-$FromPhase-*.json"
$HandoffPath = Join-Path $ExecutionDir "phase-handoffs"
$HandoffFiles = Get-ChildItem -Path $HandoffPath -Filter $HandoffFile -ErrorAction SilentlyContinue

if ($HandoffFiles.Count -eq 0) {
    Write-Host "`n⚠️  Handoff document not found!" -ForegroundColor $ColorWarning
    Write-Host "   Expected: $HandoffFile in phase-handoffs/" -ForegroundColor $ColorInfo
    Write-Host "   Proceeding anyway..." -ForegroundColor $ColorWarning
}

# Verify validation report exists
$ValidationFile = "phase-$FromPhase-validation.json"
$ValidationPath = Join-Path $ExecutionDir "validation-reports\$ValidationFile"

if (-not (Test-Path $ValidationPath)) {
    Write-Host "`n⚠️  Validation report not found!" -ForegroundColor $ColorWarning
    Write-Host "   Expected: $ValidationFile" -ForegroundColor $ColorInfo
    Write-Host "   Proceeding anyway..." -ForegroundColor $ColorWarning
}

# Update task state
Write-Host "`n📝 Updating task state..." -ForegroundColor $ColorInfo

# Add FromPhase to completed phases
if ($Task.phases_completed -notcontains $FromPhase) {
    $Task.phases_completed += $FromPhase
    Write-Host "   ✓ Added Phase $FromPhase to completed" -ForegroundColor $ColorSuccess
}

# Remove ToPhase from remaining phases
if ($Task.phases_remaining -contains $ToPhase) {
    $Task.phases_remaining = $Task.phases_remaining | Where-Object { $_ -ne $ToPhase }
    Write-Host "   ✓ Removed Phase $ToPhase from remaining" -ForegroundColor $ColorSuccess
}

# Update current phase
$Task.current_phase = $ToPhase
Write-Host "   ✓ Updated current phase to $ToPhase" -ForegroundColor $ColorSuccess

# Update current agent
$Task.current_agent = switch ($ToPhase) {
    1 { "discovery" }
    2 { "architect" }
    3 { "builder" }
    4 { "builder" }
    5 { "finalizer" }
}
Write-Host "   ✓ Updated current agent to $($Task.current_agent)" -ForegroundColor $ColorSuccess

# Update status
$Task.status = "in_progress"

# Save updated task
$Task | ConvertTo-Json -Depth 10 | Set-Content $CurrentTaskPath -Force
Write-Host "   ✓ Task state saved" -ForegroundColor $ColorSuccess

# Log transition
$LogPath = Join-Path $ExecutionDir "execution-log.jsonl"
$LogEntry = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    event = "phase_transition"
    task_id = $TaskId
    from_phase = $FromPhase
    to_phase = $ToPhase
    agent = $Task.current_agent
    message = "Transitioned from Phase $FromPhase to Phase $ToPhase"
} | ConvertTo-Json -Compress

Add-Content -Path $LogPath -Value $LogEntry -Force
Write-Host "   ✓ Transition logged" -ForegroundColor $ColorSuccess

# Display next phase info
Write-Host "`n" + ("=" * 60) -ForegroundColor $ColorInfo
Write-Host "✅ Phase Transition Complete" -ForegroundColor $ColorSuccess

$PhaseName = switch ($ToPhase) {
    1 { "Discovery" }
    2 { "Architecture" }
    3 { "Build" }
    4 { "Build Final" }
    5 { "Finalize" }
}

Write-Host "`n📋 Next Phase: Phase $ToPhase ($PhaseName)" -ForegroundColor $ColorInfo
Write-Host "   Agent: $($Task.current_agent)" -ForegroundColor $ColorInfo
Write-Host "   Phases Completed: $($Task.phases_completed -join ', ')" -ForegroundColor $ColorSuccess
Write-Host "   Phases Remaining: $(if ($Task.phases_remaining.Count -gt 0) { $Task.phases_remaining -join ', ' } else { 'None (final phase)' })" -ForegroundColor $ColorInfo

Write-Host "`n🚀 Ready to begin Phase $ToPhase" -ForegroundColor $ColorSuccess
Write-Host ""
