# Upload .apk / .ipa to pgyer.com
# Usage:
#   .\upload_pgyer.ps1 -File "D:\path\to\kibo.apk"
# Auto reads API key from D:\kibo\.pgyer-keys.json if -ApiKey not provided.

param(
  [Parameter(Mandatory=$true)][string]$File,
  [string]$ApiKey,
  [string]$BuildName = "Kibo",
  [string]$BuildUpdateDescription = "auto upload"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
  Write-Host "File not found: $File" -ForegroundColor Red
  exit 1
}

if (-not $ApiKey) {
  $keysPath = Join-Path $PSScriptRoot "..\.pgyer-keys.json"
  if (Test-Path $keysPath) {
    $keys = Get-Content $keysPath -Raw | ConvertFrom-Json
    $ApiKey = $keys.apiKey
    Write-Host "Loaded API key from .pgyer-keys.json" -ForegroundColor DarkGray
  } else {
    Write-Host "No -ApiKey and .pgyer-keys.json not found." -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host " Pgyer Upload" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "File: $File"
Write-Host ""

$ext = [System.IO.Path]::GetExtension($File).ToLower()
$buildType = if ($ext -eq ".apk") { "android" } elseif ($ext -eq ".ipa") { "ios" } else {
  Write-Host "Unsupported file type: $ext" -ForegroundColor Red; exit 1
}

# --- Step 1: Get COS upload token ---
Write-Host "[1/3] Requesting upload token..." -ForegroundColor Cyan
$tokenForm = @{
  _api_key = $ApiKey
  buildType = $buildType
  buildInstallType = "1"   # 1 = public, 2 = password, 3 = invite
}
$tokenResp = Invoke-RestMethod -Method Post -Uri "https://www.pgyer.com/apiv2/app/getCOSToken" -Body $tokenForm

if ($tokenResp.code -ne 0) {
  Write-Host "Token request failed (code=$($tokenResp.code)): $($tokenResp.message)" -ForegroundColor Red
  exit 1
}

$endpoint = $tokenResp.data.endpoint
$key = $tokenResp.data.params.key
$cosParams = $tokenResp.data.params

# --- Step 2: Upload to COS via multipart ---
Write-Host "[2/3] Uploading $([System.IO.Path]::GetFileName($File)) (this may take 1-3 min)..." -ForegroundColor Cyan

# Use curl.exe (built-in on Windows 10+) for reliable multipart upload of large files.
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) {
  Write-Host "curl.exe not found. Falling back to Invoke-RestMethod (may fail on >100MB files)." -ForegroundColor Yellow

  $boundary = [Guid]::NewGuid().ToString()
  $LF = "`r`n"
  $bodyLines = New-Object System.Collections.ArrayList
  foreach ($p in $cosParams.PSObject.Properties) {
    [void]$bodyLines.Add("--$boundary")
    [void]$bodyLines.Add("Content-Disposition: form-data; name=`"$($p.Name)`"")
    [void]$bodyLines.Add("")
    [void]$bodyLines.Add("$($p.Value)")
  }
  [void]$bodyLines.Add("--$boundary")
  [void]$bodyLines.Add("Content-Disposition: form-data; name=`"file`"; filename=`"$([System.IO.Path]::GetFileName($File))`"")
  [void]$bodyLines.Add("Content-Type: application/octet-stream")
  [void]$bodyLines.Add("")
  $headerStr = ($bodyLines -join $LF) + $LF
  $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headerStr)
  $fileBytes = [System.IO.File]::ReadAllBytes($File)
  $footerBytes = [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
  $allBytes = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
  [Array]::Copy($headerBytes, 0, $allBytes, 0, $headerBytes.Length)
  [Array]::Copy($fileBytes, 0, $allBytes, $headerBytes.Length, $fileBytes.Length)
  [Array]::Copy($footerBytes, 0, $allBytes, $headerBytes.Length + $fileBytes.Length, $footerBytes.Length)

  Invoke-WebRequest -Uri $endpoint -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $allBytes | Out-Null
} else {
  $curlArgs = @("-s", "-S", "-o", "$env:TEMP\pgyer_cos.txt", "-w", "%{http_code}")
  foreach ($p in $cosParams.PSObject.Properties) {
    $curlArgs += "-F"
    $curlArgs += "$($p.Name)=$($p.Value)"
  }
  $curlArgs += "-F"
  $curlArgs += "file=@$File"
  $curlArgs += $endpoint
  $httpCode = & curl.exe @curlArgs
  if ($httpCode -ne "204" -and $httpCode -ne "200") {
    Write-Host "Upload to COS failed (http $httpCode)." -ForegroundColor Red
    Get-Content "$env:TEMP\pgyer_cos.txt" -ErrorAction SilentlyContinue
    exit 1
  }
}

Write-Host "    upload OK"

# --- Step 3: Poll pgyer for build info ---
Write-Host "[3/3] Polling pgyer for build info..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
$installUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  try {
    $info = Invoke-RestMethod -Method Get -Uri "https://www.pgyer.com/apiv2/app/buildInfo?_api_key=$ApiKey&buildKey=$key"
    if ($info.code -eq 0) {
      $installUrl = "https://www.pgyer.com/$($info.data.buildShortcutUrl)"
      break
    }
  } catch {}
  Start-Sleep -Seconds 5
  Write-Host -NoNewline "."
}
Write-Host ""

if ($installUrl) {
  Write-Host ""
  Write-Host "==============================" -ForegroundColor Green
  Write-Host " DONE!" -ForegroundColor Green
  Write-Host "==============================" -ForegroundColor Green
  Write-Host "Install URL : $installUrl"
  Write-Host "QR code     : $installUrl?qr=1"
  Write-Host ""
  Set-Clipboard -Value $installUrl
  Write-Host "(install URL copied to clipboard)" -ForegroundColor DarkGray
} else {
  Write-Host "Timed out polling. Check https://www.pgyer.com/manage/apps directly." -ForegroundColor Yellow
}
