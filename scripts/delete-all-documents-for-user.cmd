@echo off
setlocal EnableExtensions
rem Gleiche Backend-Löschung wie delete-all-documents-for-user.ps1, ohne PowerShell ExecutionPolicy.
cd /d "%~dp0.."
if not exist ".env.local" (
  echo FEHLER: .env.local fehlt im Ordner: %CD%
  exit /b 1
)
if "%~1"=="" (
  echo Verwendung: %~nx0 email@beispiel.de
  exit /b 1
)
call npm.cmd run admin:delete-docs -- %*
exit /b %ERRORLEVEL%
