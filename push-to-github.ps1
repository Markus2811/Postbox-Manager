# Pusht dieses Verzeichnis (postbox-manager = Repo-Root) nach GitHub.
# Voraussetzung: Git for Windows installiert, bei erstem Push GitHub-Anmeldung (Browser oder PAT).
# Repo: https://github.com/Markus2811/Postbox-Manager
#
# Ausführen (PowerShell):
#   cd c:\Users\ElenaHaegler\telegram-haushalts-assistent\postbox-manager
#   .\push-to-github.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$remoteUrl = "https://github.com/Markus2811/Postbox-Manager.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "Git wurde nicht gefunden. Bitte installieren:" -ForegroundColor Yellow
    Write-Host "  https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "Danach PowerShell neu starten und dieses Skript erneut ausführen." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

if (-not (git config user.email 2>$null) -or -not (git config user.name 2>$null)) {
    Write-Host ""
    Write-Host "Git Benutzername/E-Mail fehlen (einmalig setzen):" -ForegroundColor Yellow
    Write-Host '  git config --global user.email "deine@email.de"' -ForegroundColor Gray
    Write-Host '  git config --global user.name "Dein Name"' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git add -A
$changes = git status --porcelain
if ($changes) {
    git commit -m "Postbox Manager: initial push for Vercel"
} else {
    Write-Host "Keine neuen Änderungen zum Committen."
}

$hasOrigin = git remote 2>$null | Where-Object { $_ -eq "origin" }
if (-not $hasOrigin) {
    git remote add origin $remoteUrl
} else {
    git remote set-url origin $remoteUrl
}

Write-Host ""
Write-Host "Pushe nach origin main …" -ForegroundColor Cyan
git push -u origin main
Write-Host ""
Write-Host "Fertig. In Vercel: Projekt importieren, Root Directory leer lassen (Repo = App)." -ForegroundColor Green
