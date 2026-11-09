@echo off
rem Creates a "Quiz Word" shortcut on the Windows desktop.
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [Quiz Word] Node.js is not installed.
  echo   Install the LTS version from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)
node scripts\launch.mjs --shortcut
pause
