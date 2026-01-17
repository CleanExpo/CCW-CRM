@echo off
setlocal enabledelayedexpansion

echo =========================================
echo CCW-Online ERP - Data Import Automation
echo =========================================
echo.
echo This script will import all 5 data chunks.
echo Make sure the Supabase SQL Editor is open in your browser.
echo.
echo SQL Editor: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql
echo.
echo Press any key when ready, or Ctrl+C to cancel...
pause >nul

cd /d "C:\CCW-Online ERP\backup"

set chunks=aa ab ac ad ae
set sizes=445KB 512KB 910KB 777KB 481KB

set count=1
for %%c in (%chunks%) do (
    echo.
    echo [!count!/5] Importing data_chunk_%%c...

    rem Copy to clipboard using PowerShell
    powershell -Command "Get-Content 'data_chunk_%%c' -Raw | Set-Clipboard" >nul 2>&1
    echo     - Chunk copied to clipboard

    echo     - Switch to SQL Editor window and:
    echo        1. Press Ctrl+A ^(Select All^)
    echo        2. Press Ctrl+V ^(Paste^)
    echo        3. Press Ctrl+Enter ^(Execute^)
    echo        4. Wait for 'Success' message
    echo.
    echo Press any key after chunk !count! import completes...
    pause >nul

    echo     - Chunk !count! imported successfully
    set /a count+=1
)

echo.
echo =========================================
echo All 5 chunks imported successfully!
echo =========================================
echo.
echo Copying verification query to clipboard...

powershell -Command "Set-Clipboard 'SELECT ''organizations'' as table_name, COUNT(*) as row_count FROM organizations UNION ALL SELECT ''users'', COUNT(*) FROM users UNION ALL SELECT ''products'', COUNT(*) FROM products UNION ALL SELECT ''customers'', COUNT(*) FROM customers UNION ALL SELECT ''orders'', COUNT(*) FROM orders UNION ALL SELECT ''quotes'', COUNT(*) FROM quotes ORDER BY table_name;'" >nul 2>&1

echo Verification query ready in clipboard.
echo Paste it in SQL Editor to verify all tables have data.
echo.
pause
