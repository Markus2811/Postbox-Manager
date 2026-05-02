#Requires -Version 5.1
<#
.SYNOPSIS
  Deletes all documents for a user in the backend (Postgres `documents` + Storage bucket `documents`).

.DESCRIPTION
  Runs `npm.cmd run admin:delete-docs`. Required in `postbox-manager\.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Either `SUPABASE_SERVICE_ROLE_KEY` (admin, any auth email)
  - or `POSTBOX_PURGE_EMAIL` (same email as parameter) + `POSTBOX_PURGE_PASSWORD`

.PARAMETER Email
  Email address of the account whose documents are deleted.

.EXAMPLE
  .\scripts\delete-all-documents-for-user.ps1 -Email "markus.greil@hotmail.de"
.EXAMPLE
  .\scripts\delete-all-documents-for-user.ps1 markus.greil@hotmail.de

  If Windows reports script execution is disabled:
  - Use: scripts\delete-all-documents-for-user.cmd markus.greil@hotmail.de
  - Or once: powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\delete-all-documents-for-user.ps1" markus.greil@hotmail.de
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Email
)

$ErrorActionPreference = "Stop"

$Email = $Email.Trim()
if (-not $Email) {
    Write-Error "Email must not be empty."
    exit 1
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env.local"

if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Error "Missing file: $EnvFile - create from .env.example."
    exit 1
}

Push-Location $ProjectRoot
try {
    Write-Host "Project: $ProjectRoot" -ForegroundColor Cyan
    Write-Host "Deleting documents for: $Email" -ForegroundColor Cyan
    Write-Host ""

    # npm.cmd avoids npm.ps1 (ExecutionPolicy / PSSecurityException on Windows)
    & npm.cmd run admin:delete-docs -- $Email
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Host ""
        Write-Error ('admin:delete-docs exited with code ' + $code + '.')
    }
    exit $code
}
finally {
    Pop-Location
}
