# Import Single Chunk
param(
    [Parameter(Mandatory=$true)]
    [string]$ChunkName
)

$backupPath = "C:\CCW-Online ERP\backup"
$filePath = Join-Path $backupPath $ChunkName

if (-not (Test-Path $filePath)) {
    Write-Error "Chunk file not found: $filePath"
    exit 1
}

Write-Host "Copying $ChunkName to clipboard..." -ForegroundColor Yellow
Get-Content $filePath -Raw | Set-Clipboard
Write-Host "Ready to paste in SQL Editor" -ForegroundColor Green
Write-Host "File size: $((Get-Item $filePath).Length / 1KB) KB" -ForegroundColor Cyan
