// Отчёт по затратам в рублях по токенам моделей.
// Читает локальную базу OpenCode, ничего никуда не отправляет.
//
//   node scripts/cost-report.cjs                      - всё время, топ сессий
//   node scripts/cost-report.cjs --today              - только сегодня
//   node scripts/cost-report.cjs --session <id>       - одна сессия
//   node scripts/cost-report.cjs --provider <имя>     - только один провайдер
//   node scripts/cost-report.cjs --md                 - markdown для project/journal.md
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const prices = JSON.parse(
  fs.readFileSync(path.join(__dirname, "prices.routerai.json"), "utf8"),
);
const dbPath = path.join(
  process.env.OPENCODE_DB ||
    path.join(os.homedir(), ".local", "share", "opencode"),
  "opencode.db",
);

if (!fs.existsSync(dbPath)) {
  console.error(`не найдена база сессий: ${dbPath}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const onlyToday = flag("--today");
const asMarkdown = flag("--md");
const onlySession = value("--session");
const onlyProvider = value("--provider");

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db
  .prepare(
    `select m.session_id as sid, m.data as data, s.title as title
     from session_message m
     left join session_v2 s on s.id = m.session_id
     where m.type = 'assistant' and m.time_created >= ?
     order by m.time_created desc`,
  )
  .all(onlyToday ? startOfTodayMs() : 0);
db.close();

// id модели в базе может быть как "anthropic/claude-sonnet-5.5", так и коротким алиасом.
function priceFor(modelID) {
  if (prices.models[modelID]) return prices.models[modelID];
  const byTail = Object.entries(prices.models).find(
    ([k]) => k.split("/").pop() === modelID,
  );
  if (byTail) return byTail[1];
  return (prices.aliases || {})[modelID]
    ? prices.models[prices.aliases[modelID]] || null
    : null;
}

const perModel = new Map();
const perSession = new Map();
const unpriced = new Map();

for (const row of rows) {
  if (onlySession && row.sid !== onlySession) continue;

  const msg = JSON.parse(row.data);
  const model = msg.model || {};
  const providerID = model.providerID || "unknown";
  const modelID = model.id || model.modelID || "unknown";
  if (onlyProvider && providerID !== onlyProvider) continue;

  const t = msg.tokens || {};
  const cache = t.cache || {};
  const input = t.input || 0;
  const output = t.output || 0;
  const cacheRead = cache.read || 0;
  const cacheWrite = cache.write || 0;
  if (input + output + cacheRead + cacheWrite === 0) continue;

  const price = priceFor(modelID);
  const id = `${providerID}/${modelID}`;
  const reportedUsd = typeof msg.cost === "number" ? msg.cost : 0;

  if (!price) {
    // у провайдера нет рублёвого прайса - берём его собственную оценку в долларах и переводим по курсу
    if (reportedUsd > 0 && prices.usd_to_rub) {
      const m = perModel.get(id) || {
        name: id + " (курс " + prices.usd_to_rub + " ₽/$, оценка провайдера)",
        calls: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        rub: 0,
        estimated: true,
      };
      m.calls += 1;
      m.input += input;
      m.output += output;
      m.cacheRead += cacheRead;
      m.cacheWrite += cacheWrite;
      m.rub += reportedUsd * prices.usd_to_rub;
      perModel.set(id, m);

      const s = perSession.get(row.sid) || {
        title: row.title || row.sid,
        rub: 0,
        calls: 0,
      };
      s.rub += reportedUsd * prices.usd_to_rub;
      s.calls += 1;
      perSession.set(row.sid, s);
      continue;
    }
    const u = unpriced.get(id) || { calls: 0, tokens: 0 };
    u.calls += 1;
    u.tokens += input + output + cacheRead + cacheWrite;
    unpriced.set(id, u);
    continue;
  }

  const rub =
    (input * (price.input || 0) +
      output * (price.output || 0) +
      cacheRead * (price.cache_read || 0) +
      cacheWrite * (price.cache_write || 0)) /
    prices.per_tokens;

  const m = perModel.get(id) || {
    name: price.name,
    calls: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    rub: 0,
  };
  m.calls += 1;
  m.input += input;
  m.output += output;
  m.cacheRead += cacheRead;
  m.cacheWrite += cacheWrite;
  m.rub += rub;
  perModel.set(id, m);

  const s = perSession.get(row.sid) || {
    title: row.title || row.sid,
    rub: 0,
    calls: 0,
  };
  s.rub += rub;
  s.calls += 1;
  perSession.set(row.sid, s);
}

const models = [...perModel.values()].sort((a, b) => b.rub - a.rub);
const totalRub = models.reduce((a, m) => a + m.rub, 0);
const totalTokens = models.reduce(
  (a, m) => a + m.input + m.output + m.cacheRead + m.cacheWrite,
  0,
);
const totalCalls = models.reduce((a, m) => a + m.calls, 0);

const fmtRub = (v) =>
  (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3)) + " ₽";
const fmtTok = (v) =>
  v >= 1e6
    ? (v / 1e6).toFixed(2) + "M"
    : v >= 1e3
      ? (v / 1e3).toFixed(1) + "k"
      : String(v);

function printUnpriced() {
  if (unpriced.size === 0) return;
  const list = [...unpriced.entries()]
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v.calls} выз., ${fmtTok(v.tokens)} ток.)`)
    .join("; ");
  console.log(
    `\nБез цены и без собственной оценки стоимости (в рубли не вошли): ${list}`,
  );
  console.log(
    "Добавь эти модели в scripts/prices.routerai.json, иначе сумма занижена.",
  );
}

