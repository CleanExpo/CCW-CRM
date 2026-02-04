# Security Audit Script for CCW Online ERP
# This script performs automated security checks

param(
    [switch]$Verbose = $false,
    [switch]$Quick = $false
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "CCW ONLINE ERP - SECURITY AUDIT" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$issues = @{
    Critical = @()
    High = @()
    Medium = @()
    Low = @()
    Info = @()
}

function Add-Issue {
    param(
        [string]$Severity,
        [string]$Title,
        [string]$Description
    )

    $issues[$Severity] += @{
        Title = $Title
        Description = $Description
    }
}

# ============================================================================
# 1. CHECK FOR EXPOSED SECRETS
# ============================================================================

Write-Host "[1/10] Checking for exposed secrets..." -ForegroundColor Yellow

$secretPatterns = @(
    @{Name="AWS Key"; Pattern="AKIA[0-9A-Z]{16}"},
    @{Name="API Key"; Pattern="api[_-]?key[\s]*=[\s]*['\"][a-zA-Z0-9]{20,}"},
    @{Name="Password"; Pattern="password[\s]*=[\s]*['\"][^'\"]{8,}"},
    @{Name="JWT Secret"; Pattern="jwt[_-]?secret[\s]*=[\s]*['\"][^'\"]{20,}"},
    @{Name="Database URL"; Pattern="postgres://[^:]+:[^@]+@"}
)

$filesToCheck = Get-ChildItem -Path $projectRoot -Recurse -File -Include *.ts,*.tsx,*.py,*.js,*.jsx -Exclude node_modules,*.min.js,dist,build,.next

foreach ($file in $filesToCheck) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern.Pattern) {
                Add-Issue "Critical" "Potential $($pattern.Name) Exposed" "Found in: $($file.FullName)"
            }
        }
    }
}

if ($issues.Critical.Count -eq 0) {
    Write-Host "   ✅ No exposed secrets found" -ForegroundColor Green
} else {
    Write-Host "   ❌ Found $($issues.Critical.Count) potential secret exposures" -ForegroundColor Red
}

# ============================================================================
# 2. CHECK DEPENDENCY VULNERABILITIES
# ============================================================================

Write-Host "[2/10] Checking backend dependencies..." -ForegroundColor Yellow

Push-Location "$projectRoot\apps\backend"

# Check if safety is installed
$safetyInstalled = (pip list 2>$null | Select-String "safety")

if ($safetyInstalled) {
    $safetyOutput = safety check --json 2>&1
    if ($safetyOutput -match "vulnerabilities found") {
        Add-Issue "High" "Backend Dependencies Have Vulnerabilities" "Run 'pip install safety && safety check' for details"
        Write-Host "   ⚠️  Vulnerabilities found in Python packages" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Backend dependencies are secure" -ForegroundColor Green
    }
} else {
    Add-Issue "Info" "Safety Not Installed" "Install with: pip install safety"
    Write-Host "   ⚠️  Safety scanner not installed (pip install safety)" -ForegroundColor Yellow
}

Pop-Location

Write-Host "[3/10] Checking frontend dependencies..." -ForegroundColor Yellow

Push-Location "$projectRoot\apps\web"

$auditOutput = pnpm audit --json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($auditOutput) {
    $highVulns = ($auditOutput.vulnerabilities | Where-Object {$_.severity -eq "high" -or $_.severity -eq "critical"}).Count

    if ($highVulns -gt 0) {
        Add-Issue "High" "Frontend Dependencies Have Vulnerabilities" "$highVulns high/critical vulnerabilities found"
        Write-Host "   ⚠️  $highVulns high/critical vulnerabilities in npm packages" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Frontend dependencies are secure" -ForegroundColor Green
    }
} else {
    Write-Host "   ✅ Frontend dependencies appear secure" -ForegroundColor Green
}

Pop-Location

# ============================================================================
# 3. CHECK ENVIRONMENT FILES
# ============================================================================

Write-Host "[4/10] Checking environment file security..." -ForegroundColor Yellow

$envFiles = Get-ChildItem -Path $projectRoot -Filter ".env*" -File -Recurse -ErrorAction SilentlyContinue

