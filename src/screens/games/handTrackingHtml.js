// HTML del visor de seguimiento de manos (MediaPipe Hands + overlay 2D en canvas).
//
// Vive en su propio módulo porque lo comparten las tres pantallas de cámara:
// práctica de señas, deletreo y traducción en tiempo real. Antes estaba
// incrustado en la pantalla de la mano 3D y no se podía reutilizar sin duplicar
// ~750 líneas de HTML por pantalla.
//
// Antes esto dibujaba un modelo 3D de mano (Three.js) sobre la cámara. Ahora
// dibuja solo los puntos y líneas de AMBAS manos sobre el feed, estilo
// MediaPipe estándar — más liviano y más fácil de leer mientras se hace una
// seña frente a la cámara. La clasificación sigue usando una sola mano (la
// primera detectada), igual que antes; lo que cambió es solo la vista.
//
// Se comunica con React Native por `postMessage` y expone estas funciones
// globales, invocables desde RN con `injectJavaScript`:
//   activarModoLibre()
//   activarModoPractica(landmarks, nombre, instruccion)
//
// Mensajes que emite hacia RN:
//   { tipo:'landmarks',     landmarks, puntuacion?, dedos?, movimiento }
//   { tipo:'sena-dinamica', sena }     ← gesto con movimiento ya resuelto (J/Z)
//   { tipo:'error-camara',  mensaje }

export const HAND_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0F172A; overflow:hidden; width:100vw; height:100vh; }
    #vid {
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      object-fit:cover;
      transform:scaleX(-1);
      opacity:0; transition:opacity 0.6s;
    }
    #vid.active { opacity:1; }
    #overlay { position:absolute; top:0; left:0; display:block; pointer-events:none; }

    /* ── Overlay de estado inferior ── */
    #status {
      position:absolute; bottom:28px; left:0; right:0;
      text-align:center; color:rgba(255,255,255,0.55);
      font:13px/1.4 sans-serif; pointer-events:none;
    }

    /* ── Panel de práctica (aparece cuando teachMode=true) ── */
    #panel-practica {
      display:none;
      position:absolute; top:12px; left:12px; right:12px;
      background:rgba(15,23,42,0.85);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;
      padding:14px 16px 12px;
      backdrop-filter:blur(8px);
      pointer-events:none;
    }
    #panel-practica.visible { display:block; }

    #nombre-seña {
      color:#F1F5F9; font:700 17px sans-serif;
      margin-bottom:4px;
    }
    #instruccion-seña {
      color:rgba(203,213,225,0.75); font:13px sans-serif;
      margin-bottom:10px;
    }

    /* Barra de puntuación global */
    #barra-contenedor {
      background:rgba(255,255,255,0.08);
      border-radius:8px; height:10px; overflow:hidden;
      margin-bottom:8px;
    }
    #barra-progreso {
      height:100%; width:0%; border-radius:8px;
      background:linear-gradient(90deg, #EF4444, #F59E0B, #22C55E);
      background-size:300% 100%;
      transition:width 0.25s ease, background-position 0.25s ease;
    }

    /* Puntuación numérica */
    #texto-puntuacion {
      color:#94A3B8; font:12px sans-serif;
      text-align:right;
    }
    #texto-puntuacion span {
      font-weight:700; font-size:14px;
    }
  </style>
