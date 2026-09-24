#!/usr/bin/env node
/*
 * Valida que todos los diagramas Mermaid de docs/ compilen, usando la
 * librería oficial dentro de Chromium (igual que GitHub al mostrarlos).
 *
 * Requiere `playwright` y `mermaid` resolubles (local o global):
 *   MERMAID_JS=/ruta/a/mermaid.min.js node scripts/checkMermaid.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function load(name) {
  try {
    return require(name);
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, name));
  }
}

const docsDir = path.resolve(__dirname, '../docs');
const blocks = [];
for (const file of fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(docsDir, file), 'utf8');
  for (const match of text.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    const line = text.slice(0, match.index).split('\n').length;
    blocks.push({ file, line, code: match[1] });
  }
}

(async () => {
  const { chromium } = load('playwright');
  const mermaidPath = process.env.MERMAID_JS || require.resolve('mermaid/dist/mermaid.min.js');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: mermaidPath });
  await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false }));

  let failures = 0;
  for (const [index, block] of blocks.entries()) {
    const error = await page.evaluate(async ({ code, id }) => {
      try {
        await window.mermaid.render(`d${id}`, code);
        return null;
      } catch (err) {
        return String(err && err.message ? err.message : err).split('\n').slice(0, 4).join(' | ');
      }
    }, { code: block.code, id: index });
    if (error) {
      failures += 1;
      console.log(`✗ ${block.file}:${block.line} → ${error}`);
    } else {
      console.log(`✓ ${block.file}:${block.line}`);
    }
  }
  await browser.close();
  console.log(`\n${blocks.length - failures}/${blocks.length} diagramas válidos`);
  process.exit(failures ? 1 : 0);
})();
