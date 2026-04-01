# Test Supabase Connection Script
# This script tests your Supabase database connection

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Supabase Connection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location "apps\backend"

Write-Host "Loading environment variables..." -ForegroundColor Yellow

# Load .env.production
if (!(Test-Path ".env.production")) {
    Write-Host "ERROR: .env.production not found!" -ForegroundColor Red
    Write-Host "Please run configure-supabase.ps1 first." -ForegroundColor Yellow
    Set-Location "..\..\"
    exit 1
}

# Test Python/UV installation
Write-Host "Checking Python environment..." -ForegroundColor Yellow
try {
    $uvVersion = uv --version 2>&1
    Write-Host "✓ UV is installed: $uvVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: UV is not installed!" -ForegroundColor Red
    Write-Host "Install it with: pip install uv" -ForegroundColor Yellow
    Set-Location "..\..\"
    exit 1
}

Write-Host ""
Write-Host "Test 1: Validate Database URL Format" -ForegroundColor Green
Write-Host "-------------------------------------" -ForegroundColor Green

$testScript = @'
import os
from dotenv import load_dotenv

load_dotenv(".env.production")

db_url = os.getenv("DATABASE_URL")
if db_url:
    if "vwfgksqkajnpfjospbpe.supabase.co" in db_url:
        print("✓ Database URL is configured for Supabase")
        if "6543" in db_url:
            print("✓ Using connection pooling (port 6543)")
        elif "5432" in db_url:
            print("⚠ Using direct connection (port 5432) - consider using pooling")
        exit(0)
    else:
        print("✗ Database URL does not point to Supabase")
        exit(1)
else:
    print("✗ DATABASE_URL not found in .env.production")
    exit(1)
'@

$testScript | Out-File -FilePath "test_config.py" -Encoding utf8
$result = uv run python test_config.py
Write-Host $result
Remove-Item "test_config.py"

Write-Host ""
Write-Host "Test 2: Test Database Connection" -ForegroundColor Green
Write-Host "---------------------------------" -ForegroundColor Green

$connectionTest = @'
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env.production")

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("✗ DATABASE_URL not found")
    exit(1)

print("Connecting to database...")
try:
    # Create engine with connection pooling settings
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=False
    )

    # Test connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"✓ Connected successfully!")
        print(f"  PostgreSQL version: {version[:50]}...")

        # Test schema query
        result = conn.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"))
        table_count = result.scalar()
        print(f"✓ Found {table_count} tables in public schema")

        print("\n✓ Database connection is working!")
        exit(0)

except Exception as e:
    print(f"✗ Connection failed: {str(e)}")
    print("\nTroubleshooting:")
    print("1. Verify your database password is correct")
    print("2. Check that your IP is not blocked in Supabase dashboard")
    print("3. Ensure SSL is configured properly")
    exit(1)
'@

$connectionTest | Out-File -FilePath "test_connection.py" -Encoding utf8
$result = uv run python test_connection.py
Write-Host $result
$exitCode = $LASTEXITCODE
Remove-Item "test_connection.py"

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  All Tests Passed! ✓" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Your Supabase connection is configured correctly." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Migrate your database schema: See SUPABASE_SETUP.md" -ForegroundColor White
    Write-Host "2. Test your application locally with Supabase" -ForegroundColor White
    Write-Host "3. Deploy to production" -ForegroundColor White
} else {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Tests Failed ✗" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please check the errors above and:" -ForegroundColor Yellow
    Write-Host "1. Verify your credentials in .env.production" -ForegroundColor White
    Write-Host "2. Check Supabase dashboard for connection issues" -ForegroundColor White
    Write-Host "3. Review SUPABASE_SETUP.md for troubleshooting" -ForegroundColor White
}

Write-Host ""
Set-Location "..\..\"