foreach ($envFile in $envFiles) {
    # Check if .env is in .gitignore
    $gitignorePath = Join-Path $projectRoot ".gitignore"
    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw
        if ($gitignoreContent -notmatch "\.env") {
            Add-Issue "Critical" ".env Files Not in .gitignore" "Add .env* to .gitignore immediately"
        }
    }

    # Check for weak secrets
    $envContent = Get-Content $envFile.FullName -Raw
    if ($envContent -match "password.*=.*(password|123456|admin)") {
        Add-Issue "High" "Weak Password in .env" "Found in: $($envFile.FullName)"
    }
}

Write-Host "   ✅ Environment file check complete" -ForegroundColor Green

# ============================================================================
# 4. CHECK AUTHENTICATION SECURITY
# ============================================================================

Write-Host "[5/10] Checking authentication security..." -ForegroundColor Yellow

$authFile = Join-Path $projectRoot "apps\backend\src\api\routes\demo_auth.py"

if (Test-Path $authFile) {
    $authContent = Get-Content $authFile -Raw

    # Check for bcrypt usage
    if ($authContent -match "bcrypt") {
        Write-Host "   ✅ Using bcrypt for password hashing" -ForegroundColor Green
    } else {
        Add-Issue "Critical" "Weak Password Hashing" "Not using bcrypt"
    }

    # Check for JWT expiry
    if ($authContent -match "expire") {
        Write-Host "   ✅ JWT tokens have expiry" -ForegroundColor Green
    } else {
        Add-Issue "High" "JWT Tokens May Not Expire" "Add token expiry"
    }
} else {
    Add-Issue "Info" "Auth File Not Found" "Could not verify authentication security"
}

# ============================================================================
# 5. CHECK SQL INJECTION PROTECTION
# ============================================================================

Write-Host "[6/10] Checking SQL injection protection..." -ForegroundColor Yellow

$pyFiles = Get-ChildItem -Path "$projectRoot\apps\backend" -Filter "*.py" -Recurse -ErrorAction SilentlyContinue

$rawSqlCount = 0
$unsafeRawSql = 0

foreach ($pyFile in $pyFiles) {
    $content = Get-Content $pyFile.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        # Check for raw SQL
        if ($content -match 'execute\s*\(\s*["\']') {
            $rawSqlCount++

            # Check if parameterized
            if ($content -notmatch 'bindparams|:param') {
                $unsafeRawSql++
                Add-Issue "Critical" "Potential SQL Injection" "Unparameterized query in: $($pyFile.FullName)"
            }
        }
    }
}

if ($unsafeRawSql -eq 0) {
    Write-Host "   ✅ No SQL injection vulnerabilities found" -ForegroundColor Green
} else {
    Write-Host "   ❌ Found $unsafeRawSql potential SQL injection points" -ForegroundColor Red
}

# ============================================================================
# 6. CHECK XSS PROTECTION
# ============================================================================

Write-Host "[7/10] Checking XSS protection..." -ForegroundColor Yellow

$tsxFiles = Get-ChildItem -Path "$projectRoot\apps\web" -Filter "*.tsx" -Recurse -Exclude node_modules,dist,.next -ErrorAction SilentlyContinue

$dangerousHtmlCount = 0

foreach ($tsxFile in $tsxFiles) {
    $content = Get-Content $tsxFile.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "dangerouslySetInnerHTML") {
        $dangerousHtmlCount++
        Add-Issue "High" "Potential XSS Vulnerability" "dangerouslySetInnerHTML used in: $($tsxFile.FullName)"
    }
}

if ($dangerousHtmlCount -eq 0) {
    Write-Host "   ✅ No XSS vulnerabilities found" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Found $dangerousHtmlCount uses of dangerouslySetInnerHTML" -ForegroundColor Yellow
}

# ============================================================================
# 7. CHECK CORS CONFIGURATION
# ============================================================================

Write-Host "[8/10] Checking CORS configuration..." -ForegroundColor Yellow

$mainFile = Join-Path $projectRoot "apps\backend\src\api\main.py"

if (Test-Path $mainFile) {
    $mainContent = Get-Content $mainFile -Raw

    if ($mainContent -match "allow_origins.*\[.*\*.*\]") {
        Add-Issue "High" "CORS Allows All Origins" "Restrict CORS to specific domains"
        Write-Host "   ⚠️  CORS allows all origins (*)" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ CORS properly configured" -ForegroundColor Green
    }
}

# ============================================================================
# 8. CHECK SECURITY HEADERS
# ============================================================================

Write-Host "[9/10] Checking security headers..." -ForegroundColor Yellow

