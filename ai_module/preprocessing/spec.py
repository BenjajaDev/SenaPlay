"""
Especificación del vector de features (`FeatureSpec`).

Es la única fuente de verdad sobre qué landmarks entran al modelo, en qué
orden, cómo se normalizan y qué bloques temporales se calculan. La usan el
entrenamiento, el servidor y la exportación (queda copiada en
`dinamico.meta.json`). El detalle índice a índice está en
`docs/ai/feature_spec.md`, generado con:

    python -m preprocessing.spec --doc > ../docs/ai/feature_spec.md

── Versiones ────────────────────────────────────────────────────────────────
  1.0  Vector legado de `scripts/holistic_pipeline.py` (527 por frame, sin
       bloques temporales). Se reproduce exactamente con `FeatureSpec.v1()`.
  2.0  Mismo orden base que la 1.0, más: subconjunto facial y de pose
       configurables, marco de manos configurable (local | corporal),
       referencia corporal por vecino cuando falta la pose, y bloques de
       velocidad y aceleración opcionales.

── Índices faciales congelados ──────────────────────────────────────────────
El pipeline legado calculaba los índices de la cara al importar el módulo,
desde las constantes de la versión instalada de MediaPipe. Eso hace que una
actualización de MediaPipe pueda cambiar el vector sin aviso. Aquí quedan
escritos a mano (copiados de `FaceLandmarksConnections`) y una prueba
(`tests/test_preprocessing.py`) verifica que siguen coincidiendo con la
versión instalada.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field

FEATURE_SPEC_VERSION = "2.0"

N_MANO = 21
N_POSE_TOTAL = 33
N_CARA_TOTAL = 478
POSE_HOMBRO_IZQ = 11
POSE_HOMBRO_DER = 12
MANO_MUNECA = 0
MANO_BASE_MEDIO = 9

# Grupos de FaceMesh (unión de start/end de FaceLandmarksConnections, ordenados).
GRUPOS_CARA: dict[str, list[int]] = {
    "labios": [0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178,
               181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324,
               375, 402, 405, 409, 415],
    "ojo_izq": [249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466],
    "ojo_der": [7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246],
    "ceja_izq": [276, 282, 283, 285, 293, 295, 296, 300, 334, 336],
    "ceja_der": [46, 52, 53, 55, 63, 65, 66, 70, 105, 107],
    "nariz": [1, 2, 4, 5, 6, 19, 45, 48, 64, 94, 97, 98, 115, 168, 195, 197, 220, 275, 278, 294,
              326, 327, 344, 440],
    "ovalo": [10, 21, 54, 58, 67, 93, 103, 109, 127, 132, 136, 148, 149, 150, 152, 162, 172,
              176, 234, 251, 284, 288, 297, 323, 332, 338, 356, 361, 365, 377, 378, 379, 389,
              397, 400, 454],
}
GRUPOS_CARA_V1 = ["labios", "ojo_izq", "ojo_der", "ceja_izq", "ceja_der", "nariz"]

# Pares izquierda↔derecha del modelo Pose completo (0-32), para el espejado.
PARES_ESPEJO_POSE = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16),
                     (17, 18), (19, 20), (21, 22), (23, 24), (25, 26), (27, 28), (29, 30),
                     (31, 32)]


def indices_cara(grupos: list[str], extra: list[int] | None = None) -> list[int]:
    """Unión ordenada de los grupos faciales pedidos (más índices sueltos opcionales)."""
    desconocidos = [g for g in grupos if g not in GRUPOS_CARA]
    if desconocidos:
        raise ValueError(f"Grupos faciales desconocidos: {desconocidos}. "
                         f"Disponibles: {sorted(GRUPOS_CARA)}")
    indices = set(extra or [])
    for g in grupos:
        indices.update(GRUPOS_CARA[g])
    return sorted(indices)


@dataclass(frozen=True)
class FeatureSpec:
    version: str = FEATURE_SPEC_VERSION
    pose_indices: tuple[int, ...] = tuple(range(17))
    cara_grupos: tuple[str, ...] = tuple(GRUPOS_CARA_V1)
    cara_indices_extra: tuple[int, ...] = ()
    marco_manos: str = "local"            # local | corporal
    referencia_sin_pose: str = "vecino"   # vecino | neutral
    T: int = 30
    posicion: bool = True
    velocidad: bool = True
    aceleracion: bool = True
    extraccion: dict = field(default_factory=lambda: {
        "fps_muestreo": 30, "confianza_deteccion": 0.5, "confianza_landmarks": 0.5,
    })

    def __post_init__(self):
        if self.marco_manos not in ("local", "corporal"):
            raise ValueError(f"marco_manos debe ser 'local' o 'corporal', no {self.marco_manos!r}")
        if self.referencia_sin_pose not in ("vecino", "neutral"):
            raise ValueError("referencia_sin_pose debe ser 'vecino' o 'neutral'")
        if not (self.posicion or self.velocidad or self.aceleracion):
            raise ValueError("Al menos un bloque temporal debe estar activo")
        if self.T < 2:
            raise ValueError("T debe ser >= 2")
        if any(not 0 <= i < N_POSE_TOTAL for i in self.pose_indices):
            raise ValueError("pose_indices fuera de rango 0-32")

    # ── Construcción ──
    @classmethod
    def desde_config(cls, cfg: dict) -> "FeatureSpec":
        partes = cfg.get("partes", {})
        cara = partes.get("cara", {})
        norm = cfg.get("normalizacion", {})
        bloques = cfg.get("bloques_temporales", {})
        return cls(
            version=str(cfg.get("feature_spec_version", FEATURE_SPEC_VERSION)),
            pose_indices=tuple(partes.get("pose_indices", range(17))),
            cara_grupos=tuple(cara.get("grupos", GRUPOS_CARA_V1)),
            cara_indices_extra=tuple(cara.get("indices_extra", []) or []),
            marco_manos=norm.get("marco_manos", "local"),
            referencia_sin_pose=norm.get("referencia_sin_pose", "vecino"),
            T=int(cfg.get("remuestreo", {}).get("T", 30)),
            posicion=bool(bloques.get("posicion", True)),
            velocidad=bool(bloques.get("velocidad", True)),
            aceleracion=bool(bloques.get("aceleracion", True)),
            extraccion=dict(cfg.get("extraccion", {}) or cls().extraccion),
        )

    @classmethod
    def v1(cls, T: int = 60) -> "FeatureSpec":
        """Especificación que reproduce el vector legado (versión 1.0)."""
        return cls(version="1.0", marco_manos="local", referencia_sin_pose="neutral", T=T,
                   posicion=True, velocidad=False, aceleracion=False)

    def a_config(self) -> dict:
        """Forma inversa de `desde_config` (es lo que se guarda en el meta del modelo)."""
        return {
            "feature_spec_version": self.version,
            "extraccion": dict(self.extraccion),
            "partes": {
                "pose_indices": list(self.pose_indices),
                "cara": {"grupos": list(self.cara_grupos),
                         "indices_extra": list(self.cara_indices_extra)},
            },
            "normalizacion": {"marco_manos": self.marco_manos,
                              "referencia_sin_pose": self.referencia_sin_pose},
            "remuestreo": {"T": self.T},
            "bloques_temporales": {"posicion": self.posicion, "velocidad": self.velocidad,
                                   "aceleracion": self.aceleracion},
        }

    # ── Dimensiones y layout ──
    @property
    def cara_indices(self) -> list[int]:
        return indices_cara(list(self.cara_grupos), list(self.cara_indices_extra))

    @property
    def n_pose(self) -> int:
        return len(self.pose_indices)

    @property
    def n_cara(self) -> int:
        return len(self.cara_indices)

    @property
    def dim_base(self) -> int:
        """Largo del vector base por frame (layout de la versión 1.0)."""
        return N_MANO * 3 * 2 + 2 + self.n_pose * 3 + self.n_cara * 3

    @property
    def dim_derivada(self) -> int:
        """Largo de un bloque de velocidad o aceleración (sin los 2 flags de presencia)."""
        return self.dim_base - 2

    @property
    def dim_entrada(self) -> int:
        return (self.dim_base * self.posicion
                + self.dim_derivada * self.velocidad
                + self.dim_derivada * self.aceleracion)

    def layout_base(self) -> list[tuple[str, int, int]]:
        """Segmentos del vector base: (nombre, inicio, fin) con fin exclusivo."""
        segmentos, i = [], 0
        for nombre, largo in (("mano_izq", 63), ("mano_der", 63), ("presencia", 2),
                              ("pose", self.n_pose * 3), ("cara", self.n_cara * 3)):
            segmentos.append((nombre, i, i + largo))
            i += largo
        return segmentos

    def layout(self) -> list[tuple[str, int, int]]:
        """Segmentos del vector de entrada completo, bloque por bloque."""
        segmentos, desplazamiento = [], 0
        for bloque, activo in (("posicion", self.posicion), ("velocidad", self.velocidad),
                               ("aceleracion", self.aceleracion)):
            if not activo:
                continue
            for nombre, ini, fin in self.layout_base():
                if bloque != "posicion" and nombre == "presencia":
                    continue
                largo = fin - ini
                segmentos.append((f"{bloque}.{nombre}", desplazamiento, desplazamiento + largo))
                desplazamiento += largo
        return segmentos

    def es_compatible_v1(self) -> bool:
        """True si un vector legado de 527 valores se puede convertir a esta especificación."""
        return (self.marco_manos == "local"
                and list(self.pose_indices) == list(range(17))
                and self.cara_indices == indices_cara(GRUPOS_CARA_V1))

    def resumen(self) -> dict:
        d = asdict(self)
        d.update(dim_base=self.dim_base, dim_entrada=self.dim_entrada, n_cara=self.n_cara)
        return d


# ── Documentación generada ────────────────────────────────────────────────────

def _doc(spec: FeatureSpec) -> str:
    lineas = [
        "# Especificación del vector de features",
        "",
        f"`feature_spec_version`: **{spec.version}**. Generado con "
        "`python -m preprocessing.spec --doc` desde `config/preprocesamiento/features.yaml`.",
        "",
        "## Versiones",
        "",
        "| Versión | Cambios |",
        "|---|---|",
        "| 1.0 | Vector legado de `scripts/holistic_pipeline.py`: 527 valores por frame, manos en "
        "marco local, marco neutro si falta la pose, sin bloques temporales, T = 60. "
        "Se reproduce con `FeatureSpec.v1()`. |",
        "| 2.0 | Mismo orden base. Agrega: subconjuntos de pose y cara configurables, índices "
        "faciales congelados, marco de manos configurable (`local` o `corporal`), marco por "
        "frame vecino cuando falta la pose, y bloques de velocidad y aceleración. |",
        "",
        "## 1. Vector base por frame",
        "",
        "El orden es el mismo de la versión 1.0 (vector legado de 527 valores). "
        "Cada punto aporta `x, y, z` en ese orden.",
        "",
        "| Segmento | Rango | Largo | Contenido | Normalización |",
        "|---|---|---|---|---|",
    ]
    contenido = {
        "mano_izq": ("21 landmarks de la mano izquierda (de la imagen), índices 0-20 de MediaPipe Hands",
                     "Según `marco_manos`: *local* = origen en la muñeca (0) y escala muñeca→base "
                     "del dedo medio (9); *corporal* = marco de hombros. Ceros si no se detectó."),
        "mano_der": ("21 landmarks de la mano derecha", "Igual que la mano izquierda."),
        "presencia": ("Flags de presencia: [izquierda, derecha]", "1.0 detectada, 0.0 ausente."),
        "pose": (f"Pose, índices {list(spec.pose_indices)}",
                 "Origen en el punto medio entre hombros (11, 12), escala por la distancia "
                 "entre hombros. Ceros si no hay pose."),
        "cara": (f"Cara ({spec.n_cara} puntos): grupos {list(spec.cara_grupos)}",
                 "Mismo marco que la pose. Ceros si no hay cara."),
    }
    for nombre, ini, fin in spec.layout_base():
        texto, norm = contenido[nombre]
        lineas.append(f"| `{nombre}` | [{ini}:{fin}] | {fin - ini} | {texto} | {norm} |")
    lineas += [
        "",
        f"Largo del vector base: **{spec.dim_base}**.",
        "",
        "Si en un frame falta la pose, el marco corporal se toma del frame con pose más cercano "
        "(`referencia_sin_pose: vecino`) o de un marco neutro centrado en la imagen "
        "(`neutral`, comportamiento de la versión 1.0).",
        "",
        "### Índices faciales (orden ascendente)",
        "",
        f"`{spec.cara_indices}`",
        "",
        "## 2. Vector de entrada al modelo",
        "",
        f"Cada secuencia se remuestrea a **T = {spec.T}** frames por interpolación lineal. "
        "Después se concatenan los bloques temporales activos, en este orden:",
        "",
        "| Segmento | Rango | Largo |",
        "|---|---|---|",
    ]
    for nombre, ini, fin in spec.layout():
        lineas.append(f"| `{nombre}` | [{ini}:{fin}] | {fin - ini} |")
    lineas += [
        "",
        f"Largo total por frame: **{spec.dim_entrada}**. Tensor de entrada: `[B, {spec.T}, "
        f"{spec.dim_entrada}]`.",
        "",
        "- **Velocidad**: `v[t] = x[t] − x[t−1]`, con `v[0] = 0`. "
        "Excluye los flags de presencia.",
        "- **Aceleración**: `a[t] = v[t] − v[t−1]`, con `a[0] = 0`.",
        "- Para cada parte (mano, pose, cara), la derivada vale 0 si la parte no está presente "
        "en `t` o en `t−1`, para que la aparición o desaparición de una mano no se lea como "
        "un movimiento brusco.",
        "",
        "## 3. Configuración usada",
        "",
        "```yaml",
    ]
    import yaml
    lineas.append(yaml.safe_dump(spec.a_config(), allow_unicode=True, sort_keys=False).rstrip())
    lineas += ["```", ""]
    return "\n".join(lineas)


if __name__ == "__main__":
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from common.config import cargar_yaml

    parser = argparse.ArgumentParser(description="Muestra o documenta la especificación de features")
    parser.add_argument("--config", default="config/preprocesamiento/features.yaml")
    parser.add_argument("--doc", action="store_true", help="Imprime la documentación en Markdown")
    args = parser.parse_args()

    spec = FeatureSpec.desde_config(cargar_yaml(args.config))
    if args.doc:
        print(_doc(spec))
    else:
        for clave, valor in spec.resumen().items():
            print(f"{clave}: {valor}")
