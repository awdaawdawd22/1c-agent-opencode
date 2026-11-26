# Навык: каталог MCP-серверов и навыков 1С

## Когда применять

Когда для задачи по 1С не хватает инструмента: агент не видит метаданные, не может проверить синтаксис, не умеет кликать в окнах 1С, выдумывает методы платформы. Сначала ищем здесь, только потом в интернете.

Источник каталога: [Untru/1c-mcp](https://github.com/Untru/1c-mcp) - курируемый список MCP, плагинов и навыков для экосистемы 1С (250+ звёзд, обновляется каждую неделю, лицензия CC0). Сверено 2026-11-26.

## Что стоит на этой машине (проверено запуском)

| MCP | Что даёт | Где | Команда запуска |
|---|---|---|---|
| `gyrfalcon` | индекс конфигурации: код, метаданные, граф вызовов, перехваты расширений, семантический поиск | `%LOCALAPPDATA%\1c-mcp-tools\gyrfalcon.exe` (v0.1.25) | `gyrfalcon.exe serve --db <индекс.db> --profile all` |
| `bsl-context` | справка платформы из `shcntx_ru.hbk` + проверка, что метод/перечисление реально существуют | `%LOCALAPPDATA%\1c-mcp-tools\bsl-context\bsl-context-windows-x64\bsl-context-rs.exe` (v0.24.2) | `bsl-context-rs.exe --transport stdio --platform-path "C:\Program Files\1cv8\8.3.27.1989"` (ключ = каталог версии, не `bin`) |
| `playwright`, `chrome-devtools` | браузер (веб-клиент 1С), скриншоты | глобальный `opencode.json` | уже подключены |

Индекс gyrfalcon строится на проект, не глобально:

```
gyrfalcon.exe build "<путь к выгрузке>" --out "<проект>\.opencode\1c-index.db"
```

Пересобрать после большой смены выгрузки; для мелких правок хватает `--auto-update` при запуске `serve`.

## Чего нет, но нужно ставить по задаче

Порядок: каталог -> GitHub -> свой навык. Windows x64, Java на машине нет, поэтому инструменты на JVM - только с установкой рантайма и согласия человека.

| Задача | Кандидат | Репозиторий | Формат | Заметки |
|---|---|---|---|---|
| Живая база: запросы, метаданные, журнал регистрации | 1c-mcp-toolkit | https://github.com/ROCTUP/1c-mcp-toolkit | BSL-обработка + Python | поднимается из `.epf`, без правки конфигурации; **клиентскую/рабочую базу даёт только человек** |
| То же, один бинарник | mcp-1c | https://github.com/feenlace/mcp-1c | Go, stdio | ставит HTTP-сервис расширением |
| Быстрый индекс кода (альтернатива gyrfalcon) | code-index-mcp | https://github.com/Regsorm/code-index-mcp | Rust, релиз `code-index-windows-x64.zip` | 32 инструмента, SQLite |
| Анализ огромных конфигураций (ERP, УХ) | rlm-tools-bsl | https://github.com/Dach-Coin/rlm-tools-bsl | Python, stdio | 60+ хелперов поверх SQLite-индекса, платформа не нужна |
| Синтакс-помощник (альтернатива bsl-context) | mcp-bsl-platform-context | https://github.com/alkoleft/mcp-bsl-platform-context | Kotlin jar | нужен JDK 17 |
| Линтер и 180 диагностик BSL | bsl-analyzer | https://github.com/itrous/bsl-analyzer | Rust, релиз | линтер + LSP + MCP в одном бинарнике |
| Сборка, тесты, синтакс-контроль | mcp-onec-test-runner (METR) | https://github.com/alkoleft/mcp-onec-test-runner | Kotlin jar | YaXUnit, нужно JDK |
| Сборка и ИБ через CLI | v8-runner | https://github.com/alkoleft/v8-runner-rust | Rust | заменяет ручные вызовы `1cv8.exe` |
| Клики в живом интерфейсе 1С | 1C Testpilot | https://github.com/ROCTUP/1c-testpilot | `.epf` + Python | `/TESTCLIENT`, 8.3.27+; ставить из релиза `Testpilot.epf` |
| UI-регрессия | qa-mcp | https://github.com/vlikhobabin/qa-mcp-public | Python | автор пишет, что не стабилен |
| Проверка кода Напарником (ИТС) | 1c-ai-mcp | https://github.com/Desko77/1c-ai-mcp | Python, Docker | нужна подписка ИТС |
| Граф в Neo4j | 1c-mcp-metacode | https://github.com/ROCTUP/1c-mcp-metacode | Python, Neo4j | для командного «гугла» по конфигурации |
| Шаблоны BSL | 1c-templates-mcp | https://yellowmcp.com/servers/1c-templates-mcp | Python, Docker | 2200+ шаблонов |

## Наборы навыков (плагины)

| Набор | Ссылка | Что даёт |
|---|---|---|
| cc-1c-skills | https://github.com/Nikolay-Shirokov/cc-1c-skills | полный цикл для Claude/Cursor/Codex: генерация из компактного описания, «глаза» через веб-клиент |
| claude-code-skills-1c | https://github.com/Desko77/claude-code-skills-1c | 117 навыков, 14 валидаторов, сборка из JSON вместо правки XML |
| ai_rules_1c | https://github.com/comol/ai_rules_1c | уже стоит: `skills/1c-*` (метаданные, валидация, QA, UI, репозиторий) |
| Unica | https://github.com/IngvarConsulting/unica | навыки + свой MCP runtime, ставится из marketplace |
| 1c-ai-dev-env | https://github.com/Pradushkoai/1c-ai-dev-env | окружение разработки для агента |

## Как ставить (глобально)

1. Бинарники: `%LOCALAPPDATA%\1c-mcp-tools\<имя>\`.
2. Запись в `C:\Users\<User>\.config\opencode\opencode.json`, секция `mcp`, через скрипт `node scripts\add-mcp.cjs <ключ> -- <команда ...>` (сохраняет остальные записи, проверяет JSON).
3. Проверка запуском, затем перезапуск OpenCode.
4. Строку в таблицы этого файла - с датой и версией.
