#!/usr/bin/env node
/*
 * Codemod para reorganizar carpetas sin romper imports.
 *
 * Uso: node scripts/moveModules.cjs moves.json
 *   moves.json = { "ruta/vieja.js": "ruta/nueva.js", ... } (relativas a la raíz)
 *
 * 1. Resuelve TODOS los import/require relativos de los .js del proyecto a
 *    rutas absolutas (antes de mover nada).
 * 2. Mueve los archivos con `git mv` (conserva el historial).
 * 3. Reescribe cada especificador relativo apuntando a la nueva ubicación,
 *    tanto en los archivos movidos como en quienes los importan. Los assets
 *    (require de .png/.ttf) también se recalculan si el archivo que los pide
 *    cambió de carpeta.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['node_modules', '.git', 'web', 'ai_module', '.claude', '.expo', 'docs', 'supabase']);
const SPECIFIER_RE = /(\bfrom\s+|\bimport\s+|\brequire\(\s*|\bjest\.mock\(\s*|\bimport\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) out.push(...listJsFiles(path.join(dir, entry.name)));
    } else if (/\.(js|jsx|cjs)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function resolveSpecifier(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

function toSpecifier(fromFile, targetFile, originalSpec) {
  let rel = path.relative(path.dirname(fromFile), targetFile).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const hadExtension = /\.[a-z0-9]+$/i.test(originalSpec);
  const wasIndex = !/index(\.js)?$/.test(originalSpec) && /\/index\.js$/.test(rel);
  if (wasIndex) rel = rel.replace(/\/index\.js$/, '');
  else if (!hadExtension) rel = rel.replace(/\.jsx?$/, '');
  return rel;
}

function main() {
  const movesFile = process.argv[2];
  if (!movesFile) throw new Error('Falta moves.json');
  const rawMoves = JSON.parse(fs.readFileSync(movesFile, 'utf8'));
  const moves = new Map(
    Object.entries(rawMoves).map(([from, to]) => [path.resolve(ROOT, from), path.resolve(ROOT, to)]),
  );

  const files = listJsFiles(ROOT);
  // Fase 1: resolver todo con el árbol original.
  const resolved = new Map();
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const specs = [];
    for (const match of code.matchAll(SPECIFIER_RE)) {
      const target = resolveSpecifier(file, match[3]);
      if (target) specs.push({ spec: match[3], target });
    }
    resolved.set(file, specs);
  }

  // Fase 2: mover.
  for (const [from, to] of moves) {
    if (!fs.existsSync(from)) throw new Error(`No existe: ${from}`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    execFileSync('git', ['mv', from, to], { cwd: ROOT });
  }

  // Fase 3: reescribir.
  let changed = 0;
  for (const [oldFile, specs] of resolved) {
    const newFile = moves.get(oldFile) || oldFile;
    if (!specs.length) continue;
    const bySpec = new Map(specs.map((s) => [s.spec, s.target]));
    const code = fs.readFileSync(newFile, 'utf8');
    const next = code.replace(SPECIFIER_RE, (full, prefix, quote, spec) => {
      const target = bySpec.get(spec);
      if (!target) return full;
      const newTarget = moves.get(target) || target;
      return `${prefix}${quote}${toSpecifier(newFile, newTarget, spec)}${quote}`;
    });
    if (next !== code) {
      fs.writeFileSync(newFile, next);
      changed += 1;
    }
  }
  console.log(`Movidos ${moves.size} archivos; imports actualizados en ${changed} archivos.`);
}

main();
