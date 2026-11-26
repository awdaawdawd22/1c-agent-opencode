// Проверка index.html: якоря, обязательные блоки, отсутствие внешних зависимостей.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');

const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const missing = anchors.filter((a) => !ids.includes(a));

console.log('размер:', html.length, 'символов');
console.log('заголовок:', /<title>(.*?)<\/title>/.exec(html)[1]);
console.log('разделов h2:', (html.match(/<h2/g) || []).length);
console.log('якорей:', anchors.length, '| id:', ids.length, '| битых:', missing.length ? missing.join(', ') : 'нет');
console.log('внешние ресурсы:', /https?:\/\/[^"' ]+\.(js|css)/.test(html) ? 'есть (плохо)' : 'нет, всё локально');
console.log('скриптов:', (html.match(/<script/g) || []).length);
const required = ['1c-architect', 'cost-report.cjs', 'project/', 'ROUTERAI_API_KEY', '1С-архитектор'];
for (const r of required) console.log(' ', r.padEnd(20), html.includes(r) ? 'OK' : 'НЕТ');
