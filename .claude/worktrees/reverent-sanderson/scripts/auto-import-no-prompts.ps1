# Fully Automated Import - No User Prompts
# Assumes SQL Editor is already open and active

Add-Type -AssemblyName System.Windows.Forms

$chunks = @("aa", "ab", "ac", "ad", "ae")
$backupPath = "C:\CCW-Online ERP\backup"

Write-Host "Starting automated import of 5 chunks..." -ForegroundColor Cyan
Write-Host "Make sure SQL Editor is the active window!" -ForegroundColor Yellow
Write-Host "Starting in 5 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

for ($i = 0; $i -lt $chunks.Length; $i++) {
    $chunkName = "data_chunk_$($chunks[$i])"
    $chunkNum = $i + 1

    Write-Host "[$chunkNum/5] Importing $chunkName..." -ForegroundColor Magenta

    # Copy to clipboard
    $filePath = Join-Path $backupPath $chunkName
    $content = Get-Content $filePath -Raw
    Set-Clipboard $content
    Write-Host "  Copied to clipboard" -ForegroundColor Green

    # Wait a moment
    Start-Sleep -Milliseconds 500

    # Select All (Ctrl+A)
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 300

    # Paste (Ctrl+V)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500

    # Execute (Ctrl+Enter)
    [System.Windows.Forms.SendKeys]::SendWait("^{ENTER}")
    Write-Host "  Query executed" -ForegroundColor Green

    # Wait for execution to complete
    $waitTime = 60
    if ($chunkName -eq "data_chunk_ac") { $waitTime = 90 }  # Largest chunk

    Write-Host "  Waiting $waitTime seconds for completion..." -ForegroundColor Yellow
    Start-Sleep -Seconds $waitTime

    Write-Host "  Chunk $chunkNum complete" -ForegroundColor Green
    Write-Host ""
}

Write-Host "All 5 chunks imported!" -ForegroundColor Green
Write-Host "Copying verification query..." -ForegroundColor Yellow

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
Write-Host "Verification query in clipboard - paste and run in SQL Editor" -ForegroundColor Cyan
