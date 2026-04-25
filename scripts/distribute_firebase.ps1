# Distribute .apk / .ipa via Firebase App Distribution
# Usage:
#   .\distribute_firebase.ps1 -File "D:\kibo\kibo-1.0.0.apk" -Testers "alice@x.com,bob@y.com" -Notes "v1.0.0 first build"
# AppId is read from .pgyer-keys.json (firebaseAndroidAppId / firebaseIosAppId).

param(
  [Parameter(Mandatory=$true)][string]$File,
  [string]$AppId,
  [string]$Testers = "",
  [string]$Groups = "",
  [string]$Notes = "Internal build via EAS"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
  Write-Host "File not found: $File" -ForegroundColor Red
  exit 1
}

if (-not $AppId) {
  $keysPath = Join-Path $PSScriptRoot "..\.pgyer-keys.json"
  if (Test-Path $keysPath) {
    $keys = Get-Content $keysPath -Raw | ConvertFrom-Json
    $ext = [System.IO.Path]::GetExtension($File).ToLower()
    if ($ext -eq ".apk") { $AppId = $keys.firebaseAndroidAppId }
    elseif ($ext -eq ".ipa") { $AppId = $keys.firebaseIosAppId }
  }
  if (-not $AppId) {
    Write-Host "No AppId. Pass -AppId or set firebaseAndroidAppId/firebaseIosAppId in .pgyer-keys.json" -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host " Firebase App Distribution" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "File   : $File"
Write-Host "AppId  : $AppId"
Write-Host "Testers: $Testers"
Write-Host "Groups : $Groups"
Write-Host ""

$args = @(
  "appdistribution:distribute",
  $File,
  "--app", $AppId,
  "--release-notes", $Notes
)
if ($Testers) { $args += @("--testers", $Testers) }
if ($Groups) { $args += @("--groups", $Groups) }

& firebase @args
