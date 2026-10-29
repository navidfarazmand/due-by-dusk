// Turns the dist-pc build into one self-contained HTML file (script and styles inline).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir = 'dist-pc', out = 'Due-by-Dusk.html'] = process.argv.slice(2);
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = readdirSync(join(dir, 'assets'));
const js = assets.filter(f => f.endsWith('.js'));
const css = assets.filter(f => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`expected one script chunk, found ${js.length}: ${js.join(', ')}`);
const others = assets.filter(f => !f.endsWith('.js') && !f.endsWith('.css'));
if (others.length) throw new Error(`assets were not inlined: ${others.join(', ')}`);
const script = readFileSync(join(dir, 'assets', js[0]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
html = html.replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/, () => `<script type="module">${script}</script>`);
for (const c of css) {
  const style = readFileSync(join(dir, 'assets', c), 'utf8').replace(/<\/style/gi, '<\\/style');
  html = html.replace(new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`), () => `<style>${style}</style>`);
}
if (/src="\.\/assets\/|href="\.\/assets\//.test(html)) throw new Error('index.html still points at ./assets');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1048576).toFixed(1)} MB)`);
