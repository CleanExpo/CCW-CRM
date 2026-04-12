<#
.SYNOPSIS
    Clean up and archive old execution state

.DESCRIPTION
    Archives completed or old tasks, freeing up space and maintaining clean state directory.
    Can archive by age or archive all completed tasks.

.PARAMETER ArchiveOlderThanDays
    Archive tasks older than specified days (default: 7)

.PARAMETER ArchiveAll
    Archive all completed tasks regardless of age

.PARAMETER Force
    Skip confirmation prompts

.EXAMPLE
    .\cleanup-execution.ps1

.EXAMPLE
    .\cleanup-execution.ps1 -ArchiveOlderThanDays 30

.EXAMPLE
    .\cleanup-execution.ps1 -ArchiveAll -Force

.NOTES
    Part of Phase 5 Autonomous Development Framework
    Created: February 5, 2026
#>

[CmdletBinding()]
param(
    [int]$ArchiveOlderThanDays = 7,
    [switch]$ArchiveAll,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

Write-Host "`n🧹 Cleanup Autonomous Execution State" -ForegroundColor $ColorInfo
Write-Host "=" * 60 -ForegroundColor $ColorInfo

# Find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ExecutionDir = Join-Path $ProjectRoot ".claude\.execution"

if (-not (Test-Path $ExecutionDir)) {
    Write-Host "`n❌ Execution directory not found!" -ForegroundColor $ColorError
    Write-Host "   Nothing to clean up." -ForegroundColor $ColorInfo
    exit 0
}

Write-Host "`nExecution Dir: $ExecutionDir" -ForegroundColor $ColorInfo

# Check for active task
$CurrentTaskPath = Join-Path $ExecutionDir "current-task.json"
$HasActiveTask = $false

if (Test-Path $CurrentTaskPath) {
    try {
        $Task = Get-Content $CurrentTaskPath -Raw | ConvertFrom-Json
        if ($Task.status -in @("pending", "in_progress", "paused")) {
            $HasActiveTask = $true
            Write-Host "`n⚠️  Active task detected:" -ForegroundColor $ColorWarning
            Write-Host "   Task ID: $($Task.task_id)" -ForegroundColor $ColorInfo
            Write-Host "   Status: $($Task.status)" -ForegroundColor $ColorInfo

            if (-not $Force) {
                $Confirm = Read-Host "`nArchive active task? This may prevent resuming (y/N)"
                if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
                    Write-Host "`nℹ️  Cleanup cancelled by user" -ForegroundColor $ColorInfo
                    exit 0
                }
            }
        }
    } catch {
        Write-Host "`n⚠️  Failed to parse current-task.json" -ForegroundColor $ColorWarning
    }
}

# Determine what to archive
Write-Host "`n📦 Determining files to archive..." -ForegroundColor $ColorInfo

$FilesToArchive = @()

# Check execution log
$LogPath = Join-Path $ExecutionDir "execution-log.jsonl"
if (Test-Path $LogPath) {
    $LogInfo = Get-Item $LogPath
    $DaysSinceModified = (New-TimeSpan -Start $LogInfo.LastWriteTime -End (Get-Date)).Days

    if ($ArchiveAll -or $DaysSinceModified -ge $ArchiveOlderThanDays) {
        $FilesToArchive += $LogPath
        Write-Host "   - execution-log.jsonl (modified $DaysSinceModified days ago)" -ForegroundColor $ColorInfo
    }
}

# Check handoffs
$HandoffsDir = Join-Path $ExecutionDir "phase-handoffs"
$HandoffFiles = Get-ChildItem -Path $HandoffsDir -Filter "*.json" -ErrorAction SilentlyContinue
foreach ($File in $HandoffFiles) {
    $DaysSinceModified = (New-TimeSpan -Start $File.LastWriteTime -End (Get-Date)).Days
    if ($ArchiveAll -or $DaysSinceModified -ge $ArchiveOlderThanDays) {
        $FilesToArchive += $File.FullName
        Write-Host "   - $($File.Name) (modified $DaysSinceModified days ago)" -ForegroundColor $ColorInfo
    }
}

# Check validation reports
$ReportsDir = Join-Path $ExecutionDir "validation-reports"
$ReportFiles = Get-ChildItem -Path $ReportsDir -Filter "*.json" -ErrorAction SilentlyContinue
foreach ($File in $ReportFiles) {
    $DaysSinceModified = (New-TimeSpan -Start $File.LastWriteTime -End (Get-Date)).Days
    if ($ArchiveAll -or $DaysSinceModified -ge $ArchiveOlderThanDays) {
        $FilesToArchive += $File.FullName
        Write-Host "   - $($File.Name) (modified $DaysSinceModified days ago)" -ForegroundColor $ColorInfo
    }
}

