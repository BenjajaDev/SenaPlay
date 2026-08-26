// HTML del visor de seguimiento de manos (MediaPipe Hands + Three.js).
//
// Vive en su propio módulo porque lo comparten las tres pantallas de cámara:
// práctica de señas, deletreo y traducción en tiempo real. Antes estaba
// incrustado en la pantalla de la mano 3D y no se podía reutilizar sin duplicar
// ~750 líneas de HTML por pantalla.
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
    canvas { position:absolute; top:0; left:0; display:block; }

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
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
  <script>

  // ── 1. Escena Three.js ──────────────────────────────────────────────────────
  const W = window.innerWidth, H = window.innerHeight;
  const scene = new THREE.Scene();
  const CAM   = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
  CAM.position.z = 4;

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(W, H);
  // pixelRatio acotado a 1.5: en pantallas densas (DPR 2-3) renderizar a full
  // resolución cuadruplica los píxeles y es la mayor causa de lag en WebView móvil.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  // Sombras desactivadas: PCFSoftShadowMap es muy costoso en GPU móvil y aquí
  // aporta poco visualmente. Desactivarlas sube notablemente los FPS.
  renderer.shadowMap.enabled = false;
  document.body.appendChild(renderer.domElement);

  // ── 2. Conexiones y radios de huesos ────────────────────────────────────────
  const CN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
  ];

  function boneR(a, b) {
    if ([4,8,12,16,20].includes(b)) return 0.052;
    if ([3,7,11,15,19].includes(b)) return 0.063;
    if ([2,6,10,14,18].includes(b)) return 0.073;
    if ([1,5,9,13,17].includes(b))  return 0.085;
    if (a === 0)                     return 0.092;
    return 0.083;
  }

  const jointR = new Array(21).fill(0);
  CN.forEach(([a, b]) => {
    const r = boneR(a, b);
    jointR[a] = Math.max(jointR[a], r);
    jointR[b] = Math.max(jointR[b], r);
  });

  // ── 3. Colores de feedback por puntuación ────────────────────────────────────
  // Interpola entre rojo (0) → amarillo (0.7) → verde (1.0)
  function puntuacionAColor(p) {
    if (p > 0.88) return 0x22C55E;   // verde
    if (p > 0.72) return 0x84CC16;   // verde-lima
    if (p > 0.58) return 0xF59E0B;   // amarillo
    if (p > 0.42) return 0xF97316;   // naranja
    return 0xEF4444;                   // rojo
  }

  // ── 4. Materiales ─────────────────────────────────────────────────────────────
  // Mano principal: materiales individuales por hueso para colorear el feedback
  const matPiel = new THREE.MeshStandardMaterial({ color:0xC8845A, roughness:0.80, metalness:0.0 });
  const matUña  = new THREE.MeshStandardMaterial({ color:0xEED0C0, roughness:0.28, metalness:0.04 });

  // Un material por hueso (permite cambiar color individualmente)
  const matHuesos = CN.map(() => matPiel.clone());
  const matJoints = Array.from({length:21}, () => matPiel.clone());

  // Mano fantasma: semi-transparente en azul (pose objetivo)
  const matFantasma = new THREE.MeshStandardMaterial({
    color:0x38BDF8, roughness:0.5, metalness:0.0,
    transparent:true, opacity:0.35,
  });

  // ── 5. Construcción de grupos de malla ───────────────────────────────────────
  function construirMano(mats_huesos, mat_joints, mat_palma, mat_uña) {
    const grupo = new THREE.Group();

    // Huesos (cilindros)
    const huesos = CN.map(([a, b], i) => {
      const r = boneR(a, b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 20, 1), mats_huesos[i]);
      m.castShadow = true;
      grupo.add(m);
      return m;
    });

    // Articulaciones (esferas)
    const joints = Array.from({length:21}, (_, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(jointR[i], 20, 20), mat_joints[i]);
      m.castShadow = true;
      grupo.add(m);
      return m;
    });

    // Palma (triángulos actualizables)
    const PALM_TRIS = [[0,1,5],[0,5,9],[0,9,13],[0,13,17]];
    const palmVerts = new Float32Array(PALM_TRIS.length * 6 * 3);
    const palmNorms = new Float32Array(palmVerts.length);
    const palmIdx   = [];
    PALM_TRIS.forEach((_, ti) => {
      const b = ti * 6;
      palmIdx.push(b,b+1,b+2);
      palmIdx.push(b+3,b+5,b+4);
    });
    const palmGeo = new THREE.BufferGeometry();
    palmGeo.setAttribute('position', new THREE.BufferAttribute(palmVerts, 3));
    palmGeo.setAttribute('normal',   new THREE.BufferAttribute(palmNorms, 3));
    palmGeo.setIndex(palmIdx);
    const palmMesh = new THREE.Mesh(palmGeo, mat_palma);
    grupo.add(palmMesh);

    // Uñas
    const nailDefs = [4,8,12,16,20];
    const uñas = nailDefs.map(tipIdx => {
      const r = tipIdx === 4 ? 0.040 : 0.036;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat_uña);
      m.scale.set(1.05, 1.25, 0.26);
      grupo.add(m);
      return { mesh:m, tipIdx };
    });

    return { grupo, huesos, joints, palmVerts, palmNorms, palmGeo, palmMesh, uñas };
  }

  // Mano real (cámara)
  const manoReal = construirMano(matHuesos, matJoints, matPiel, matUña);
  scene.add(manoReal.grupo);

  // Mano fantasma (pose objetivo) — todos sus huesos comparten el mismo material transparente
  const matsFantasmaHuesos = CN.map(() => matFantasma);
  const matsFantasmaJoints = Array.from({length:21}, () => matFantasma);
  const manoFantasma = construirMano(matsFantasmaHuesos, matsFantasmaJoints, matFantasma, matFantasma);
  manoFantasma.grupo.visible = false;
  scene.add(manoFantasma.grupo);

  // ── 6. Función de actualización de malla ────────────────────────────────────
  const UP = new THREE.Vector3(0, 1, 0);
  // Vectores temporales reutilizados: esta función corre a 60fps, así que crear
  // ~70 Vector3 por llamada provocaba pausas de recolección de basura (lag).
  const _vA = new THREE.Vector3(), _vB = new THREE.Vector3();
  const _dir = new THREE.Vector3(), _mid = new THREE.Vector3();
  const _tip = new THREE.Vector3(), _parent = new THREE.Vector3(), _ndir = new THREE.Vector3();

  function actualizarMano(datos, mano) {
    const { huesos, joints, palmVerts, palmNorms, palmGeo, uñas } = mano;

    CN.forEach(([a, b], i) => {
      _vA.set(datos[a][0], datos[a][1], datos[a][2]);
      _vB.set(datos[b][0], datos[b][1], datos[b][2]);
      _dir.subVectors(_vB, _vA);
      const len = _dir.length();
      _dir.normalize();
      huesos[i].position.copy(_mid.addVectors(_vA, _vB).multiplyScalar(0.5));
      huesos[i].quaternion.setFromUnitVectors(UP, len > 0.001 ? _dir : UP);
      huesos[i].scale.y = len;
    });

    joints.forEach((m, i) => m.position.set(...datos[i]));

    const T = 0.05;
    let vi = 0;
    [[0,1,5],[0,5,9],[0,9,13],[0,13,17]].forEach(([a, b, c]) => {
      [a,b,c].forEach(idx => {
        palmVerts[vi]=datos[idx][0]; palmVerts[vi+1]=datos[idx][1]; palmVerts[vi+2]=datos[idx][2]+T;
        palmNorms[vi]=0; palmNorms[vi+1]=0; palmNorms[vi+2]=1;
        vi+=3;
      });
      [a,b,c].forEach(idx => {
        palmVerts[vi]=datos[idx][0]; palmVerts[vi+1]=datos[idx][1]; palmVerts[vi+2]=datos[idx][2]-T;
        palmNorms[vi]=0; palmNorms[vi+1]=0; palmNorms[vi+2]=-1;
        vi+=3;
      });
    });
    palmGeo.attributes.position.needsUpdate = true;
    palmGeo.attributes.normal.needsUpdate   = true;

    uñas.forEach(({ mesh, tipIdx }) => {
      _tip.set(datos[tipIdx][0], datos[tipIdx][1], datos[tipIdx][2]);
      _parent.set(datos[tipIdx-1][0], datos[tipIdx-1][1], datos[tipIdx-1][2]);
      _ndir.subVectors(_tip, _parent).normalize();
      mesh.position.copy(_tip.addScaledVector(_ndir, 0.012));
      mesh.position.z += 0.030;
      mesh.quaternion.setFromUnitVectors(UP, _ndir.lengthSq() > 0 ? _ndir : UP);
    });
  }

  // ── 7. Lógica de comparación en JS (sin latencia de red) ────────────────────

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
    // Colorear huesos de cada dedo según su puntuación
    const dedoAHuesos = [
      ['pulgar',  [0,1,2,3]],
      ['indice',  [4,5,6,7]],
      ['medio',   [8,9,10,11]],
      ['anular',  [12,13,14,15]],
      ['menique', [16,17,18,19]],
    ];

    dedoAHuesos.forEach(([dedo, idxHuesos]) => {
      const score = scoresDedo[dedo] ?? 1;
      const color = puntuacionAColor(score);
      idxHuesos.forEach(i => matHuesos[i].color.setHex(color));
    });

    // Colorear articulaciones según el dedo al que pertenecen
    const lmDeDedo = {
      pulgar:[1,2,3,4], indice:[5,6,7,8], medio:[9,10,11,12],
      anular:[13,14,15,16], menique:[17,18,19,20]
    };
    Object.entries(lmDeDedo).forEach(([dedo, idxLm]) => {
      const score = scoresDedo[dedo] ?? 1;
      const color = puntuacionAColor(score);
      idxLm.forEach(i => matJoints[i].color.setHex(color));
    });

    // La muñeca usa el color global (promedio)
    const global = Object.values(scoresDedo).reduce((s,v)=>s+v,0) / Object.keys(scoresDedo).length;
    matJoints[0].color.setHex(puntuacionAColor(global));
    matPiel.color.setHex(puntuacionAColor(global));
  }

  function resetearColoresMano() {
    matHuesos.forEach(m => m.color.setHex(0xC8845A));
    matJoints.forEach(m => m.color.setHex(0xC8845A));
    matPiel.color.setHex(0xC8845A);  // palma
  }

  // ── 8. Estado de la sesión ────────────────────────────────────────────────────
  const DEMO = [
    [ 0.00, -1.00,  0.00],[-0.30, -0.70,  0.10],[-0.52, -0.42,  0.18],
    [-0.68, -0.18,  0.12],[-0.80,  0.04,  0.06],[-0.22,  0.10,  0.00],
    [-0.22,  0.42,  0.00],[-0.22,  0.68,  0.00],[-0.22,  0.90,  0.00],
    [ 0.00,  0.15,  0.00],[ 0.00,  0.48,  0.00],[ 0.00,  0.76,  0.00],
    [ 0.00,  0.98,  0.00],[ 0.22,  0.10,  0.00],[ 0.22,  0.42,  0.00],
    [ 0.22,  0.66,  0.00],[ 0.22,  0.86,  0.00],[ 0.40,  0.00,  0.00],
    [ 0.44,  0.26,  0.00],[ 0.47,  0.46,  0.00],[ 0.49,  0.62,  0.00],
  ];
  actualizarMano(DEMO, manoReal);

  // landmarksActuales = pose RENDERIZADA (se interpola suavemente cada frame).
  // landmarksObjetivo = última pose DETECTADA por MediaPipe (~15fps).
  // Copia profunda para no mutar DEMO al interpolar in-place.
  let landmarksActuales  = DEMO.map(p => p.slice());
  let landmarksObjetivo  = DEMO.map(p => p.slice());
  let landmarksReferencia = null;
  let modoEnseñanza = false;

  // ── 8b. Reconocimiento de señas con MOVIMIENTO (J, Z…) por trayectoria ───────
  // El clasificador estático (servidor) solo ve un frame y no puede distinguir
  // una J de una I (misma forma de mano, distinta trayectoria). Aquí mantenemos
  // un buffer temporal y analizamos el RECORRIDO del dedo que más se mueve.
  //
  // Todo es geometría pura (sin red, sin entrenamiento). Los umbrales están aquí
  // arriba para que se puedan calibrar fácilmente según la LSCh real.
  const CONFIG_MOV = {
    // ── Detección de inicio/fin del gesto (velocidad por frame, escala de mano) ──
    velMovimiento:    0.06,  // velocidad que DISPARA el inicio de un gesto
    velReposo:        0.025, // por debajo de esto la mano se considera quieta
    duracionMaxMs:    1500,  // ventana máxima que se graba antes de clasificar (1–1.5s)
    duracionMinMs:    400,   // gesto más corto que esto se descarta (fue un temblor)
    framesQuietosFin: 5,     // frames seguidos quietos para dar el gesto por terminado
    minFrames:        6,     // frames mínimos para intentar clasificar la trayectoria
    // ── Clasificación de la forma del trayecto ──
    // Z (zigzag): nº mínimo de reversiones horizontales y recorrido horizontal amplio
    zigzagReversiones: 2,
    zigzagAnchoMin:    0.8,
    // J (gancho): baja y luego gira; descenso vertical mínimo y giro horizontal final
    ganchoCaidaMin:    0.7,
    ganchoGiroMin:     0.3,
  };

  const PUNTAS = [4, 8, 12, 16, 20];          // puntas de pulgar, índice, medio, anular, meñique

  // Estado de la captura de gesto en curso.
  const gesto = { activo: false, frames: [], inicio: 0, quietos: 0 };
  let lmPrevio = null;          // último frame, para medir velocidad instantánea
  let movimientoActivo = false; // true mientras la mano se mueve (bloquea letras estáticas)

  function escalaMano(lm) {
    return Math.hypot(lm[9][0] - lm[0][0], lm[9][1] - lm[0][1], lm[9][2] - lm[0][2]) || 1e-6;
  }

  // Velocidad instantánea = desplazamiento medio de las puntas entre dos frames,
  // normalizado por la escala de la mano (invariante a distancia a la cámara).
  function velocidad(lmA, lmB) {
    const esc = escalaMano(lmB);
    let s = 0;
    for (const p of PUNTAS) {
      s += Math.hypot(lmB[p][0] - lmA[p][0], lmB[p][1] - lmA[p][1], lmB[p][2] - lmA[p][2]);
    }
    return (s / PUNTAS.length) / esc;
  }

  // De una secuencia de frames, elige la punta de mayor recorrido y devuelve su
  // trayectoria 2D normalizada (relativa a la muñeca, escalada, con Y hacia arriba).
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

  // Clasifica una trayectoria 2D (Y hacia arriba) en 'J' | 'Z' | null.
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
      if (Math.abs(dx) > 0.05) {              // ignorar micro-temblores
        if (signoPrev !== 0 && s !== signoPrev) revX++;
        signoPrev = s;
      }
    }
    const anchoX = maxX - minX;

    // Z: varias reversiones horizontales (zigzag) en un trazo ancho
    if (revX >= CONFIG_MOV.zigzagReversiones && anchoX >= CONFIG_MOV.zigzagAnchoMin) return 'Z';
    // J: descenso vertical claro (netY negativo) y un giro horizontal apreciable
    if (-netY >= CONFIG_MOV.ganchoCaidaMin && Math.abs(netX) >= CONFIG_MOV.ganchoGiroMin) return 'J';
    return null;
  }

  // Avisa a React Native cuando un gesto completo se clasificó (evento inmediato,
  // no espera al throttle de los landmarks estáticos).
  function emitirSenaDinamica(sena) {
    if (sena && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'sena-dinamica', sena }));
    }
  }

  // Máquina de estados del gesto: se llama cada frame con los landmarks crudos.
  //  reposo → (velocidad alta) → GRABANDO → (mano quieta o se acabó el tiempo) → clasifica
  function actualizarGesto(lm) {
    const ahora = Date.now();
    const vel = lmPrevio ? velocidad(lmPrevio, lm) : 0;
    lmPrevio = lm;
    movimientoActivo = vel > CONFIG_MOV.velReposo;

    if (!gesto.activo) {
      // Esperando: arranca a grabar cuando la mano empieza a moverse rápido.
      if (vel > CONFIG_MOV.velMovimiento) {
        gesto.activo = true;
        gesto.frames = [lm];
        gesto.inicio = ahora;
        gesto.quietos = 0;
      }
      return;
    }

    // Grabando la ventana del gesto.
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

  // ── 9. API de control desde React Native ────────────────────────────────────
  // React Native llama a estas funciones mediante injectJavaScript()

  window.activarModoLibre = function() {
    modoEnseñanza = false;
    landmarksReferencia = null;
    manoFantasma.grupo.visible = false;
    document.getElementById('panel-practica').classList.remove('visible');
    resetearColoresMano();
  };

  window.activarModoPractica = function(lmReferencia, nombre, instruccion) {
    modoEnseñanza = true;
    landmarksReferencia = lmReferencia;
    manoFantasma.grupo.visible = true;
    actualizarMano(lmReferencia, manoFantasma);

    // Actualizar UI del panel
    document.getElementById('nombre-seña').textContent = nombre || '';
    document.getElementById('instruccion-seña').textContent = instruccion || '';
    document.getElementById('panel-practica').classList.add('visible');
  };

  window.actualizarPuntuacionUI = function(porcentaje) {
    const barra = document.getElementById('barra-progreso');
    const num   = document.getElementById('num-puntuacion');
    barra.style.width = porcentaje + '%';
    // El degradado CSS va de rojo a verde según posición
    const pos = (100 - porcentaje) + '%';
    barra.style.backgroundPosition = pos + ' 0';
    num.textContent = porcentaje;
  };

  // ── 10. Iluminación ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xFFEEDD, 0.55));
  const keyL = new THREE.DirectionalLight(0xFFE8D0, 2.0);
  keyL.position.set(1, 2, 4); keyL.castShadow = true;
  scene.add(keyL);
  const fillL = new THREE.DirectionalLight(0xFFDDCC, 0.65);
  fillL.position.set(-2, 1, 2);
  scene.add(fillL);
  const rimL = new THREE.PointLight(0x38BDF8, 0.9, 8);
  rimL.position.set(0.5, -0.5, -2.5);
  scene.add(rimL);

  // ── 11. Interacción táctil (modo libre, rotación manual) ─────────────────────
  let rotY=0, rotX=0, tRotY=0, tRotX=0;
  let drag=false, autoRot=true, lx=0, ly=0;

  function pDown(x,y) { drag=true; autoRot=false; lx=x; ly=y; }
  function pMove(x,y) {
    if (!drag) return;
    tRotY += (x-lx)*0.012; tRotX += (y-ly)*0.012;
    tRotX = Math.max(-1.2, Math.min(1.2, tRotX));
    lx=x; ly=y;
  }
  function pUp() { drag=false; setTimeout(() => { autoRot=true; }, 2500); }

  const cv = renderer.domElement;
  cv.addEventListener('mousedown',  e => pDown(e.clientX, e.clientY));
  cv.addEventListener('mousemove',  e => pMove(e.clientX, e.clientY));
  cv.addEventListener('mouseup',    pUp);
  cv.addEventListener('touchstart', e => { e.preventDefault(); pDown(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
  cv.addEventListener('touchmove',  e => { e.preventDefault(); pMove(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
  cv.addEventListener('touchend',   pUp);

  // ── 12. MediaPipe Hands ───────────────────────────────────────────────────────
  const STATUS = document.getElementById('status');
  const VID    = document.getElementById('vid');
  let liveMode = false;
  let mpHands  = null;
  let sending  = false;
  let ultimoEnvio = 0;   // throttle para no saturar el servidor IA

  // Convierte landmarks de MediaPipe (objetos {x,y,z} en rango 0-1) a Three.js world
  function mpAWorld(mpLm) {
    const S = 3.2;
    return mpLm.map(p => [
      (0.5 - p.x) * S,
      -(p.y - 0.5) * S,
      -p.z * S * 0.35,
    ]);
  }

  function iniciarMP() {
    mpHands = new Hands({
      locateFile: f => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/\${f}\`,
    });
    mpHands.setOptions({
      maxNumHands:            1,
      // Modelo completo: rastrea mucho mejor la rotación y la oclusión de dedos.
      // La fluidez la da la interpolación a 60fps, no rebajar el modelo, así que
      // recuperamos precisión de landmarks (clave para la clasificación) sin lag.
      modelComplexity:        1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence:  0.5,
    });
    mpHands.onResults(resultados => {
      if (resultados.multiHandLandmarks && resultados.multiHandLandmarks.length > 0) {
        const lmWorld = mpAWorld(resultados.multiHandLandmarks[0]);
        // Crudos de MediaPipe (x,y,z ~0-1): es el formato que espera el clasificador IA.
        const lmCrudos = resultados.multiHandLandmarks[0].map(p => [p.x, p.y, p.z]);
        // Solo fijamos el objetivo; el loop de animación interpola hacia él a 60fps
        // (esto es lo que elimina los tirones entre detecciones de MediaPipe).
        landmarksObjetivo = lmWorld;
        liveMode = true;
        STATUS.textContent = '';

        // Máquina de estados del gesto: graba la ventana completa de una seña con
        // movimiento (~1–1.5s) y, al terminarla, emite 'sena-dinamica' (evento propio).
        actualizarGesto(lmCrudos);

        // En modo práctica: feedback geométrico (colores + similitud)
        let pct = null;
        let dedos = null;   // desglose por dedo, lo usa RN para decir cuál corregir
        if (modoEnseñanza && landmarksReferencia) {
          const resultado = calcularPuntuacion(lmWorld, landmarksReferencia);
          aplicarColoresFeedback(resultado.dedos);
          dedos = resultado.dedos;
          pct = Math.round(resultado.global * 100);
          actualizarPuntuacionUI(pct);
        }

        // Enviar landmarks CRUDOS a React Native para clasificación estática con la IA.
        // Throttle a ~500ms para no saturar el servidor. 'movimiento' permite a RN
        // NO aceptar una letra estática mientras la mano se está moviendo.
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
          if (modoEnseñanza) resetearColoresMano();
        }
        // Sin mano: cancelar cualquier gesto en curso para no detectar movimiento fantasma.
        gesto.activo = false; gesto.frames = []; lmPrevio = null; movimientoActivo = false;
      }
    });
  }

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
      iniciarMP();
      STATUS.textContent = 'Muestra tu mano a la cámara';

      async function procesarFrame() {
        if (mpHands && VID.readyState >= 2 && !sending) {
          sending = true;
          try { await mpHands.send({ image: VID }); }
          finally { sending = false; }
        }
        // Apuntamos a ~30fps de detección; el guard !sending hace que cada equipo
        // corra a lo que su CPU aguante (más muestras = mejor seguimiento rápido).
        setTimeout(() => requestAnimationFrame(procesarFrame), 33);
      }
      procesarFrame();
    } catch (err) {
      reportarError((err && (err.name + ': ' + err.message)) || String(err));
    }
  }

  setTimeout(iniciarCamara, 700);

  // ── 13. Loop de animación ─────────────────────────────────────────────────────
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.011;

    if (!liveMode) {
      if (autoRot && !drag) {
        tRotY = Math.sin(t * 0.42) * 0.32;
        tRotX = Math.sin(t * 0.28) * 0.06 - 0.03;
      }
      rotY += (tRotY - rotY) * 0.10;
      rotX += (tRotX - rotX) * 0.10;
      manoReal.grupo.rotation.y = rotY;
      manoReal.grupo.rotation.x = rotX;
      if (modoEnseñanza) {
        manoFantasma.grupo.rotation.y = rotY;
        manoFantasma.grupo.rotation.x = rotX;
      }
    } else {
      manoReal.grupo.rotation.set(0, 0, 0);
      manoFantasma.grupo.rotation.set(0, 0, 0);

      // Interpolación ADAPTATIVA hacia la última pose detectada.
      // Mide cuánto se alejó la mano del objetivo: en movimientos amplios (girar
      // la mano) sube el factor K para "alcanzarla" y seguir TODO el recorrido sin
      // rubber-band; en movimientos pequeños baja K para quedar suave. Resultado:
      // fluido cuando está quieta, pero sin perder el gesto cuando se mueve rápido.
      let dist = 0;
      for (let i = 0; i < 21; i++) {
        const a = landmarksActuales[i], o = landmarksObjetivo[i];
        dist += Math.abs(o[0]-a[0]) + Math.abs(o[1]-a[1]) + Math.abs(o[2]-a[2]);
      }
      dist /= 21;
      const K = Math.min(0.85, 0.4 + dist * 1.2);
      for (let i = 0; i < 21; i++) {
        const a = landmarksActuales[i], o = landmarksObjetivo[i];
        a[0] += (o[0] - a[0]) * K;
        a[1] += (o[1] - a[1]) * K;
        a[2] += (o[2] - a[2]) * K;
      }
      actualizarMano(landmarksActuales, manoReal);
    }

    rimL.intensity = 0.7 + Math.sin(t * 2) * 0.22;
    renderer.render(scene, CAM);
  }
  animate();

  window.addEventListener('resize', () => {
    const W = window.innerWidth, H = window.innerHeight;
    CAM.aspect = W / H;
    CAM.updateProjectionMatrix();
    renderer.setSize(W, H);
  });

  <\/script>
</body>
</html>`;
