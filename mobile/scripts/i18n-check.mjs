// Lists UI text that has no translation yet: every t('…') / tn(n, '…', '…') literal in src/, checked against
// src/i18n/{fr,es,pt,de}.ts. Untranslated text still works (it shows in English), so this only reports.
// Names from data tables (crops, perks, cities…) are passed to t() as variables and are not checked here.
//   node scripts/i18n-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
const LANGS = ['fr', 'es', 'pt', 'de'];
const LIT = String.raw`('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")`;
const unq = lit => {
  const body = lit.slice(1, -1);
  return (lit[0] === "'" ? body.replace(/\\'/g, "'") : body.replace(/\\"/g, '"')).replace(/\\\\/g, '\\');
};

function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'i18n' ? [] : files(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

const keys = new Map();
for (const f of files(SRC)) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(` + LIT, 'g'))) keys.set(unq(m[1]), relative(SRC, f));
  for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*` + LIT + String.raw`\s*,\s*` + LIT, 'g'))) {
    keys.set(unq(m[1]), relative(SRC, f));
    keys.set(unq(m[2]), relative(SRC, f));
  }
}
for (const k of [...keys.keys()]) if (!/[A-Za-z]/.test(k)) keys.delete(k);

let missing = 0;
for (const l of LANGS) {
  const dict = new Set();
  for (const m of readFileSync(join(SRC, 'i18n', l + '.ts'), 'utf8').matchAll(/^\s+("(?:[^"\\]|\\.)*"):/gm)) dict.add(JSON.parse(m[1]));
  const miss = [...keys.keys()].filter(k => !dict.has(k));
  missing += miss.length;
  console.log(`${l}: ${miss.length ? miss.length + ' missing' : 'complete'} (${keys.size} texts)`);
  for (const k of miss) console.log(`   ${JSON.stringify(k)}  (${keys.get(k)})`);
}
process.exitCode = 0;
if (missing) console.log('\nUntranslated text shows in English. Add it to each src/i18n/<lang>.ts.');