if (Test-Path $mainFile) {
    $mainContent = Get-Content $mainFile -Raw

    $headers = @(
        @{Name="X-Content-Type-Options"; Pattern="X-Content-Type-Options"},
        @{Name="X-Frame-Options"; Pattern="X-Frame-Options"},
        @{Name="Strict-Transport-Security"; Pattern="Strict-Transport-Security"}
    )

    $missingHeaders = @()

    foreach ($header in $headers) {
        if ($mainContent -notmatch $header.Pattern) {
            $missingHeaders += $header.Name
        }
    }

    if ($missingHeaders.Count -gt 0) {
        Add-Issue "Medium" "Missing Security Headers" "Add: $($missingHeaders -join ', ')"
        Write-Host "   ⚠️  Missing headers: $($missingHeaders -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ All security headers present" -ForegroundColor Green
    }
}

# ============================================================================
# 9. CHECK RATE LIMITING
# ============================================================================

Write-Host "[10/10] Checking rate limiting..." -ForegroundColor Yellow

if (Test-Path $mainFile) {
    $mainContent = Get-Content $mainFile -Raw

    if ($mainContent -match "limiter|slowapi|RateLimiter") {
        Write-Host "   ✅ Rate limiting implemented" -ForegroundColor Green
    } else {
        Add-Issue "High" "No Global Rate Limiting" "Implement rate limiting to prevent abuse"
        Write-Host "   ⚠️  No global rate limiting found" -ForegroundColor Yellow
    }
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "SECURITY AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$totalIssues = $issues.Critical.Count + $issues.High.Count + $issues.Medium.Count + $issues.Low.Count

if ($totalIssues -eq 0) {
    Write-Host "🎉 No security issues found!" -ForegroundColor Green
} else {
    Write-Host "Found $totalIssues issue(s):" -ForegroundColor Yellow
    Write-Host ""

    if ($issues.Critical.Count -gt 0) {
        Write-Host "🔴 CRITICAL ($($issues.Critical.Count)):" -ForegroundColor Red
        foreach ($issue in $issues.Critical) {
            Write-Host "   - $($issue.Title)" -ForegroundColor Red
            Write-Host "     $($issue.Description)" -ForegroundColor Gray
        }
        Write-Host ""
    }

    if ($issues.High.Count -gt 0) {
        Write-Host "🟠 HIGH ($($issues.High.Count)):" -ForegroundColor DarkYellow
        foreach ($issue in $issues.High) {
            Write-Host "   - $($issue.Title)" -ForegroundColor DarkYellow
            Write-Host "     $($issue.Description)" -ForegroundColor Gray
        }
        Write-Host ""
    }

    if ($issues.Medium.Count -gt 0) {
        Write-Host "🟡 MEDIUM ($($issues.Medium.Count)):" -ForegroundColor Yellow
        foreach ($issue in $issues.Medium) {
            Write-Host "   - $($issue.Title)" -ForegroundColor Yellow
            Write-Host "     $($issue.Description)" -ForegroundColor Gray
        }
        Write-Host ""
    }

    if ($issues.Low.Count -gt 0) {
        Write-Host "🔵 LOW ($($issues.Low.Count)):" -ForegroundColor Blue
        foreach ($issue in $issues.Low) {
            Write-Host "   - $($issue.Title)" -ForegroundColor Blue
            Write-Host "     $($issue.Description)" -ForegroundColor Gray
        }
        Write-Host ""
    }
}

# ============================================================================
# RECOMMENDATIONS
# ============================================================================

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "RECOMMENDATIONS" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Run 'pip install safety && safety check' for detailed dependency audit" -ForegroundColor White
Write-Host "2. Run 'pnpm audit' in apps/web for frontend vulnerabilities" -ForegroundColor White
Write-Host "3. Review SECURITY-AUDIT-CHECKLIST.md for manual checks" -ForegroundColor White
Write-Host "4. Consider using OWASP ZAP for dynamic security testing" -ForegroundColor White
Write-Host "5. Setup automated security scans in CI/CD pipeline" -ForegroundColor White
Write-Host ""

# Determine exit code
if ($issues.Critical.Count -gt 0) {
    Write-Host "❌ FAILED: Critical security issues found" -ForegroundColor Red
    exit 1
} elseif ($issues.High.Count -gt 0) {
    Write-Host "⚠️  WARNING: High priority security issues found" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✅ PASSED: No critical security issues" -ForegroundColor Green
    exit 0
}