if (asMarkdown) {
  console.log("### Затраты");
  console.log("");
  console.log(
    `Период: ${onlyToday ? "сегодня" : "всё время"}. Цены routerai.ru, за 1 млн токенов, проверено ${prices.checked_at}.`,
  );
  console.log("");
  console.log(
    "| Модель | Вызовов | Вход | Выход | Кэш-чтение | Кэш-запись | Рубли |",
  );
  console.log("|---|---|---|---|---|---|---|");
  for (const m of models) {
    console.log(
      `| ${m.name} | ${m.calls} | ${fmtTok(m.input)} | ${fmtTok(m.output)} | ${fmtTok(m.cacheRead)} | ${fmtTok(m.cacheWrite)} | ${fmtRub(m.rub)} |`,
    );
  }
  console.log(
    `| **Итого** | **${totalCalls}** | | | | ${fmtTok(totalTokens)} ток. | **${fmtRub(totalRub)}** |`,
  );
  printUnpriced();
  process.exit(0);
}

console.log(
  `Период: ${onlyToday ? "сегодня" : "всё время"}${onlySession ? `, сессия ${onlySession}` : ""}${onlyProvider ? `, провайдер ${onlyProvider}` : ""}`,
);
console.log(
  `Цены RouterAI: scripts/prices.routerai.json, проверено ${prices.checked_at}. Прочие провайдеры - их собственная оценка ×${prices.usd_to_rub} ₽/$.\n`,
);
if (models.length === 0) {
  console.log(
    "Нет данных: за период не было вызовов моделей с известной ценой.",
  );
  printUnpriced();
  process.exit(0);
}
for (const m of models) {
  console.log(m.name);
  console.log(
    `  вызовов ${m.calls}, вход ${fmtTok(m.input)}, выход ${fmtTok(m.output)}, кэш-чтение ${fmtTok(m.cacheRead)}, кэш-запись ${fmtTok(m.cacheWrite)}`,
  );
  console.log(`  ${fmtRub(m.rub)}`);
}
console.log(
  `\nИтого: ${totalCalls} вызовов, ${fmtTok(totalTokens)} токенов, ${fmtRub(totalRub)}`,
);

if (!onlySession) {
  const top = [...perSession.values()]
    .sort((a, b) => b.rub - a.rub)
    .slice(0, 5);
  if (top.length > 0) {
    console.log("\nТоп сессий:");
    for (const s of top) {
      console.log(
        `  ${fmtRub(s.rub).padEnd(10)} ${String(s.calls).padStart(4)} выз.  ${String(s.title).slice(0, 70)}`,
      );
    }
  }
}
printUnpriced();
