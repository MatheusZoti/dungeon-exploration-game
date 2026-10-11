// Bundle the game into one self-contained HTML file.
//   node tools/bundle.mjs              -> dist/beneath-tristram.html (full document)
//   node tools/bundle.mjs --fragment   -> dist/beneath-tristram.fragment.html (no html/head/body wrapper)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fragment = process.argv.includes('--fragment');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(src => `// ---- ${src}\n` + readFileSync(join(root, src), 'utf8')).join('\n');
const css = readFileSync(join(root, 'style.css'), 'utf8');

const head = [...html.matchAll(/<(title|link)[^>]*>(?:[^<]*<\/title>)?/g)]
  .map(m => m[0])
  .filter(tag => !tag.includes('style.css'));
const body = html.slice(html.indexOf('<main'), html.indexOf('</main>') + '</main>'.length);
const inline = `${head.join('\n')}\n<style>\n${css}</style>\n${body}\n<script>\n${js.replace(/<\/script/g, '<\\/script')}\n</script>\n`;

const out = fragment
  ? inline
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${inline.replace(body, '</head>\n<body>\n' + body)}</body>\n</html>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
const file = join(root, 'dist', fragment ? 'beneath-tristram.fragment.html' : 'beneath-tristram.html');
writeFileSync(file, out);
console.log(`wrote ${file} (${(out.length / 1024).toFixed(0)} KB)`);
