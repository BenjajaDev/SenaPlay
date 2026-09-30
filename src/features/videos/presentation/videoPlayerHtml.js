/**
 * Página HTML mínima con un <video> nativo del navegador para reproducir los
 * videos DENTRO de la app (en un WebView), sin abrir el navegador externo.
 *
 * Se eligió WebView + HTML5 porque react-native-webview ya está en el dev
 * client: no agrega módulos nativos ni obliga a recompilar. Si más adelante
 * se quiere picture-in-picture o controles nativos, el reemplazo natural es
 * expo-video (requiere una build nueva).
 *
 * Subtítulos: <track> solo entiende WebVTT; si el archivo es SRT se convierte
 * en el momento (cambia «,» por «.» en los tiempos y agrega la cabecera).
 *
 * Mensajes hacia la app (window.ReactNativeWebView.postMessage, JSON):
 *   { type: 'ready', duration } · 'playing' · 'ended' · { type: 'error', code }
 *   'captions' (subtítulos listos) · 'captions-error'
 */

/** Solo enlaces http(s); cualquier otra cosa (javascript:, data:…) se descarta. */
export function safeMediaUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(trimmed) ? trimmed : null;
}

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Origen del video: se usa como baseUrl del WebView para que leer los subtítulos no choque con CORS. */
export function mediaOrigin(url) {
  const match = /^(https?:\/\/[^/]+)/i.exec(url || '');
  return match ? match[1] : undefined;
}

/**
 * @param {{ url: string, captionsUrl?: string|null, posterUrl?: string|null,
 *           background: string, accent: string, autoplay?: boolean }} options
 * @returns {string|null} HTML, o null si la URL del video no es válida.
 */
export function buildVideoHtml({ url, captionsUrl, posterUrl, background, accent, autoplay = true }) {
  const src = safeMediaUrl(url);
  if (!src) return null;
  const captions = safeMediaUrl(captionsUrl);
  const poster = safeMediaUrl(posterUrl);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body { margin: 0; height: 100%; background: ${background}; overflow: hidden; }
  video { width: 100%; height: 100%; display: block; background: ${background}; outline: none; accent-color: ${accent}; }
  video::cue { font-size: 18px; line-height: 1.35; }
</style>
</head>
<body>
<video id="v" controls playsinline${autoplay ? ' autoplay' : ''} preload="metadata"${poster ? ` poster="${escapeAttr(poster)}"` : ''} aria-label="Video">
  <source src="${escapeAttr(src)}" />
</video>
<script>
(function () {
  var video = document.getElementById('v');
  function send(type, extra) {
    try {
      var message = extra || {};
      message.type = type;
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } catch (e) {}
  }
  video.addEventListener('loadedmetadata', function () { send('ready', { duration: video.duration }); });
  video.addEventListener('playing', function () { send('playing'); });
  video.addEventListener('ended', function () { send('ended'); });
  video.addEventListener('error', function () { send('error', { code: video.error ? video.error.code : 0 }); });
  video.querySelector('source').addEventListener('error', function () { send('error', { code: 4 }); });

  var captions = ${JSON.stringify(captions)};
  if (captions) {
    fetch(captions)
      .then(function (response) { if (!response.ok) throw new Error('http'); return response.text(); })
      .then(function (text) {
        var clean = text.replace(/^\\uFEFF/, '').replace(/\\r/g, '');
        var vtt = /^WEBVTT/.test(clean.trim())
          ? clean
          : 'WEBVTT\\n\\n' + clean.replace(/(\\d{2}:\\d{2}:\\d{2}),(\\d{3})/g, '$1.$2');
        var track = document.createElement('track');
        track.kind = 'subtitles';
        track.srclang = 'es';
        track.label = 'Español';
        track.default = true;
        track.src = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        video.appendChild(track);
        var show = function () { if (video.textTracks[0]) video.textTracks[0].mode = 'showing'; };
        track.addEventListener('load', show);
        show();
        send('captions');
      })
      .catch(function () { send('captions-error'); });
  }
})();
</script>
</body>
</html>`;
}
