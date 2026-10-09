@echo off
cd /d "%~dp0"
title PulseTools - Powered by Pulse Studio
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\windows\start.ps1"
echo.
pause
