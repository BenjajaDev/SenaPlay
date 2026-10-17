// Favicon según el tema antes de que cargue React (misma lógica que
// src/lib/useThemeMode.ts: preferencia guardada o la del sistema).
// Vive en un archivo aparte, y no inline en index.html, para que la CSP de
// public/_headers pueda exigir script-src 'self' sin excepciones.
(function () {
  var stored = null;
  try { stored = localStorage.getItem('senaplay.theme'); } catch (e) {}
  var dark = stored ? stored === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.getElementById('favicon').href = dark ? '/brand/favicon-oscuro.png' : '/brand/favicon-claro.png';
})();