# Include current task if archiving all or it's old/complete
if (Test-Path $CurrentTaskPath) {
    try {
        $Task = Get-Content $CurrentTaskPath -Raw | ConvertFrom-Json
        $TaskInfo = Get-Item $CurrentTaskPath
        $DaysSinceModified = (New-TimeSpan -Start $TaskInfo.LastWriteTime -End (Get-Date)).Days

        $ShouldArchive = $false
        if ($ArchiveAll -and $Task.status -in @("completed", "failed")) {
            $ShouldArchive = $true
        } elseif ($DaysSinceModified -ge $ArchiveOlderThanDays) {
            $ShouldArchive = $true
        }

        if ($ShouldArchive) {
            $FilesToArchive += $CurrentTaskPath
            Write-Host "   - current-task.json (status: $($Task.status), modified $DaysSinceModified days ago)" -ForegroundColor $ColorInfo
        }
    } catch {
        Write-Host "   ⚠️  Failed to check current-task.json" -ForegroundColor $ColorWarning
    }
}

# Summary
if ($FilesToArchive.Count -eq 0) {
    Write-Host "`n✅ Nothing to archive!" -ForegroundColor $ColorSuccess
    Write-Host "   Criteria: " -NoNewline -ForegroundColor $ColorInfo
    if ($ArchiveAll) {
        Write-Host "Archive all completed tasks" -ForegroundColor $ColorInfo
    } else {
        Write-Host "Archive tasks older than $ArchiveOlderThanDays days" -ForegroundColor $ColorInfo
    }
    exit 0
}

Write-Host "`n📊 Found $($FilesToArchive.Count) file(s) to archive" -ForegroundColor $ColorInfo

# Confirm
if (-not $Force) {
    $Confirm = Read-Host "`nProceed with archiving? (y/N)"
    if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
        Write-Host "`nℹ️  Cleanup cancelled by user" -ForegroundColor $ColorInfo
        exit 0
    }
}

# Create archive directory
$ArchiveDir = Join-Path $ExecutionDir "archives\$(Get-Date -Format 'yyyy-MM-dd_HHmmss')"
New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
Write-Host "`n📦 Archive location:" -ForegroundColor $ColorInfo
Write-Host "   $ArchiveDir" -ForegroundColor $ColorInfo

# Move files
Write-Host "`n🚚 Moving files to archive..." -ForegroundColor $ColorInfo
$ArchivedCount = 0

foreach ($FilePath in $FilesToArchive) {
    try {
        $FileName = Split-Path -Leaf $FilePath
        $DestPath = Join-Path $ArchiveDir $FileName

        Move-Item -Path $FilePath -Destination $DestPath -Force
        Write-Host "   ✓ Archived: $FileName" -ForegroundColor $ColorSuccess
        $ArchivedCount++
    } catch {
        Write-Host "   ❌ Failed to archive: $FileName" -ForegroundColor $ColorError
        Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor $ColorError
    }
}

# Clean up empty directories
$EmptyDirs = @($HandoffsDir, $ReportsDir) | Where-Object {
    (Test-Path $_) -and ((Get-ChildItem -Path $_ -Force).Count -eq 0)
}

if ($EmptyDirs.Count -gt 0) {
    Write-Host "`n🧹 Cleaning up empty directories..." -ForegroundColor $ColorInfo
    foreach ($Dir in $EmptyDirs) {
        $DirName = Split-Path -Leaf $Dir
        Write-Host "   ✓ $DirName" -ForegroundColor $ColorSuccess
    }
}

# Final summary
Write-Host "`n" + ("=" * 60) -ForegroundColor $ColorInfo
Write-Host "✅ Cleanup Complete!" -ForegroundColor $ColorSuccess
Write-Host "`nArchived: $ArchivedCount file(s)" -ForegroundColor $ColorInfo
Write-Host "Archive location: $ArchiveDir" -ForegroundColor $ColorInfo

if ($HasActiveTask -and (Test-Path $CurrentTaskPath)) {
    Write-Host "`n⚠️  Note: Active task was NOT archived" -ForegroundColor $ColorWarning
} elseif ($HasActiveTask) {
    Write-Host "`n⚠️  Note: Active task was archived (cannot be resumed)" -ForegroundColor $ColorWarning
}

Write-Host ""
