"""
Aumento de datos sobre landmarks normalizados. Solo se usa en la partición
de entrenamiento de cada pliegue; validación y prueba nunca se aumentan.

Se aumenta "en línea": cada época ve una variante nueva de cada video, con
un generador NumPy sembrado (reproducible para una semilla dada).

  temporal (antes de remuestrear a T):
    time warp   Velocidad local de reproducción variable entre `rango`
                (0,8–1,2 por defecto), interpolada entre `nodos` puntos.
                OJO: un time warp GLOBAL (estirar toda la secuencia por un
                factor) no tiene efecto, porque después se remuestrea a T
                frames de todos modos. El time warp del pipeline legado era
                de ese tipo; este cambia el ritmo DENTRO de la seña.
  espacial (después de remuestrear, una sola elección por secuencia):
    rotación    En el plano XY, ±`max_grados`, alrededor del origen de cada
                marco (muñeca o centro de hombros).
    escala      Factor uniforme en `rango`.
    ruido       Gaussiano con `sigma`, solo sobre partes presentes.
    espejo      Desactivado por defecto: cambia la mano dominante. Si se
                activa: X → −X, intercambio de manos y de pares izq/der de la
                pose. Los puntos de la cara solo se reflejan (no se remapean
                sus índices), igual que en el pipeline legado.
"""

from __future__ import annotations

import numpy as np

from preprocessing.normalization import SecuenciaNormalizada
from preprocessing.resampling import muestrear_en
from preprocessing.spec import PARES_ESPEJO_POSE, FeatureSpec

CONFIG_POR_DEFECTO = {
    "activo": True,
    "time_warp": {"activo": True, "rango": [0.8, 1.2], "nodos": 4},
    "rotacion": {"activo": True, "max_grados": 15.0},
    "escala": {"activo": True, "rango": [0.9, 1.1]},
    "ruido": {"activo": True, "sigma": 0.01},
    "espejo": {"activo": False, "probabilidad": 0.5},
}


def permutacion_espejo_pose(pose_indices: list[int]) -> list[int]:
    """Posiciones dentro del subconjunto de pose tras intercambiar izquierda↔derecha."""
    pareja = {}
    for a, b in PARES_ESPEJO_POSE:
        pareja[a], pareja[b] = b, a
    posicion = {idx: i for i, idx in enumerate(pose_indices)}
    return [posicion.get(pareja.get(idx, idx), i) for i, idx in enumerate(pose_indices)]


def _rotar_xy(puntos: np.ndarray, angulo: float) -> np.ndarray:
    c, s = np.cos(angulo), np.sin(angulo)
    salida = puntos.copy()
    salida[..., 0] = puntos[..., 0] * c - puntos[..., 1] * s
    salida[..., 1] = puntos[..., 0] * s + puntos[..., 1] * c
    return salida


class Aumentador:
    def __init__(self, cfg: dict | None, spec: FeatureSpec):
        from common.config import fusionar

        self.cfg = fusionar(CONFIG_POR_DEFECTO, cfg or {})
        self.spec = spec
        self._perm_pose = permutacion_espejo_pose(list(spec.pose_indices))

    @property
    def activo(self) -> bool:
        return bool(self.cfg["activo"])

    # ── Temporal ──
    def temporal(self, sn: SecuenciaNormalizada, rng: np.random.Generator) -> SecuenciaNormalizada:
        tw = self.cfg["time_warp"]
        largo = len(sn)
        if not (self.activo and tw["activo"]) or largo < 3:
            return sn
        lo, hi = tw["rango"]
        nodos = max(2, int(tw["nodos"]))
        velocidades = rng.uniform(lo, hi, size=nodos)
        # velocidad local en cada intervalo entre frames de salida
        v = np.interp(np.linspace(0, 1, largo - 1), np.linspace(0, 1, nodos), velocidades)
        tiempos = np.concatenate([[0.0], np.cumsum(v)])
        tiempos *= (largo - 1) / tiempos[-1]
        return sn.mapear(lambda a: muestrear_en(a, tiempos))

    # ── Espacial ──
    def espacial(self, sn: SecuenciaNormalizada, rng: np.random.Generator) -> SecuenciaNormalizada:
        if not self.activo:
            return sn
        c = self.cfg
        manos, pose, cara = sn.manos.copy(), sn.pose.copy(), sn.cara.copy()
        pres_manos = sn.presencia_manos.copy()

        if c["rotacion"]["activo"]:
            ang = np.radians(rng.uniform(-c["rotacion"]["max_grados"], c["rotacion"]["max_grados"]))
            manos, pose, cara = _rotar_xy(manos, ang), _rotar_xy(pose, ang), _rotar_xy(cara, ang)

        if c["escala"]["activo"]:
            factor = rng.uniform(*c["escala"]["rango"])
            manos, pose, cara = manos * factor, pose * factor, cara * factor

        if c["ruido"]["activo"] and c["ruido"]["sigma"] > 0:
            sigma = c["ruido"]["sigma"]
            manos += rng.normal(0, sigma, manos.shape) * pres_manos[..., None, None]
            pose += rng.normal(0, sigma, pose.shape) * sn.presencia_pose[:, None, None]
            cara += rng.normal(0, sigma, cara.shape) * sn.presencia_cara[:, None, None]

        if c["espejo"]["activo"] and rng.random() < c["espejo"]["probabilidad"]:
            manos = manos[:, ::-1].copy()
            pres_manos = pres_manos[:, ::-1].copy()
            pose = pose[:, self._perm_pose]
            for arr in (manos, pose, cara):
                arr[..., 0] *= -1

        return sn.con(manos=manos.astype(np.float32), presencia_manos=pres_manos,
                      pose=pose.astype(np.float32), cara=cara.astype(np.float32))
