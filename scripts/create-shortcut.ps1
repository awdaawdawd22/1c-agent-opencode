# Создать ярлык "1С-архитектор" на рабочем столе.
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcut.ps1
# Повторный запуск перезаписывает ярлык.

$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop '1С-архитектор.lnk'
$launcher = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\1c-agent.cmd'

if (-not (Test-Path $launcher)) {
    throw "не найден скрипт запуска: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = $launcher
$link.Arguments = ''
$link.WorkingDirectory = $env:USERPROFILE
$link.IconLocation = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe,0"
$link.Description = 'Запуск агента 1c-architect в OpenCode для проекта 1С'
$link.WindowStyle = 1
$link.Save()

Write-Output "ярлык создан: $shortcutPath"
Write-Output "цель: $launcher"
