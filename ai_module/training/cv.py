"""
Particiones de validación agrupadas por signer.

  kfold  StratifiedGroupKFold(n_splits=5, groups=signer_id): cada signer cae
         entero en la prueba de un solo pliegue y las clases quedan
         estratificadas.
  loso   Leave-One-Signer-Out: un pliegue por signer.

Dentro del entrenamiento de cada pliegue se reservan `n_signers_validacion`
signers completos para la detención temprana. Entre los sorteos posibles se
prefiere el que cubre más clases en validación.

`verificar_sin_fuga` falla si un signer aparece en dos particiones del mismo
pliegue. Se llama siempre antes de entrenar.

Las particiones dependen solo de (y, grupos, semilla_particion): son las
mismas para las tres arquitecturas y las tres semillas de entrenamiento.

    python -m training.cv --experimento config/experimentos/comparacion_temporal.yaml [--loso]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass

import numpy as np
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class FugaDeSignersError(AssertionError):
    """Un mismo signer quedó en dos particiones del mismo pliegue."""


@dataclass
class Particion:
    pliegue: int
    entrenamiento: np.ndarray
    validacion: np.ndarray
    prueba: np.ndarray

    def signers(self, grupos: np.ndarray) -> dict[str, list[str]]:
        return {nombre: sorted(set(grupos[idx])) for nombre, idx in
                (("entrenamiento", self.entrenamiento), ("validacion", self.validacion),
                 ("prueba", self.prueba))}


def verificar_sin_fuga(particion: Particion, grupos: np.ndarray) -> None:
    s = {k: set(v) for k, v in particion.signers(grupos).items()}
    for a, b in (("entrenamiento", "validacion"), ("entrenamiento", "prueba"),
                 ("validacion", "prueba")):
        comunes = s[a] & s[b]
        if comunes:
            raise FugaDeSignersError(
                f"Pliegue {particion.pliegue}: signers {sorted(comunes)} en {a} y {b}")
    for nombre, idx in (("entrenamiento", particion.entrenamiento),
                        ("validacion", particion.validacion), ("prueba", particion.prueba)):
        if len(idx) == 0:
            raise ValueError(f"Pliegue {particion.pliegue}: la partición de {nombre} está vacía")


def _separar_validacion(idx_ent: np.ndarray, y: np.ndarray, grupos: np.ndarray, n_val: int,
                        rng: np.random.Generator, intentos: int = 64
                        ) -> tuple[np.ndarray, np.ndarray]:
    signers = np.array(sorted(set(grupos[idx_ent])))
    if len(signers) <= n_val:
        raise ValueError(f"Solo hay {len(signers)} signers de entrenamiento; no se pueden reservar "
                         f"{n_val} para validación")
    mejor, mejor_cobertura = None, -1
    for _ in range(intentos):
        elegidos = set(rng.choice(signers, size=n_val, replace=False))
        cobertura = len(set(y[idx_ent][np.isin(grupos[idx_ent], list(elegidos))]))
        if cobertura > mejor_cobertura:
            mejor, mejor_cobertura = elegidos, cobertura
    en_val = np.isin(grupos[idx_ent], list(mejor))
    return idx_ent[~en_val], idx_ent[en_val]


def generar_particiones(y: np.ndarray, grupos: np.ndarray, cfg_validacion: dict,
                        loso: bool = False) -> list[Particion]:
    esquema = "loso" if loso else cfg_validacion.get("esquema", "kfold")
    semilla = int(cfg_validacion.get("semilla_particion", 42))
    n_val = int(cfg_validacion.get("n_signers_validacion", 3))
    indices = np.arange(len(y))

    if esquema == "kfold":
        n = int(cfg_validacion.get("n_pliegues", 5))
        if len(set(grupos)) < n:
            raise ValueError(f"Hay {len(set(grupos))} signers; no alcanzan para {n} pliegues")
        divisor = StratifiedGroupKFold(n_splits=n, shuffle=True, random_state=semilla)
        cortes = divisor.split(indices, y, grupos)
    elif esquema == "loso":
        cortes = LeaveOneGroupOut().split(indices, y, grupos)
    else:
        raise ValueError(f"Esquema de validación desconocido: {esquema!r}")

    particiones = []
    for pliegue, (idx_ent, idx_prueba) in enumerate(cortes):
        rng = np.random.default_rng(semilla + pliegue)
        idx_ent, idx_val = _separar_validacion(idx_ent, y, grupos, n_val, rng)
        p = Particion(pliegue, np.sort(idx_ent), np.sort(idx_val), np.sort(idx_prueba))
        verificar_sin_fuga(p, grupos)
        particiones.append(p)
    return particiones


def esquema_de(cfg_validacion: dict, loso: bool) -> str:
    return "loso" if loso else cfg_validacion.get("esquema", "kfold")


def guardar_particiones(particiones: list[Particion], grupos: np.ndarray, videos, ruta: str) -> None:
    videos = np.asarray(videos)
    datos = [{
        "pliegue": p.pliegue,
        "signers": p.signers(grupos),
        "videos": {"entrenamiento": videos[p.entrenamiento].tolist(),
                   "validacion": videos[p.validacion].tolist(),
                   "prueba": videos[p.prueba].tolist()},
    } for p in particiones]
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)


def main(argv=None) -> int:
    from common.config import resolver_experimento
    from training.datos import cargar_filas

    parser = argparse.ArgumentParser(description="Muestra y verifica las particiones por signer")
    parser.add_argument("--experimento", default="config/experimentos/comparacion_temporal.yaml")
    parser.add_argument("--loso", action="store_true", help="Leave-One-Signer-Out")
    args = parser.parse_args(argv)

    cfg = resolver_experimento(args.experimento)
    filas, clases = cargar_filas(cfg)
    mapa = {c: i for i, c in enumerate(clases)}
    y = filas["sign_class"].map(mapa).to_numpy()
    grupos = filas["signer_id"].astype(str).to_numpy()
    particiones = generar_particiones(y, grupos, cfg["validacion"], loso=args.loso)

    print(f"Esquema: {esquema_de(cfg['validacion'], args.loso)} | videos: {len(y)} | "
          f"signers: {len(set(grupos))} | clases: {clases}")
    for p in particiones:
        s = p.signers(grupos)
        print(f"  Pliegue {p.pliegue}: entrenamiento {len(p.entrenamiento)} videos "
              f"({len(s['entrenamiento'])} signers) | validación {len(p.validacion)} "
              f"({s['validacion']}) | prueba {len(p.prueba)} ({s['prueba']})")
    print("Sin signers compartidos entre particiones en ningún pliegue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
