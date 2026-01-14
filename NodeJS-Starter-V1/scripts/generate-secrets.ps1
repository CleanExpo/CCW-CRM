# Generate Production Secrets
# This script generates secure random secrets for production deployment

Write-Host "======================================"
Write-Host " Production Secrets Generator"
Write-Host "======================================"
Write-Host ""

# Generate JWT Secret Key (64 characters, 32 bytes)
Write-Host "1. JWT Secret Key (for Railway/backend):"
Write-Host "   Variable: JWT_SECRET_KEY"
Write-Host ""
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$jwtSecret = [Convert]::ToHexString($bytes).ToLower()
Write-Host "   $jwtSecret"
Write-Host ""
Write-Host "   Copy this to Railway dashboard → Variables → JWT_SECRET_KEY"
Write-Host ""

# Generate Session Secret (optional, for future use)
Write-Host "2. Session Secret (optional, for future features):"
Write-Host "   Variable: SESSION_SECRET"
Write-Host ""
$sessionBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($sessionBytes)
$sessionSecret = [Convert]::ToHexString($sessionBytes).ToLower()
Write-Host "   $sessionSecret"
Write-Host ""

Write-Host "======================================"
Write-Host " IMPORTANT REMINDERS"
Write-Host "======================================"
Write-Host ""
Write-Host "✅ NEVER commit these secrets to Git"
Write-Host "✅ Store secrets in Railway Variables (encrypted)"
Write-Host "✅ Use different secrets for development and production"
Write-Host "✅ Rotate secrets every 90 days"
Write-Host ""
Write-Host "======================================"
Write-Host " Next Steps"
Write-Host "======================================"
Write-Host ""
Write-Host "1. Copy JWT_SECRET_KEY to Railway dashboard"
Write-Host "2. Configure other environment variables from RAILWAY_DEPLOYMENT.md"
Write-Host "3. Deploy backend to Railway"
Write-Host "4. Run: .\scripts\verify-deployment.ps1 <YOUR_RAILWAY_URL>"
Write-Host ""
