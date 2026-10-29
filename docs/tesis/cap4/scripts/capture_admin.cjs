// Captura el panel admin con Supabase interceptado (sesión simulada + datos del catálogo real).
// Uso: node capture_admin.cjs <fixtures.json> <outDir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [fixturesPath, outDir] = process.argv.slice(2);
const fx = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const REF = 'zjpsvtufseqbpfavepap';
const UID = '00000000-0000-4000-8000-000000000001';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp, email: 'admin@demo.senaplay' })}.firma`;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@demo.senaplay', app_metadata: {}, user_metadata: { full_name: 'Administrador demo' }, created_at: '2026-09-24T00:00:00Z' };
const session = { access_token: jwt, refresh_token: 'demo', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

const profiles = [
  { id: UID, email: 'admin@demo.senaplay', full_name: 'Administrador demo', role: 'admin', created_at: '2026-09-24T12:00:00Z' },
  { id: 'u2', email: 'editora@demo.senaplay', full_name: 'Editora de contenido', role: 'editor', created_at: '2026-10-02T12:00:00Z' },
  { id: 'u3', email: 'estudiante1@demo.senaplay', full_name: 'Estudiante 1', role: 'user', created_at: '2026-10-08T12:00:00Z' },
  { id: 'u4', email: 'estudiante2@demo.senaplay', full_name: 'Estudiante 2', role: 'user', created_at: '2026-10-11T12:00:00Z' },
];
const mistakes = [
  { level_id: 3, exercise_key: '3:1', exercise_type: 'multiple-choice', exercise_title: '¿Qué letra representa esta SEÑA?', sign: 'm', mistakes: 9, people: 5, game_overs: 2, top_answer: 'N' },
  { level_id: 4, exercise_key: '4:3', exercise_type: 'typing', exercise_title: 'Escribe la letra correcta para esta SEÑA', sign: 'r', mistakes: 7, people: 4, game_overs: 1, top_answer: 'U' },
  { level_id: 7, exercise_key: '7:2', exercise_type: 'word-meaning', exercise_title: '¿Qué significa esta seña?', sign: null, mistakes: 5, people: 3, game_overs: 0, top_answer: 'Adiós' },
];
const audit = [
  { id: 3, table_name: 'app_config', record_key: 'maintenance', action: 'UPDATE', old_value: { enabled: true }, new_value: { enabled: false }, changed_by: UID, changed_at: '2026-10-20T15:10:00Z' },
  { id: 2, table_name: 'feature_flags', record_key: 'games.dynamicMonitor', action: 'UPDATE', old_value: { enabled: false }, new_value: { enabled: true }, changed_by: UID, changed_at: '2026-10-18T11:00:00Z' },
  { id: 1, table_name: 'app_config', record_key: 'difficulty', action: 'UPDATE', old_value: { aiConfidenceThreshold: 0.55 }, new_value: { aiConfidenceThreshold: 0.6 }, changed_by: UID, changed_at: '2026-10-17T09:30:00Z' },
];
const levelRows = fx.levels.map(({ exercises, ...l }) => ({ ...l, exercises: [{ count: exercises.length }] }));
const tables = {
  levels: levelRows, app_config: fx.app_config, feature_flags: fx.feature_flags, dictionary: fx.dictionary, signs: fx.signs,
  media: [], config_audit: audit, profiles, site_content: [], team_members: [], publications: [],
};

async function route(r) {
  const url = new URL(r.request().url());
  const accept = r.request().headers()['accept'] || '';
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'content-range': '0-0/*' } });
  if (url.pathname.startsWith('/auth/v1/user')) return json(user);
  if (url.pathname.startsWith('/auth/v1')) return json(session);
  if (url.pathname.startsWith('/rest/v1/rpc/mistake_stats')) return json(mistakes);
  if (url.pathname.startsWith('/rest/v1/rpc/public_stats')) return json({ levels: 12, exercises: 90, dictionary: 47, vocabulary: 7, videos: 0, learners: 4 });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
  const table = url.pathname.replace('/rest/v1/', '');
  let rows = tables[table] ?? [];
  if (table === 'levels' && url.searchParams.get('id')) {
    const id = Number(url.searchParams.get('id').replace('eq.', ''));
    rows = fx.levels.filter((l) => l.id === id);
  }
  if (table === 'profiles' && url.searchParams.get('id')) rows = profiles.filter((p) => `eq.${p.id}` === url.searchParams.get('id'));
  if (accept.includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
  return json(rows);
}

(async () => {
  const browser = await chromium.launch();
  for (const theme of ['light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-CL' });
    await ctx.addInitScript(([key, value, t]) => {
      localStorage.setItem(key, value);
      localStorage.setItem('senaplay.theme', t);
    }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
    await ctx.route(/supabase\.co/, route);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    const shots = [
      ['admin-resumen', '/admin'],
      ['admin-niveles', '/admin/levels'],
      ['admin-editor-nivel', '/admin/levels/7'],
      ['admin-config-remota', '/admin/config'],
      ['admin-flags', '/admin/flags'],
      ['admin-usuarios-roles', '/admin/users'],
      ['admin-auditoria', '/admin/audit'],
    ];
    for (const [name, path] of shots) {
      await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${outDir}/${name}-${theme}.png`, fullPage: false });
      console.log('ok', name);
    }
    await ctx.close();
  }
  await browser.close();
})();
