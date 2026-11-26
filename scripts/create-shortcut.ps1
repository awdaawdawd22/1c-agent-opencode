# Создать ярлык "1С-архитектор" на рабочем столе.
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcut.ps1
# Повторный запуск перезаписывает ярлык.

$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop '1С-архитектор.lnk'
$script = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\1c-agent.ps1'

if (-not (Test-Path $script)) {
    throw "не найден скрипт запуска: $script"
}

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = (Get-Command powershell.exe).Source
$link.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "{0}"' -f $script
$link.WorkingDirectory = $env:USERPROFILE
$link.IconLocation = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe,0"
$link.Description = 'Запуск агента 1c-architect в OpenCode для проекта 1С'
$link.WindowStyle = 1
$link.Save()

Write-Output "ярлык создан: $shortcutPath"
Write-Output "цель: powershell.exe $($link.Arguments)"
