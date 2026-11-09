@echo off
rem Quiz Word launcher - double-click to run. Options: start.cmd --help
setlocal
cd /d "%~dp0"
title Quiz Word
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [Quiz Word] Node.js is not installed.
  echo   Install the LTS version from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)
node scripts\launch.mjs %*
if errorlevel 1 pause
