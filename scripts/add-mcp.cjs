// Добавить MCP-сервер в глобальный opencode.json, не задев остальные записи.
// Запуск:
//   node scripts/add-mcp.cjs <имя> -- <команда> [аргументы...]
//   node scripts/add-mcp.cjs <имя> --env K=V -- <команда> [аргументы...]
//   node scripts/add-mcp.cjs <имя> --remove
//   node scripts/add-mcp.cjs --list
"use strict";

const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "opencode.json");

function load() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

// Точечная вставка текста: остальной файл не переформатируется.
function insertOrReplace(original, name, entry) {
  const parsed = JSON.parse(original);
  const block = JSON.stringify({ [name]: entry }, null, 2)
    .split("\n")
    .slice(1, -1)
    .join("\n")
    .split("\n")
    .map((line) => "    " + line)
    .join("\r\n");

  const existing = new RegExp(
    '(\\r?\\n)    "' +
      name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      '"\\s*:\\s*\\{',
  );
  if (existing.test(original)) {
    throw new Error(
      `MCP "${name}" уже есть в конфиге. Сначала удалите: node scripts/add-mcp.cjs ${name} --remove`,
    );
  }

  const anchor = /"mcp"\s*:\s*\{/.exec(original);
  if (!anchor) {
    throw new Error('секция "mcp" не найдена');
  }
  const pos = anchor.index + anchor[0].length;
  const text =
    original.slice(0, pos) + "\r\n" + block + "," + original.slice(pos);

  const check = JSON.parse(text);
  if (!check.mcp[name]) {
    throw new Error("после вставки запись не читается");
  }
  if (Object.keys(parsed.mcp).length + 1 !== Object.keys(check.mcp).length) {
    throw new Error("изменилось число MCP-записей - отмена");
  }
  return text;
}

function removeEntry(original, name) {
  const parsed = JSON.parse(original);
  if (!parsed.mcp[name]) {
    throw new Error(`MCP "${name}" не найден`);
  }
  delete parsed.mcp[name];
  return JSON.stringify(parsed, null, 2);
}

const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  const cfg = load();
  for (const [name, entry] of Object.entries(cfg.mcp || {})) {
    const cmd = entry.url || (entry.command || []).join(" ");
    console.log(
      `${name.padEnd(18)} ${entry.type || "local"}  ${entry.enabled === false ? "[off] " : ""}${cmd}`,
    );
  }
  process.exit(0);
}

const name = argv[0];
if (!name || name.startsWith("-")) {
  console.error(
    "Использование: node scripts/add-mcp.cjs <имя> [--env K=V]... -- <команда> [аргументы...]",
  );
  process.exit(2);
}

const original = fs.readFileSync(configPath, "utf8");
const backup = configPath + ".pre-add-mcp.bak";
if (!fs.existsSync(backup)) {
  fs.copyFileSync(configPath, backup);
}

if (argv[1] === "--remove") {
  fs.writeFileSync(configPath, removeEntry(original, name), "utf8");
  console.log(`удалён: ${name}`);
  process.exit(0);
}

const environment = {};
let i = 1;
while (i < argv.length && argv[i] !== "--") {
  if (argv[i] === "--env") {
    const pair = argv[i + 1] || "";
    const eq = pair.indexOf("=");
    if (eq < 1) {
      console.error(`--env требует K=V, получено: ${pair}`);
      process.exit(2);
    }
    environment[pair.slice(0, eq)] = pair.slice(eq + 1);
    i += 2;
    continue;
  }
  console.error(`неизвестный флаг: ${argv[i]}`);
  process.exit(2);
}
const command = argv.slice(i + 1);
if (i >= argv.length || command.length === 0) {
  console.error('не указана команда запуска после "--"');
  process.exit(2);
}

const entry = { type: "local", enabled: true, command };
if (Object.keys(environment).length > 0) {
  entry.environment = environment;
}

fs.writeFileSync(configPath, insertOrReplace(original, name, entry), "utf8");
console.log(`добавлен: ${name} -> ${command.join(" ")}`);
console.log("не забудьте перезапустить OpenCode");
