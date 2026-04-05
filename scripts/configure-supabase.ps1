# Supabase Configuration Script
# This script will help you configure your Supabase credentials for production

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CCW-Online ERP - Supabase Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will guide you through configuring Supabase for production." -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "apps\backend\src")) {
    Write-Host "ERROR: Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Get Your Supabase Credentials" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Opening Supabase API Keys page in your browser..." -ForegroundColor Yellow
Start-Process "https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy"
Write-Host ""

# Get Anon Key
Write-Host "Copy your Supabase ANON KEY and paste it here:" -ForegroundColor Cyan
$anonKey = Read-Host -Prompt "Anon Key"

if ([string]::IsNullOrWhiteSpace($anonKey) -or !$anonKey.StartsWith("eyJ")) {
    Write-Host "ERROR: Invalid anon key. It should start with 'eyJ'." -ForegroundColor Red
    exit 1
}

# Get Service Role Key
Write-Host ""
Write-Host "Click 'Reveal' on the service_role key, then copy and paste it here:" -ForegroundColor Cyan
$serviceRoleKey = Read-Host -Prompt "Service Role Key"

if ([string]::IsNullOrWhiteSpace($serviceRoleKey) -or !$serviceRoleKey.StartsWith("eyJ")) {
    Write-Host "ERROR: Invalid service role key. It should start with 'eyJ'." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Get Your Database Password" -ForegroundColor Green
Write-Host "-----------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Opening Supabase Database Settings page..." -ForegroundColor Yellow
Start-Process "https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database"
Write-Host ""
Write-Host "Click 'Reset database password', copy the password, and paste it here:" -ForegroundColor Cyan
$dbPassword = Read-Host -Prompt "Database Password" -AsSecureString
$dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) {
    Write-Host "ERROR: Database password cannot be empty." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Generate JWT Secret" -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Generating secure JWT secret key..." -ForegroundColor Yellow
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

Write-Host ""
Write-Host "Step 4: Update Environment Files" -ForegroundColor Green
Write-Host "---------------------------------" -ForegroundColor Green
Write-Host ""

# Update root .env.production
$envProductionPath = ".env.production"
if (Test-Path $envProductionPath) {
    Write-Host "Updating $envProductionPath..." -ForegroundColor Yellow

    $content = Get-Content $envProductionPath -Raw
    $content = $content -replace 'NEXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey"
    $content = $content -replace 'SUPABASE_SERVICE_ROLE_KEY=.*', "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey"
    $content = $content -replace 'DATABASE_URL=postgresql://postgres:.*@', "DATABASE_URL=postgresql://postgres:$dbPasswordPlain@"
    $content = $content -replace 'JWT_SECRET_KEY=.*', "JWT_SECRET_KEY=$jwtSecret"

    Set-Content $envProductionPath -Value $content -NoNewline
    Write-Host "Updated $envProductionPath successfully" -ForegroundColor Green
}

# Update backend .env.production
$backendEnvPath = "apps\backend\.env.production"
if (!(Test-Path $backendEnvPath)) {
    Write-Host "Creating $backendEnvPath from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" $backendEnvPath
}

Write-Host "Updating $backendEnvPath..." -ForegroundColor Yellow
$content = Get-Content $backendEnvPath -Raw
$content = $content -replace 'NEXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey"
$content = $content -replace 'SUPABASE_SERVICE_ROLE_KEY=.*', "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey"
$content = $content -replace 'DATABASE_URL=postgresql://postgres:.*@', "DATABASE_URL=postgresql://postgres:$dbPasswordPlain@"
$content = $content -replace 'JWT_SECRET_KEY=.*', "JWT_SECRET_KEY=$jwtSecret"
Set-Content $backendEnvPath -Value $content -NoNewline
Write-Host "Updated $backendEnvPath successfully" -ForegroundColor Green

# Update frontend .env.production.local
$frontendEnvPath = "apps\web\.env.production.local"
if (!(Test-Path $frontendEnvPath)) {
    Write-Host "Creating $frontendEnvPath from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" $frontendEnvPath
}

Write-Host "Updating $frontendEnvPath..." -ForegroundColor Yellow
$content = Get-Content $frontendEnvPath -Raw
$content = $content -replace 'NEXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey"
Set-Content $frontendEnvPath -Value $content -NoNewline
Write-Host "Updated $frontendEnvPath successfully" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Supabase credentials have been configured." -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test the connection: .\scripts\test-supabase-connection.ps1" -ForegroundColor White
Write-Host "2. Migrate database schema (see SUPABASE_SETUP.md)" -ForegroundColor White
Write-Host "3. Deploy to production" -ForegroundColor White
Write-Host ""
Write-Host "SECURITY REMINDER:" -ForegroundColor Red
Write-Host "- Never commit .env.production or .env.production.local to git" -ForegroundColor Yellow
Write-Host "- Keep your service_role key secret" -ForegroundColor Yellow
Write-Host "- Use environment variables in your deployment platform" -ForegroundColor Yellow
Write-Host ""