</head>
<body>
  <video id="vid" autoplay playsinline muted></video>
  <canvas id="overlay"></canvas>

  <!-- Panel práctica -->
  <div id="panel-practica">
    <div id="nombre-seña">—</div>
    <div id="instruccion-seña"></div>
    <div id="barra-contenedor">
      <div id="barra-progreso"></div>
    </div>
    <div id="texto-puntuacion">Similitud: <span id="num-puntuacion">0</span>%</div>
  </div>

  <div id="status">Iniciando…</div>

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js" crossorigin="anonymous"><\/script>
  <script>

  // ── 1. Canvas de overlay 2D ──────────────────────────────────────────────────
  const CANVAS = document.getElementById('overlay');
  const CTX = CANVAS.getContext('2d');
  const VID = document.getElementById('vid');
  let W = window.innerWidth, H = window.innerHeight;

  function redimensionarCanvas() {
    W = window.innerWidth; H = window.innerHeight;
    // pixelRatio acotado a 1.5: igual que antes con el renderer 3D, evita
    // cuadruplicar píxeles en pantallas densas (mayor causa de lag en WebView).
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    CANVAS.width = W * dpr;
    CANVAS.height = H * dpr;
    CANVAS.style.width = W + 'px';
    CANVAS.style.height = H + 'px';
    CTX.setTransform(dpr, 0, 0, dpr, 0, 0);
    actualizarRectVideo();
  }

  // El <video> usa object-fit:cover (llena el contenedor sin deformarse,
  // recortando sobrante). Los landmarks de MediaPipe vienen normalizados
  // (0-1) respecto al FRAME del video, no al contenedor — si se mapean
  // directo a W×H, quedan desalineados de la mano cada vez que el aspect
  // ratio del video (ej. 4:3) no coincide con el de la pantalla. Este
  // rectángulo guarda cómo quedó posicionado el video real dentro del
  // contenedor para poder revertir ese "cover" al dibujar.
  let rectVideo = { escala: 1, offsetX: 0, offsetY: 0 };

  function actualizarRectVideo() {
    const vw = VID.videoWidth || 640, vh = VID.videoHeight || 480;
    const escala = Math.max(W / vw, H / vh);
    rectVideo = {
      escala,
      offsetX: (W - vw * escala) / 2,
      offsetY: (H - vh * escala) / 2,
      vw, vh,
    };
  }

  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  // ── 2. Conexiones de la mano (topología estándar de MediaPipe Hands) ────────
  const CN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
  ];

  // Qué dedo es cada hueso/articulación (para colorear feedback por dedo)
  const DEDO_DE_HUESO = [
    'pulgar','pulgar','pulgar','pulgar',
    'indice','indice','indice','indice',
    'medio','medio','medio','medio',
    'anular','anular','anular','anular',
    'menique','menique','menique','menique',
    'palma','palma','palma',
  ];
  const DEDO_DE_JOINT = [
    'muñeca',
    'pulgar','pulgar','pulgar','pulgar',
    'indice','indice','indice','indice',
    'medio','medio','medio','medio',
    'anular','anular','anular','anular',
    'menique','menique','menique','menique',
  ];

  const COLOR_DEFECTO = '#C8845A';
  let coloresHueso = CN.map(() => COLOR_DEFECTO);
  let coloresJoint = new Array(21).fill(COLOR_DEFECTO);

  // ── 3. Colores de feedback por puntuación ────────────────────────────────────
  // Interpola entre rojo (0) → amarillo (0.7) → verde (1.0)
  function puntuacionAColor(p) {
    if (p > 0.88) return '#22C55E';   // verde
    if (p > 0.72) return '#84CC16';   // verde-lima
    if (p > 0.58) return '#F59E0B';   // amarillo
    if (p > 0.42) return '#F97316';   // naranja
    return '#EF4444';                   // rojo
  }

  // ── 4. Dibujo 2D de una mano (puntos + líneas, estilo MediaPipe estándar) ───
  // 'lm' son landmarks crudos de MediaPipe ({x,y,z} en 0-1, normalizados
  // respecto al FRAME del video, no al contenedor). Primero se proyectan a
  // los píxeles donde el video realmente quedó dibujado (rectVideo, que ya
  // tiene en cuenta el recorte de object-fit:cover), y luego se espeja en X
  // para calzar con el CSS scaleX(-1) del <video>.
  function landmarksAPantalla(lm) {
    const { escala, offsetX, offsetY, vw, vh } = rectVideo;
    return lm.map(p => {
      const xDisplay = offsetX + p.x * vw * escala;
      const yDisplay = offsetY + p.y * vh * escala;
      return [W - xDisplay, yDisplay];
    });
  }

  function dibujarConexiones(pts, colorPorHueso, grosor) {
    CTX.lineCap = 'round';
    CN.forEach(([a, b], i) => {
      CTX.strokeStyle = colorPorHueso[i];
      CTX.lineWidth = grosor;
      CTX.beginPath();
      CTX.moveTo(pts[a][0], pts[a][1]);
      CTX.lineTo(pts[b][0], pts[b][1]);
      CTX.stroke();
    });
  }

  function dibujarPuntos(pts, colorPorJoint, radio) {
    pts.forEach(([x, y], i) => {
      CTX.fillStyle = colorPorJoint[i];
      CTX.beginPath();
      CTX.arc(x, y, i === 0 ? radio * 1.3 : radio, 0, Math.PI * 2);
      CTX.fill();
    });
  }

  /** Dibuja una mano detectada (landmarks crudos) con feedback de color opcional. */
  function dibujarManoDetectada(lmCrudos, colorHueso, colorJoint) {
    const pts = landmarksAPantalla(lmCrudos);
    dibujarConexiones(pts, colorHueso, 4);
    dibujarPuntos(pts, colorJoint, 5);
    return pts;
  }

  // Mano de referencia ("fantasma"): se dibuja alineada a la muñeca de la
  // mano real detectada y escalada a su mismo tamaño en pantalla, para poder
  // comparar forma contra forma en vivo (equivalente 2D de la mano fantasma
  // 3D semitransparente que había antes).
  const COLOR_FANTASMA = 'rgba(56,189,248,0.55)';

  function dibujarManoFantasma(formaReferenciaNormalizada, wristPantalla, escalaPantalla) {
    const pts = formaReferenciaNormalizada.map(([dx, dy]) => [
      wristPantalla[0] + dx * escalaPantalla,
      wristPantalla[1] - dy * escalaPantalla,  // ver nota de ejes en normalizarMano/mpAWorld
    ]);
    const coloresFantasma = CN.map(() => COLOR_FANTASMA);
    dibujarConexiones(pts, coloresFantasma, 5);
    pts.forEach(([x, y]) => {
      CTX.fillStyle = COLOR_FANTASMA;
      CTX.beginPath();
      CTX.arc(x, y, 4, 0, Math.PI * 2);
      CTX.fill();
    });
  }

  // ── 5. Lógica de comparación (sin latencia de red) ───────────────────────────
  // Igual que antes: opera en el mismo espacio "world" (mpAWorld) tanto para
  // la mano del usuario como para la referencia, independiente de cómo se
  // dibuje. mpAWorld espeja X y Y, así que en el mapeo a pantalla de la mano
  // fantasma se compensa restando dy en vez de sumarlo (ver dibujarManoFantasma).

  function mpAWorld(mpLm) {
    const S = 3.2;
    return mpLm.map(p => [
      (0.5 - p.x) * S,
      -(p.y - 0.5) * S,
      -p.z * S * 0.35,
    ]);
  }

  function normalizarMano(lm) {
    const muñeca = lm[0];
    const centrado = lm.map(p => [p[0]-muñeca[0], p[1]-muñeca[1], p[2]-muñeca[2]]);
    const palma = centrado[9];
    const escala = Math.sqrt(palma[0]**2 + palma[1]**2 + palma[2]**2);
    if (escala < 1e-6) return centrado;
    return centrado.map(p => [p[0]/escala, p[1]/escala, p[2]/escala]);
  }

  function similitudHueso(u, r, i, j) {
    const va = [u[j][0]-u[i][0], u[j][1]-u[i][1], u[j][2]-u[i][2]];
    const vb = [r[j][0]-r[i][0], r[j][1]-r[i][1], r[j][2]-r[i][2]];
    const na = Math.sqrt(va[0]**2+va[1]**2+va[2]**2);
    const nb = Math.sqrt(vb[0]**2+vb[1]**2+vb[2]**2);
    if (na < 1e-6 || nb < 1e-6) return 1.0;
    const cos = (va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2]) / (na*nb);
    return (Math.max(-1, Math.min(1, cos)) + 1) / 2;
  }

  const HUESOS_DEDOS = {
    pulgar:  [[0,1],[1,2],[2,3],[3,4]],
    indice:  [[0,5],[5,6],[6,7],[7,8]],
    medio:   [[0,9],[9,10],[10,11],[11,12]],
    anular:  [[0,13],[13,14],[14,15],[15,16]],
    menique: [[0,17],[17,18],[18,19],[19,20]],
  };

  function calcularPuntuacion(lmUsuario, lmReferencia) {
    const u = normalizarMano(lmUsuario);
    const r = normalizarMano(lmReferencia);
    const scoresDedo = {};
    const todasSims = [];

    for (const [dedo, huesos] of Object.entries(HUESOS_DEDOS)) {
      const sims = huesos.map(([a, b]) => similitudHueso(u, r, a, b));
      const promedio = sims.reduce((s, v) => s+v, 0) / sims.length;
      scoresDedo[dedo] = promedio;
      todasSims.push(...sims);
    }

    const global = todasSims.reduce((s, v) => s+v, 0) / todasSims.length;
    return { global, dedos: scoresDedo };
  }

  function aplicarColoresFeedback(scoresDedo) {
    const global = Object.values(scoresDedo).reduce((s,v)=>s+v,0) / Object.keys(scoresDedo).length;
    const colorGlobal = puntuacionAColor(global);

    coloresHueso = DEDO_DE_HUESO.map(dedo =>
      dedo === 'palma' ? colorGlobal : puntuacionAColor(scoresDedo[dedo] ?? 1));
    coloresJoint = DEDO_DE_JOINT.map(dedo =>
      dedo === 'muñeca' ? colorGlobal : puntuacionAColor(scoresDedo[dedo] ?? 1));
  }

  function resetearColoresMano() {
    coloresHueso = CN.map(() => COLOR_DEFECTO);
    coloresJoint = new Array(21).fill(COLOR_DEFECTO);
  }

  // ── 6. Estado de la sesión ────────────────────────────────────────────────────
  let landmarksReferencia = null;       // pose objetivo en coords "world" (signs_reference.json)
  let formaReferenciaNormalizada = null; // normalizarMano(landmarksReferencia), cacheada
  let modoEnseñanza = false;

  // ── 6a. Suavizado del dibujo (independiente de la tasa de detección) ────────
  // MediaPipe entrega detecciones a lo sumo a ~30fps (y en un WebView de gama
  // media, bastante menos). Si se dibuja solo cuando llega una detección
  // nueva, el trazo se ve "a saltos" y con retraso respecto al movimiento
  // real de la mano. Por eso el dibujo corre en su propio loop a 60fps
  // (animar(), más abajo) que interpola cada punto hacia el último objetivo
  // detectado — el mismo truco que usaba la mano 3D anterior para verse
  // fluida ("esto es lo que elimina los tirones entre detecciones").
  let objetivoPrincipal = null;    // 21 puntos de PANTALLA de la última detección (mano 0)
  let actualPrincipal = null;      // 21 puntos interpolados que se están dibujando
  let objetivoSecundaria = null;
  let actualSecundaria = null;

  function copiarPuntos(pts) {
    return pts.map(p => [p[0], p[1]]);
  }

  /** Mueve 'actual' hacia 'objetivo' en el sitio. K sube con la distancia
   * recorrida entre detecciones para "alcanzar" movimientos rápidos sin
   * perder el gesto, y baja en movimientos chicos para verse suave. */
  function interpolarPuntos(actual, objetivo) {
    let dist = 0;
    for (let i = 0; i < actual.length; i++) {
      dist += Math.abs(objetivo[i][0] - actual[i][0]) + Math.abs(objetivo[i][1] - actual[i][1]);
    }
    dist /= actual.length;
    const K = Math.min(0.9, 0.35 + dist / 150);
    for (let i = 0; i < actual.length; i++) {
      actual[i][0] += (objetivo[i][0] - actual[i][0]) * K;
      actual[i][1] += (objetivo[i][1] - actual[i][1]) * K;
    }
  }

  // ── 6b. Reconocimiento de señas con MOVIMIENTO (J, Z…) por trayectoria ───────
  // El clasificador estático (servidor) solo ve un frame y no puede distinguir
  // una J de una I (misma forma de mano, distinta trayectoria). Aquí mantenemos
  // un buffer temporal y analizamos el RECORRIDO del dedo que más se mueve.
  //
  // Todo es geometría pura (sin red, sin entrenamiento). Los umbrales están aquí
  // arriba para que se puedan calibrar fácilmente según la LSCh real.
  const CONFIG_MOV = {
    velMovimiento:    0.06,
    velReposo:        0.025,
    duracionMaxMs:    1500,
    duracionMinMs:    400,
    framesQuietosFin: 5,
    minFrames:        6,
    zigzagReversiones: 2,
    zigzagAnchoMin:    0.8,
    ganchoCaidaMin:    0.7,
    ganchoGiroMin:     0.3,
  };

  const PUNTAS = [4, 8, 12, 16, 20];

  const gesto = { activo: false, frames: [], inicio: 0, quietos: 0 };
  let lmPrevio = null;
  let movimientoActivo = false;

  function escalaMano(lm) {
    return Math.hypot(lm[9][0] - lm[0][0], lm[9][1] - lm[0][1], lm[9][2] - lm[0][2]) || 1e-6;
  }

  function velocidad(lmA, lmB) {
    const esc = escalaMano(lmB);
    let s = 0;
    for (const p of PUNTAS) {
      s += Math.hypot(lmB[p][0] - lmA[p][0], lmB[p][1] - lmA[p][1], lmB[p][2] - lmA[p][2]);
    }
    return (s / PUNTAS.length) / esc;
  }

  function trayectoriaDominante(frames) {
    if (frames.length < CONFIG_MOV.minFrames) return null;
    const esc = escalaMano(frames[frames.length - 1]);
    let mejorRec = -1, mejorPath = null;
    for (const p of PUNTAS) {
      const path = frames.map(lm => [(lm[p][0] - lm[0][0]) / esc, -(lm[p][1] - lm[0][1]) / esc]);
      let rec = 0;
      for (let i = 1; i < path.length; i++) {
        rec += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      }
      if (rec > mejorRec) { mejorRec = rec; mejorPath = path; }
    }
    return mejorPath;
  }

  function formaTrayectoria(path) {
    let netX = 0, netY = 0, revX = 0, signoPrev = 0;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dy = path[i][1] - path[i - 1][1];
      netX += dx; netY += dy;
      if (path[i][0] < minX) minX = path[i][0];
      if (path[i][0] > maxX) maxX = path[i][0];
      const s = Math.sign(dx);
      if (Math.abs(dx) > 0.05) {
        if (signoPrev !== 0 && s !== signoPrev) revX++;
        signoPrev = s;
      }
    }
    const anchoX = maxX - minX;

    if (revX >= CONFIG_MOV.zigzagReversiones && anchoX >= CONFIG_MOV.zigzagAnchoMin) return 'Z';
    if (-netY >= CONFIG_MOV.ganchoCaidaMin && Math.abs(netX) >= CONFIG_MOV.ganchoGiroMin) return 'J';
    return null;
  }

  function emitirSenaDinamica(sena) {
    if (sena && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'sena-dinamica', sena }));
    }
  }

  function actualizarGesto(lm) {
    const ahora = Date.now();
    const vel = lmPrevio ? velocidad(lmPrevio, lm) : 0;
    lmPrevio = lm;
    movimientoActivo = vel > CONFIG_MOV.velReposo;

    if (!gesto.activo) {
      if (vel > CONFIG_MOV.velMovimiento) {
        gesto.activo = true;
        gesto.frames = [lm];
        gesto.inicio = ahora;
        gesto.quietos = 0;
      }
      return;
    }

    gesto.frames.push(lm);
    gesto.quietos = vel < CONFIG_MOV.velReposo ? gesto.quietos + 1 : 0;
    const dur = ahora - gesto.inicio;
    const terminoPorQuieto = gesto.quietos >= CONFIG_MOV.framesQuietosFin && dur >= CONFIG_MOV.duracionMinMs;
    const terminoPorTiempo = dur >= CONFIG_MOV.duracionMaxMs;

    if (terminoPorQuieto || terminoPorTiempo) {
      if (dur >= CONFIG_MOV.duracionMinMs) {
        const path = trayectoriaDominante(gesto.frames);
        if (path) emitirSenaDinamica(formaTrayectoria(path));
      }
      gesto.activo = false;
      gesto.frames = [];
      gesto.quietos = 0;
    }
  }

  // ── 7. API de control desde React Native ─────────────────────────────────────

  window.activarModoLibre = function() {
    modoEnseñanza = false;
    landmarksReferencia = null;
    formaReferenciaNormalizada = null;
    document.getElementById('panel-practica').classList.remove('visible');
    resetearColoresMano();
  };

  window.activarModoPractica = function(lmReferencia, nombre, instruccion) {
    modoEnseñanza = true;
    landmarksReferencia = lmReferencia;
    formaReferenciaNormalizada = normalizarMano(lmReferencia);

    document.getElementById('nombre-seña').textContent = nombre || '';
    document.getElementById('instruccion-seña').textContent = instruccion || '';
    document.getElementById('panel-practica').classList.add('visible');
  };

  window.actualizarPuntuacionUI = function(porcentaje) {
    const barra = document.getElementById('barra-progreso');
    const num   = document.getElementById('num-puntuacion');
    barra.style.width = porcentaje + '%';
    const pos = (100 - porcentaje) + '%';
    barra.style.backgroundPosition = pos + ' 0';
    num.textContent = porcentaje;
  };

  // ── 8. MediaPipe Hands ────────────────────────────────────────────────────────
  const STATUS = document.getElementById('status');
  let liveMode = false;
  let mpHands  = null;
  let sending  = false;
  let ultimoEnvio = 0;

  function iniciarMP() {
    mpHands = new Hands({
      locateFile: f => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/\${f}\`,
    });
    mpHands.setOptions({
      // 2 manos: la visualización ahora muestra ambas. La clasificación
      // (estática y la comparación de práctica) sigue usando solo la
      // primera mano detectada, igual que antes — no cambia ese contrato.
      maxNumHands:            2,
      modelComplexity:        1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence:  0.5,
    });
    mpHands.onResults(resultados => {
      const manos = resultados.multiHandLandmarks || [];
      if (manos.length > 0) {
        liveMode = true;
        STATUS.textContent = '';

        // Mano principal (índice 0): la que se clasifica y compara.
        const lmCrudos = manos[0].map(p => [p.x, p.y, p.z]);
        const lmWorld = mpAWorld(manos[0]);

        actualizarGesto(lmCrudos);

        let pct = null;
        let dedos = null;
        if (modoEnseñanza && landmarksReferencia) {
          const resultado = calcularPuntuacion(lmWorld, landmarksReferencia);
          aplicarColoresFeedback(resultado.dedos);
          dedos = resultado.dedos;
          pct = Math.round(resultado.global * 100);
          actualizarPuntuacionUI(pct);
        } else {
          resetearColoresMano();
        }

        // Actualizar el OBJETIVO de dibujo; el loop animar() interpola hacia
        // esto cada frame (ver sección 6a) — no se dibuja acá directamente.
        objetivoPrincipal = landmarksAPantalla(manos[0]);
        actualPrincipal = actualPrincipal ? actualPrincipal : copiarPuntos(objetivoPrincipal);

        if (manos.length > 1) {
          objetivoSecundaria = landmarksAPantalla(manos[1]);
          actualSecundaria = actualSecundaria ? actualSecundaria : copiarPuntos(objetivoSecundaria);
        } else {
          objetivoSecundaria = null;
          actualSecundaria = null;
        }

        // Enviar landmarks CRUDOS a React Native para clasificación estática.
        // Throttle a ~500ms para no saturar el servidor. 'movimiento' permite a
        // RN NO aceptar una letra estática mientras la mano se está moviendo.
        const ahora = Date.now();
        if (window.ReactNativeWebView && ahora - ultimoEnvio > 500) {
          ultimoEnvio = ahora;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            tipo: 'landmarks',
            landmarks: lmCrudos,
            puntuacion: pct,
            dedos: dedos,
            movimiento: movimientoActivo,
          }));
        }
      } else {
        if (liveMode) {
          STATUS.textContent = 'Muestra tu mano a la cámara';
        }
        objetivoPrincipal = null; actualPrincipal = null;
        objetivoSecundaria = null; actualSecundaria = null;
        gesto.activo = false; gesto.frames = []; lmPrevio = null; movimientoActivo = false;
      }
    });
  }

  // ── 8b. Loop de dibujo a 60fps (interpola hacia el último objetivo) ─────────
  const COLORES_NEUTRO_HUESO = CN.map(() => 'rgba(226,232,240,0.85)');
  const COLORES_NEUTRO_JOINT = new Array(21).fill('rgba(226,232,240,0.85)');

  function animar() {
    requestAnimationFrame(animar);
    CTX.clearRect(0, 0, W, H);

    if (objetivoPrincipal && actualPrincipal) {
      interpolarPuntos(actualPrincipal, objetivoPrincipal);
      dibujarConexiones(actualPrincipal, coloresHueso, 4);
      dibujarPuntos(actualPrincipal, coloresJoint, 5);

      if (modoEnseñanza && formaReferenciaNormalizada) {
        const escalaPantalla = Math.hypot(
          actualPrincipal[9][0] - actualPrincipal[0][0],
          actualPrincipal[9][1] - actualPrincipal[0][1],
        );
        dibujarManoFantasma(formaReferenciaNormalizada, actualPrincipal[0], escalaPantalla);
      }
    }

    if (objetivoSecundaria && actualSecundaria) {
      interpolarPuntos(actualSecundaria, objetivoSecundaria);
      dibujarConexiones(actualSecundaria, COLORES_NEUTRO_HUESO, 4);
      dibujarPuntos(actualSecundaria, COLORES_NEUTRO_JOINT, 5);
    }
  }
  animar();

  function reportarError(msg) {
    STATUS.textContent = 'Cámara: ' + msg;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'error-camara', mensaje: msg }));
    }
  }

  async function iniciarCamara() {
    STATUS.textContent = 'Solicitando acceso a la cámara…';
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reportarError('getUserMedia no disponible (contexto no seguro)');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} },
      });
      VID.srcObject = stream;
      await new Promise(resolve => { VID.onloadedmetadata = resolve; });
      VID.play();
      VID.classList.add('active');
      actualizarRectVideo(); // recién ahora VID.videoWidth/Height son los reales
      iniciarMP();
      STATUS.textContent = 'Muestra tu mano a la cámara';

      async function procesarFrame() {
        if (mpHands && VID.readyState >= 2 && !sending) {
          sending = true;
          try { await mpHands.send({ image: VID }); }
          finally { sending = false; }
        }
        setTimeout(() => requestAnimationFrame(procesarFrame), 33);
      }
      procesarFrame();
    } catch (err) {
      reportarError((err && (err.name + ': ' + err.message)) || String(err));
    }
  }

  setTimeout(iniciarCamara, 700);

  <\/script>
</body>
</html>`;
