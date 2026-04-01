# Migrate Database Schema to Supabase
# This script exports your local schema and imports it to Supabase

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Database Migration to Supabase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will migrate your database schema from local PostgreSQL to Supabase." -ForegroundColor Yellow
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    $dockerCheck = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running"
    }
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Check if local PostgreSQL container is running
Write-Host "Checking local PostgreSQL container..." -ForegroundColor Yellow
$containerRunning = docker ps --filter "name=nodejs-starter-postgres" --format "{{.Names}}"
if (!$containerRunning) {
    Write-Host "ERROR: Local PostgreSQL container 'nodejs-starter-postgres' is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker compose up -d" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Local PostgreSQL is running" -ForegroundColor Green

Write-Host ""
Write-Host "Step 1: Export Schema from Local PostgreSQL" -ForegroundColor Green
Write-Host "--------------------------------------------" -ForegroundColor Green
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$schemaFile = "backup\schema_$timestamp.sql"
$dataFile = "backup\data_$timestamp.sql"

# Create backup directory
if (!(Test-Path "backup")) {
    New-Item -ItemType Directory -Path "backup" | Out-Null
}

Write-Host "Exporting schema..." -ForegroundColor Yellow
docker exec nodejs-starter-postgres pg_dump -U starter_user -d starter_db --schema-only --no-owner --no-acl > $schemaFile

if ($LASTEXITCODE -eq 0 -and (Test-Path $schemaFile)) {
    $fileSize = (Get-Item $schemaFile).Length
    Write-Host "✓ Schema exported: $schemaFile ($fileSize bytes)" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to export schema" -ForegroundColor Red
    exit 1
}

Write-Host ""
$exportData = Read-Host "Do you want to export data as well? (y/N)"
if ($exportData -eq "y" -or $exportData -eq "Y") {
    Write-Host "Exporting data..." -ForegroundColor Yellow
    docker exec nodejs-starter-postgres pg_dump -U starter_user -d starter_db --data-only --no-owner --no-acl > $dataFile

    if ($LASTEXITCODE -eq 0 -and (Test-Path $dataFile)) {
        $fileSize = (Get-Item $dataFile).Length
        Write-Host "✓ Data exported: $dataFile ($fileSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to export data" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Import to Supabase" -ForegroundColor Green
Write-Host "---------------------------" -ForegroundColor Green
Write-Host ""

# Load credentials
if (!(Test-Path ".env.production")) {
    Write-Host "ERROR: .env.production not found!" -ForegroundColor Red
    Write-Host "Please run configure-supabase.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Extract database URL from .env.production
$envContent = Get-Content ".env.production"
$dbUrlLine = $envContent | Where-Object { $_ -match "^DATABASE_URL=" }
if (!$dbUrlLine) {
    Write-Host "ERROR: DATABASE_URL not found in .env.production" -ForegroundColor Red
    exit 1
}

# Convert pooled connection (port 6543) to direct connection (port 5432) for import
$dbUrl = ($dbUrlLine -split "=", 2)[1].Trim()
$dbUrlDirect = $dbUrl -replace ":6543/", ":5432/" -replace "\?pgbouncer=true", ""

Write-Host "Supabase Connection: $($dbUrlDirect -replace 'postgres:[^@]+@', 'postgres:***@')" -ForegroundColor Cyan
Write-Host ""

Write-Host "WARNING: This will import the schema to your Supabase database." -ForegroundColor Yellow
Write-Host "If tables already exist, this may cause conflicts." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Continue with import? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Import cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Importing schema to Supabase..." -ForegroundColor Yellow

# Check if psql is available
try {
    $psqlCheck = psql --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql not found"
    }
    Write-Host "✓ psql is available" -ForegroundColor Green
} catch {
    Write-Host "ERROR: psql (PostgreSQL client) is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install psql:" -ForegroundColor Yellow
    Write-Host "1. Download PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Install and add to PATH" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternatively, use the Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host "1. Open: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new" -ForegroundColor White
    Write-Host "2. Copy contents of $schemaFile" -ForegroundColor White
    Write-Host "3. Paste and execute in SQL Editor" -ForegroundColor White
    exit 1
}

# Import schema
$env:PGPASSWORD = ""  # Will be extracted from URL
psql $dbUrlDirect -f $schemaFile 2>&1 | ForEach-Object {
    if ($_ -match "ERROR") {
        Write-Host $_ -ForegroundColor Red
    } elseif ($_ -match "CREATE|ALTER") {
        Write-Host $_ -ForegroundColor Green
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Schema imported successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠ Schema import completed with some errors" -ForegroundColor Yellow
    Write-Host "This is normal if some objects already existed" -ForegroundColor Gray
}

# Import data if exported
if ($exportData -eq "y" -or $exportData -eq "Y") {
    Write-Host ""
    Write-Host "Importing data to Supabase..." -ForegroundColor Yellow
    psql $dbUrlDirect -f $dataFile 2>&1 | ForEach-Object {
        if ($_ -match "ERROR") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($_ -match "INSERT|COPY") {
            Write-Host $_ -ForegroundColor Green
        } else {
            Write-Host $_ -ForegroundColor Gray
        }
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Data imported successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠ Data import completed with some errors" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup files created:" -ForegroundColor Yellow
Write-Host "- $schemaFile" -ForegroundColor White
if ($exportData -eq "y" -or $exportData -eq "Y") {
    Write-Host "- $dataFile" -ForegroundColor White
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify migration in Supabase dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/database/tables" -ForegroundColor Cyan
Write-Host "2. Set up Row Level Security (RLS) policies" -ForegroundColor White
Write-Host "3. Test your application with Supabase" -ForegroundColor White
Write-Host "4. Deploy to production" -ForegroundColor White
Write-Host ""
