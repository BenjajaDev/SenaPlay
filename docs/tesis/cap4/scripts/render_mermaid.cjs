// Renderiza cada .mmd de un directorio a PNG (fondo blanco, escala 2) con mermaid en Chromium.
// Uso: node render_mermaid.cjs <mermaid.min.js> <dirMmd> <outDir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const [mermaidJs, dir, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2.5, viewport: { width: 1400, height: 1000 } });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="c" style="display:inline-block;padding:16px;background:#fff"></div></body></html>');
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Arial, sans-serif', flowchart: { htmlLabels: true, wrappingWidth: 320, padding: 18 }, sequence: { mirrorActors: false } }));
  let fail = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mmd')).sort()) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await page.evaluate(async (code) => {
        const { svg } = await window.mermaid.render('d' + Date.now(), code);
        document.getElementById('c').innerHTML = svg;
      }, code);
      await page.locator('#c').screenshot({ path: path.join(out, f.replace('.mmd', '.png')) });
      console.log('ok', f);
    } catch (e) { fail++; console.log('FALLA', f, e.message.split('\n')[0]); }
  }
  await browser.close(); process.exit(fail ? 1 : 0);
})();
