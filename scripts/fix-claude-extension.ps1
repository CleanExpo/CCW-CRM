#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Fixes common issues with the Claude Chrome Extension
.DESCRIPTION
    Diagnoses and fixes connectivity issues between Claude Chrome Extension and CLI
.NOTES
    Run as Administrator for best results
#>

param(
    [switch]$Force,
    [switch]$Reset
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Claude Chrome Extension Fix Tool" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Warning "Not running as Administrator. Some fixes may not work."
    Write-Host "Consider running: Start-Process PowerShell -Verb RunAs`n"
}

# Function to test port availability
function Test-PortAvailable {
    param([int]$Port)
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

# Function to find process using port
function Get-ProcessUsingPort {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        $processId = $connections[0].OwningProcess
        return Get-Process -Id $processId -ErrorAction SilentlyContinue
    }
    return $null
}

Write-Host "Step 1: Checking for port conflicts..." -ForegroundColor Yellow
$commonPorts = @(8080, 3456, 3000, 8000)
foreach ($port in $commonPorts) {
    $isAvailable = Test-PortAvailable -Port $port
    if (-not $isAvailable) {
        $process = Get-ProcessUsingPort -Port $port
        if ($process) {
            Write-Host "  Port $port is in use by: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Red
            if ($Force) {
                Write-Host "  Stopping process..." -ForegroundColor Yellow
                Stop-Process -Id $process.Id -Force
                Start-Sleep -Seconds 1
            }
        } else {
            Write-Host "  Port $port is blocked (unknown process)" -ForegroundColor Red
        }
    } else {
        Write-Host "  Port $port is available ✓" -ForegroundColor Green
    }
}

Write-Host "`nStep 2: Checking Chrome Extension..." -ForegroundColor Yellow
$chromePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions",
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings"
)
$claudeExtensionFound = $false
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $claudeDirs = Get-ChildItem -Path $path -Filter "*claude*" -Recurse -ErrorAction SilentlyContinue
        if ($claudeDirs) {
            Write-Host "  Claude extension found at: $($claudeDirs[0].FullName)" -ForegroundColor Green
            $claudeExtensionFound = $true
            break
        }
    }
}
if (-not $claudeExtensionFound) {
    Write-Warning "Claude extension not found in Chrome profile"
}

Write-Host "`nStep 3: Checking Native Messaging Host..." -ForegroundColor Yellow
$nativeMessagingPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts",
    "HKLM:\Software\Google\Chrome\NativeMessagingHosts"
)
$manifestFound = $false
foreach ($path in $nativeMessagingPaths) {
    if (Test-Path $path) {
        $manifest = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*claude*" }
        if ($manifest) {
            Write-Host "  Native messaging host found: $($manifest.Name)" -ForegroundColor Green
            $manifestPath = (Get-ItemProperty -Path $manifest.PSPath).'(default)'
            Write-Host "  Manifest path: $manifestPath" -ForegroundColor Gray
            if (Test-Path $manifestPath) {
                Write-Host "  Manifest file exists ✓" -ForegroundColor Green
            } else {
                Write-Warning "Manifest file not found at specified path"
            }
            $manifestFound = $true
            break
        }
    }
}
if (-not $manifestFound) {
    Write-Warning "Native messaging host not registered"
}

Write-Host "`nStep 4: Checking for conflicting processes..." -ForegroundColor Yellow
$processesToCheck = @("chrome", "claude", "node", "Code")
foreach ($procName in $processesToCheck) {
    $processes = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($processes) {
        $count = ($processes | Measure-Object).Count
        Write-Host "  Found $count $procName process(es)" -ForegroundColor Gray
        if ($procName -eq "claude" -and $count -gt 1) {
            Write-Warning "Multiple Claude processes detected - this may cause conflicts"
        }
    }
}

if ($Reset) {
    Write-Host "`nStep 5: Resetting Chrome extension data..." -ForegroundColor Yellow
    $extensionDataPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings"
    if (Test-Path $extensionDataPath) {
        $claudeDataDirs = Get-ChildItem -Path $extensionDataPath -Filter "*claude*" -ErrorAction SilentlyContinue
        foreach ($dir in $claudeDataDirs) {
            Write-Host "  Removing extension data: $($dir.Name)" -ForegroundColor Yellow
            Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  Extension data cleared" -ForegroundColor Green
    }
    
    Write-Host "`nStep 6: Flushing DNS cache..." -ForegroundColor Yellow
    try {
        ipconfig /flushdns | Out-Null
        Write-Host "  DNS cache flushed ✓" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to flush DNS cache"
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Fix Recommendations:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Restart Chrome completely (close all windows)"
Write-Host "2. Check chrome://extensions/ for Claude extension"
Write-Host "3. Enable 'Developer mode' and click 'Update'"
Write-Host "4. Try using Claude in terminal: npx claude"
Write-Host "5. If issues persist, reinstall the extension from Chrome Web Store"
Write-Host ""
Write-Host "For terminal-only mode (no browser):" -ForegroundColor Yellow
Write-Host "  export CLINE_NO_BROWSER=1" -ForegroundColor Gray
Write-Host "  cline" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan

# Offer to restart Chrome
$response = Read-Host "Would you like to restart Chrome now? (y/N)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "Stopping Chrome..." -ForegroundColor Yellow
    Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "Starting Chrome..." -ForegroundColor Green
    Start-Process "chrome"
}

Write-Host "`nDone!`n" -ForegroundColor Green
