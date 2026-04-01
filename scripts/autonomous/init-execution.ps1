<#
.SYNOPSIS
    Initialize execution state directory for autonomous development

.DESCRIPTION
    Creates the .claude/.execution directory structure and validates JSON schemas.
    Safe to run multiple times (idempotent).

.PARAMETER Force
    Recreate directory structure even if it exists

.EXAMPLE
    .\init-execution.ps1

.EXAMPLE
    .\init-execution.ps1 -Force

.NOTES
    Part of Phase 5 Autonomous Development Framework
    Created: February 5, 2026
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors for output
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

Write-Host "`n🚀 Initializing Autonomous Execution System" -ForegroundColor $ColorInfo
Write-Host "=" * 60 -ForegroundColor $ColorInfo

# Determine project root (2 levels up from scripts/autonomous/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ExecutionDir = Join-Path $ProjectRoot ".claude\.execution"

Write-Host "`nProject Root: $ProjectRoot" -ForegroundColor $ColorInfo
Write-Host "Execution Dir: $ExecutionDir" -ForegroundColor $ColorInfo

# Check if directory exists
if (Test-Path $ExecutionDir) {
    if ($Force) {
        Write-Host "`n⚠️  Directory exists. Force flag set - recreating..." -ForegroundColor $ColorWarning
        # Backup current state if exists
        if (Test-Path (Join-Path $ExecutionDir "current-task.json")) {
            $BackupDir = Join-Path $ExecutionDir "archives\$(Get-Date -Format 'yyyy-MM-dd_HHmmss')"
            New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
            Copy-Item -Path (Join-Path $ExecutionDir "*") -Destination $BackupDir -Recurse -Force
            Write-Host "   Backed up to: $BackupDir" -ForegroundColor $ColorSuccess
        }
    } else {
        Write-Host "`n✅ Execution directory already exists" -ForegroundColor $ColorSuccess
        Write-Host "   Use -Force to recreate" -ForegroundColor $ColorInfo
        exit 0
    }
}

# Create directory structure
Write-Host "`n📁 Creating directory structure..." -ForegroundColor $ColorInfo

$Directories = @(
    $ExecutionDir,
    (Join-Path $ExecutionDir "schemas"),
    (Join-Path $ExecutionDir "phase-handoffs"),
    (Join-Path $ExecutionDir "validation-reports"),
    (Join-Path $ExecutionDir "archives")
)

foreach ($Dir in $Directories) {
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
        Write-Host "   ✓ Created: $($Dir.Replace($ProjectRoot, ''))" -ForegroundColor $ColorSuccess
    } else {
        Write-Host "   ✓ Exists: $($Dir.Replace($ProjectRoot, ''))" -ForegroundColor $ColorSuccess
    }
}

# Validate JSON schemas
Write-Host "`n📋 Validating JSON schemas..." -ForegroundColor $ColorInfo

$SchemasDir = Join-Path $ExecutionDir "schemas"
$SchemaFiles = Get-ChildItem -Path $SchemasDir -Filter "*.schema.json" -ErrorAction SilentlyContinue

if ($SchemaFiles.Count -eq 0) {
    Write-Host "   ⚠️  No schema files found" -ForegroundColor $ColorWarning
    Write-Host "   Expected schemas should be created by agent system" -ForegroundColor $ColorWarning
} else {
    foreach ($SchemaFile in $SchemaFiles) {
        try {
            $Schema = Get-Content $SchemaFile.FullName -Raw | ConvertFrom-Json
            if ($Schema.'$schema' -and $Schema.title) {
                Write-Host "   ✓ Valid: $($SchemaFile.Name)" -ForegroundColor $ColorSuccess
            } else {
                Write-Host "   ⚠️  Missing fields: $($SchemaFile.Name)" -ForegroundColor $ColorWarning
            }
        } catch {
            Write-Host "   ❌ Invalid JSON: $($SchemaFile.Name)" -ForegroundColor $ColorError
            Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor $ColorError
        }
    }
}

# Check for README
Write-Host "`n📖 Checking documentation..." -ForegroundColor $ColorInfo

$ReadmePath = Join-Path $ExecutionDir "README.md"
if (Test-Path $ReadmePath) {
    Write-Host "   ✓ README.md exists" -ForegroundColor $ColorSuccess
} else {
    Write-Host "   ⚠️  README.md missing" -ForegroundColor $ColorWarning
}

# Check for .gitignore
$GitignorePath = Join-Path $ExecutionDir ".gitignore"
if (Test-Path $GitignorePath) {
    Write-Host "   ✓ .gitignore exists" -ForegroundColor $ColorSuccess
} else {
    Write-Host "   ⚠️  .gitignore missing (runtime state will be versioned!)" -ForegroundColor $ColorWarning
}

# Final summary
Write-Host "`n" + ("=" * 60) -ForegroundColor $ColorInfo
Write-Host "✅ Initialization Complete!" -ForegroundColor $ColorSuccess
Write-Host "`nExecution directory ready at:" -ForegroundColor $ColorInfo
Write-Host "   $ExecutionDir" -ForegroundColor $ColorInfo

Write-Host "`nNext steps:" -ForegroundColor $ColorInfo
Write-Host "   1. Run autonomous task: /autonomous `"your task description`"" -ForegroundColor $ColorInfo
Write-Host "   2. Monitor progress: .\scripts\autonomous\validate-state.ps1" -ForegroundColor $ColorInfo
Write-Host "   3. View logs: Get-Content .claude\.execution\execution-log.jsonl" -ForegroundColor $ColorInfo

Write-Host ""
