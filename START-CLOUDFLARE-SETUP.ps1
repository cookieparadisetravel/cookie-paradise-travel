$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\scripts\setup-cloudflare.ps1"
Read-Host "Press Enter to close"
