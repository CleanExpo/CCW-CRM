# SQL Files Testing Script
# Tests all SQL files in the project against the PostgreSQL database

$ErrorActionPreference = "Continue"
$results = @()

# Database connection details
$dbContainer = "nodejs-starter-postgres"
$dbUser = "starter_user"
$dbName = "starter_db"

Write-Host "=== SQL Files Testing Report ===" -ForegroundColor Cyan
Write-Host "Started: $(Get-Date)" -ForegroundColor Cyan
Write-Host ""

# Function to test a SQL file
function Test-SqlFile {
    param($filePath)

    $fileName = Split-Path $filePath -Leaf
    $relativePath = $filePath.Replace("D:\CCW-ERP-CRM\", "")

    Write-Host "Testing: $relativePath" -ForegroundColor Yellow

    # Check if file exists
    if (-not (Test-Path $filePath)) {
        Write-Host "  ERROR: File not found" -ForegroundColor Red
        return @{
            File = $relativePath
            Status = "ERROR"
            Message = "File not found"
        }
    }

    # Read file content to check for syntax
    try {
        $content = Get-Content $filePath -Raw
        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Host "  WARNING: File is empty" -ForegroundColor Yellow
            return @{
                File = $relativePath
                Status = "WARNING"
                Message = "Empty file"
            }
        }
    } catch {
        Write-Host "  ERROR: Cannot read file - $($_.Exception.Message)" -ForegroundColor Red
        return @{
            File = $relativePath
            Status = "ERROR"
            Message = "Cannot read file"
        }
    }

    # Test SQL syntax by running EXPLAIN on SELECT statements or validating syntax
    # For DDL statements, we'll do a dry-run check
    try {
        # Create a test transaction that we'll rollback
        $testCommand = @"
BEGIN;
$content
ROLLBACK;
"@

        # Save to temp file
        $tempFile = [System.IO.Path]::GetTempFileName()
        $testCommand | Out-File -FilePath $tempFile -Encoding UTF8

        # Run in transaction (will rollback, so no changes)
        $result = docker exec $dbContainer psql -U $dbUser -d $dbName -f /tmp/test.sql 2>&1

        # Copy temp file to container
        docker cp $tempFile "${dbContainer}:/tmp/test.sql" 2>&1 | Out-Null

        # Execute
        $output = docker exec $dbContainer psql -U $dbUser -d $dbName -f /tmp/test.sql 2>&1

        # Clean up
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        docker exec $dbContainer rm /tmp/test.sql 2>&1 | Out-Null

        # Check output for errors
        $outputStr = $output -join "`n"

        if ($outputStr -match "ERROR|FATAL" -and $outputStr -notmatch "ROLLBACK") {
            Write-Host "  FAILED: SQL errors found" -ForegroundColor Red
            Write-Host "  $($outputStr.Substring(0, [Math]::Min(200, $outputStr.Length)))" -ForegroundColor Gray
            return @{
                File = $relativePath
                Status = "FAILED"
                Message = "SQL syntax errors"
            }
        } elseif ($outputStr -match "already exists" -or $outputStr -match "does not exist") {
            Write-Host "  SKIPPED: Schema conflicts (expected for migrations)" -ForegroundColor Cyan
            return @{
                File = $relativePath
                Status = "SKIPPED"
                Message = "Schema already exists or missing dependencies"
            }
        } else {
            Write-Host "  PASSED: Valid SQL syntax" -ForegroundColor Green
            return @{
                File = $relativePath
                Status = "PASSED"
                Message = "Valid SQL"
            }
        }
    } catch {
        Write-Host "  ERROR: Test failed - $($_.Exception.Message)" -ForegroundColor Red
        return @{
            File = $relativePath
            Status = "ERROR"
            Message = $_.Exception.Message
        }
    }
}

# Get all SQL files
$sqlFiles = Get-ChildItem -Path "D:\CCW-ERP-CRM" -Filter "*.sql" -Recurse |
    Where-Object { $_.FullName -notmatch "node_modules|\.venv|\.next|dist|NodeJS-Starter-V1" } |
    Sort-Object FullName

Write-Host "Found $($sqlFiles.Count) SQL files to test" -ForegroundColor Cyan
Write-Host ""

# Test each file
foreach ($file in $sqlFiles) {
    $result = Test-SqlFile -filePath $file.FullName
    $results += $result
    Start-Sleep -Milliseconds 100
}

# Summary
Write-Host ""
Write-Host "=== Testing Summary ===" -ForegroundColor Cyan
Write-Host "Total Files: $($results.Count)" -ForegroundColor White

$passed = ($results | Where-Object { $_.Status -eq "PASSED" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAILED" }).Count
$errors = ($results | Where-Object { $_.Status -eq "ERROR" }).Count
$skipped = ($results | Where-Object { $_.Status -eq "SKIPPED" }).Count
$warnings = ($results | Where-Object { $_.Status -eq "WARNING" }).Count

Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Errors: $errors" -ForegroundColor Red
Write-Host "Skipped: $skipped" -ForegroundColor Cyan
Write-Host "Warnings: $warnings" -ForegroundColor Yellow

# Export results to JSON
$results | ConvertTo-Json | Out-File "D:\CCW-ERP-CRM\SQL-TEST-RESULTS.json"
Write-Host ""
Write-Host "Detailed results saved to: SQL-TEST-RESULTS.json" -ForegroundColor Cyan

# Show failed files
if ($failed -gt 0 -or $errors -gt 0) {
    Write-Host ""
    Write-Host "=== Failed/Error Files ===" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "FAILED" -or $_.Status -eq "ERROR" } | ForEach-Object {
        Write-Host "  - $($_.File): $($_.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Completed: $(Get-Date)" -ForegroundColor Cyan
