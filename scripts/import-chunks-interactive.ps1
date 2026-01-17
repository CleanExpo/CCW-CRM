# Interactive Data Import Script
# Automates clipboard operations for importing 5 data chunks to Supabase

$chunks = @(
    @{Name="data_chunk_aa"; Size="445 KB"; Number=1},
    @{Name="data_chunk_ab"; Size="512 KB"; Number=2},
    @{Name="data_chunk_ac"; Size="910 KB"; Number=3},
    @{Name="data_chunk_ad"; Size="777 KB"; Number=4},
    @{Name="data_chunk_ae"; Size="481 KB"; Number=5}
)

$backupPath = "C:\CCW-Online ERP\backup"
$sqlEditorUrl = "https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "CCW-Online ERP - Data Import" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will guide you through importing 5 data chunks." -ForegroundColor Yellow
Write-Host "Keep the Supabase SQL Editor open in your browser." -ForegroundColor Yellow
Write-Host ""
Write-Host "SQL Editor: $sqlEditorUrl" -ForegroundColor Green
Write-Host ""

foreach ($chunk in $chunks) {
    Write-Host ""
    Write-Host "-----------------------------------" -ForegroundColor Magenta
    Write-Host "CHUNK $($chunk.Number) of 5: $($chunk.Name) ($($chunk.Size))" -ForegroundColor Magenta
    Write-Host "-----------------------------------" -ForegroundColor Magenta
    Write-Host ""

    # Copy to clipboard
    Write-Host "[1/3] Copying chunk to clipboard..." -ForegroundColor Yellow
    $filePath = Join-Path $backupPath $chunk.Name
    Get-Content $filePath -Raw | Set-Clipboard
    Write-Host "      ✓ Copied to clipboard" -ForegroundColor Green
    Write-Host ""

    # Instructions for user
    Write-Host "[2/3] Now in SQL Editor:" -ForegroundColor Yellow
    Write-Host "      1. Click in the SQL Editor text area" -ForegroundColor White
    Write-Host "      2. Select All (Ctrl+A)" -ForegroundColor White
    Write-Host "      3. Paste (Ctrl+V)" -ForegroundColor White
    Write-Host "      4. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
    Write-Host ""

    # Wait for user confirmation
    Write-Host "[3/3] Waiting for import to complete..." -ForegroundColor Yellow
    Write-Host "      Press ENTER after you see 'Success. No rows returned' message" -ForegroundColor Cyan
    Read-Host

    Write-Host "      ✓ Chunk $($chunk.Number) imported successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "✓ All 5 chunks imported!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Verify data import" -ForegroundColor Yellow
Write-Host ""
Write-Host "Copy this verification query to clipboard? (Y/N)" -ForegroundColor Cyan
$response = Read-Host

if ($response -eq "Y" -or $response -eq "y") {
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
    Write-Host ""
    Write-Host "✓ Verification query copied to clipboard" -ForegroundColor Green
    Write-Host "  Paste and run it in the SQL Editor to verify data import" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Import process complete!" -ForegroundColor Green
