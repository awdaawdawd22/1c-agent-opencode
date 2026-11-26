#!/usr/bin/env pwsh
# Запуск агента 1c-architect в OpenCode.
# Открывает OpenCode в папке проекта (агент выбирается клавишей Tab в интерфейсе).
# Если путь к проекту не задан - спросит и запомнит его.
<#
    Параметры:
      -ProjectPath <путь>   рабочая папка 1С-проекта
      -Remember             запомнить путь, чтобы больше не спрашивать
      -Init                 только развернуть project/ и выйти

    Запуск из ярлыка: powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "...\scripts\1c-agent.ps1"
#>

param(
    [string]$ProjectPath,
    [switch]$Remember,
    [switch]$Init
)

$ErrorActionPreference = 'Stop'
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$configDir = Join-Path $env:USERPROFILE '.config\opencode'
$stateFile = Join-Path $configDir 'scripts\.1c-agent-state.json'

function Read-State {
    if (Test-Path $stateFile) {
        try {
            return Get-Content -Raw -Encoding UTF8 $stateFile | ConvertFrom-Json
        }
        catch {
            Write-Host "Не читается файл состояния, начинаю с чистого листа." -ForegroundColor Yellow
        }
    }
    return [pscustomobject]@{ project = $null }
}

function Save-State($state) {
    $state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8
}

function Fail($message) {
    Write-Host $message -ForegroundColor Red
    Write-Host ''
    Read-Host 'Нажмите Enter, чтобы закрыть'
    exit 1
}

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    Fail "OpenCode не найден в PATH. Установите: npm install -g opencode-ai"
}

$env:OPENCODE_CONFIG_DIR = $configDir
$state = Read-State

if ($ProjectPath) {
    $ProjectPath = $ProjectPath.Trim().Trim('"').Trim()
    Write-Host "Проект: $ProjectPath" -ForegroundColor DarkGray
}
elseif ($state.project -and (Test-Path $state.project)) {
    $ProjectPath = $state.project
    Write-Host "Проект (запомнен): $ProjectPath" -ForegroundColor DarkGray
    Write-Host 'Нужен другой проект - запустите с параметром -ProjectPath' -ForegroundColor DarkGray
}
else {
    do {
        $answer = Read-Host 'Введите путь к папке 1С-проекта (например D:\work\мой-проект)'
        $ProjectPath = $answer.Trim().Trim('"').Trim()
    } while (-not $ProjectPath)
}

if (-not (Test-Path $ProjectPath)) {
    if ($Init) {
        New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
    }
    else {
        $create = Read-Host "Папки '$ProjectPath' нет. Создать? (y/n)"
        if ($create -eq 'y') {
            New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
        }
        else {
            Fail "Папка не найдена: $ProjectPath"
        }
    }
}

if ($Remember -or $state.project -ne $ProjectPath) {
    Save-State ([pscustomobject]@{ project = $ProjectPath })
}

$projectDir = Join-Path $ProjectPath 'project'
if (-not (Test-Path $projectDir)) {
    Write-Host 'Рабочей папки project/ нет - разворачиваю шаблон...' -ForegroundColor Cyan
    $initScript = Join-Path $configDir 'scripts\init-1c-project.ps1'
    & $initScript -ProjectPath $ProjectPath
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        Fail "Шаблон project/ не развернулся (код $LASTEXITCODE). Скрипт: $initScript"
    }
    if (-not (Test-Path (Join-Path $projectDir 'context.md'))) {
        Fail "После запуска шаблона нет файла $projectDir\context.md - смотрите ошибки выше."
    }
    Write-Host ''
}

if (-not (Test-Path (Join-Path $configDir '.env')) -or
    -not (Select-String -Path (Join-Path $configDir '.env') -Pattern '^ROUTERAI_API_KEY=\S' -Quiet)) {
    Write-Host 'ВНИМАНИЕ: ключ ROUTERAI_API_KEY не задан в .env - модели не ответят.' -ForegroundColor Yellow
    Write-Host "Файл: $(Join-Path $configDir '.env')" -ForegroundColor Yellow
    Write-Host ''
}

Set-Location $ProjectPath

if ($Init) {
    Write-Host "Готово: $ProjectPath\project" -ForegroundColor Green
    exit 0
}

Write-Host 'Запуск OpenCode. В интерфейсе нажмите Tab -> 1c-architect.' -ForegroundColor Green
Write-Host "Затраты: node `"$configDir\scripts\cost-report.cjs`" --today" -ForegroundColor DarkGray
Write-Host ''

opencode

if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Fail "OpenCode завершился с кодом $LASTEXITCODE"
}
