@echo off
rem Launcher for the desktop shortcut. ASCII only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\.config\opencode\scripts\1c-agent.ps1" %*
if errorlevel 1 pause
