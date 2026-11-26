# Скрипт: развернуть рабочую папку в 1С-проекте
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-1c-project.ps1 -ProjectPath "D:\work\my-1c"
# Не перезаписывает существующие файлы: только добавляет недостающие.

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$template = Join-Path (Split-Path -Parent $PSScriptRoot) 'templates\1c-project'
if (-not (Test-Path $template)) {
    throw "не найден шаблон: $template"
}
if (-not (Test-Path $ProjectPath)) {
    New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}

$target = Join-Path $ProjectPath 'project'
$created = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($file in Get-ChildItem -Path $template -Recurse -File) {
    $relative = $file.FullName.Substring($template.Length).TrimStart('\', '/')
    $dest = Join-Path $target $relative
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    if ((Test-Path $dest) -and -not $Force) {
        $skipped.Add($relative)
        continue
    }
    Copy-Item -Path $file.FullName -Destination $dest -Force
    $created.Add($relative)
}

foreach ($dir in @('qa', 'logs', 'dumps')) {
    $path = Join-Path $target $dir
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        $created.Add($dir + '\')
    }
}

# пустые каталоги не переживают git - держим их маркером
foreach ($dir in @('qa', 'logs', 'dumps')) {
    $keep = Join-Path $target "$dir\.gitkeep"
    if (-not (Test-Path $keep)) {
        New-Item -ItemType File -Path $keep -Force | Out-Null
    }
}

Write-Output "проект: $ProjectPath"
Write-Output "папка : $target"
foreach ($item in $created) { Write-Output "  + $item" }
foreach ($item in $skipped) { Write-Output "  = $item (уже есть, не тронут)" }

$previous = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$agents = Join-Path $ProjectPath 'AGENTS.md'
$block = @"
## Рабочая папка проекта
Всё о ходе работы - в `project/`. Перед началом работы прочитай `project/context.md`,
`project/rules.md`, `project/environment.md` и последние 20 строк `project/journal.md`.
После работы допиши `project/journal.md` и обнови `project/taskboard.md`.
Скриншоты - `project/qa/<дата>/`, логи - `project/logs/`, пакеты для человека - `project/manual/`.
"@
if (-not (Test-Path $agents)) {
    Set-Content -Path $agents -Value "# AGENTS.md`r`n`r`n$block" -Encoding UTF8
    Write-Output "  + AGENTS.md (создан с блоком про project/)"
} elseif (-not (Select-String -Path $agents -Pattern 'Рабочая папка проекта' -Quiet)) {
    Add-Content -Path $agents -Value "`r`n$block" -Encoding UTF8
    Write-Output "  + AGENTS.md (дописан блок про project/)"
} else {
    Write-Output "  = AGENTS.md (блок уже есть)"
}
