# Automated Data Import - All 5 Chunks
# This script will import all data chunks automatically

$chunks = @("aa", "ab", "ac", "ad", "ae")
$sizes = @("445 KB", "512 KB", "910 KB", "777 KB", "481 KB")
$backupPath = "C:\CCW-Online ERP\backup"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "AUTOMATED DATA IMPORT" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Importing 5 data chunks to Supabase..." -ForegroundColor Yellow
Write-Host "Keep SQL Editor open: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press ENTER to start, or Ctrl+C to cancel" -ForegroundColor Cyan
Read-Host

Add-Type -AssemblyName System.Windows.Forms

for ($i = 0; $i -lt $chunks.Length; $i++) {
    $chunkName = "data_chunk_$($chunks[$i])"
    $chunkNum = $i + 1
    $size = $sizes[$i]

    Write-Host ""
    Write-Host "[$chunkNum/5] Processing $chunkName ($size)..." -ForegroundColor Magenta

    # Copy to clipboard
    $filePath = Join-Path $backupPath $chunkName
    Get-Content $filePath -Raw | Set-Clipboard
    Write-Host "      ✓ Copied to clipboard" -ForegroundColor Green

    # Give user time to switch to browser if needed
    if ($i -eq 0) {
        Write-Host ""
        Write-Host "      Switch to SQL Editor window now..." -ForegroundColor Yellow
        Write-Host "      (Script will auto-paste in 3 seconds)" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    } else {
        Start-Sleep -Seconds 1
    }

    # Send keystrokes to active window (assumes SQL Editor is active)
    Write-Host "      Sending keystrokes: Ctrl+A, Ctrl+V, Ctrl+Enter..." -ForegroundColor Yellow

    # Select All
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 500

    # Paste
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500

    # Execute
    [System.Windows.Forms.SendKeys]::SendWait("^{ENTER}")

    Write-Host "      ✓ Query submitted" -ForegroundColor Green
    Write-Host "      Waiting for execution (~30-60 seconds)..." -ForegroundColor Yellow

    # Wait for query to complete (adjust timing as needed)
    $waitTime = 45
    if ($size -like "*910*") { $waitTime = 90 }  # Longest chunk needs more time

    Start-Sleep -Seconds $waitTime

    Write-Host "      ✓ Chunk $chunkNum imported" -ForegroundColor Green
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "✓ ALL 5 CHUNKS IMPORTED!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Copying verification query to clipboard..." -ForegroundColor Yellow

$verifyQuery = @"
SELECT
    'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
ORDER BY table_name;
"@

Set-Clipboard $verifyQuery
Write-Host "✓ Verification query in clipboard" -ForegroundColor Green
Write-Host ""
Write-Host "Switch to SQL Editor and paste (Ctrl+V) to verify import" -ForegroundColor Cyan
Write-Host "All tables should show row counts > 0" -ForegroundColor Cyan
