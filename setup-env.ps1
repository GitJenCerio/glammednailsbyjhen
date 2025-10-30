# PowerShell script to create .env.local file from .env.example
# Run this script: .\setup-env.ps1

Write-Host "Creating .env.local file from .env.example..." -ForegroundColor Green

if (Test-Path .env.example) {
    Copy-Item .env.example .env.local
    Write-Host "✓ Created .env.local file" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Now you need to:" -ForegroundColor Yellow
    Write-Host "1. Get your Firebase credentials from https://console.firebase.google.com/" -ForegroundColor Yellow
    Write-Host "2. Open .env.local and replace the placeholder values" -ForegroundColor Yellow
    Write-Host "3. Restart your dev server" -ForegroundColor Yellow
} else {
    Write-Host "✗ Error: .env.example file not found!" -ForegroundColor Red
    Write-Host "Please create .env.example first" -ForegroundColor Red
}

