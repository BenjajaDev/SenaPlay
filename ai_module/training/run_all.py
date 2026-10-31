"""
Entrena y evalúa las tres arquitecturas del experimento con el mismo
protocolo y las mismas particiones, y genera results/summary_all.{csv,md}.

    cd ai_module
    python -m training.run_all                                   # experimento principal
    python -m training.run_all --loso                            # Leave-One-Signer-Out
    python -m training.run_all --con-estatico                    # + RF estático agrupado
    python -m training.run_all --experimento config/experimentos/ablaciones/solo_posicion.yaml
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import resolver_experimento  # noqa: E402
from training import evaluate  # noqa: E402
from training.train import correr_arquitectura, preparar  # noqa: E402


def correr_todo(cfg: dict, loso: bool = False, arquitecturas: list[str] | None = None,
                verbose: bool = True) -> list[dict]:
    _, datos = preparar(cfg)
    if verbose:
        print(f"[run_all] {cfg.get('nombre')} · {len(datos)} videos · "
              f"{len(set(datos.grupos))} signers · {len(datos.clases)} clases · entrada "
              f"[B, {datos.preprocesador.T}, {datos.preprocesador.dim_entrada}]")
    infos = []
    for cfg_modelo in cfg["modelos"]:
        if arquitecturas and cfg_modelo["arquitectura"] not in arquitecturas:
            continue
        infos.append(correr_arquitectura(cfg, cfg_modelo, datos, loso=loso, verbose=verbose))
    return infos


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Compara TCN, LSTM y GRU con el mismo protocolo")
    parser.add_argument("--experimento", default="config/experimentos/comparacion_temporal.yaml")
    parser.add_argument("--loso", action="store_true")
    parser.add_argument("--arquitecturas", nargs="*", default=None)
    parser.add_argument("--con-estatico", action="store_true",
                        help="Evalúa también el Random Forest estático (training.eval_static)")
    args = parser.parse_args(argv)

    cfg = resolver_experimento(args.experimento)
    correr_todo(cfg, loso=args.loso, arquitecturas=args.arquitecturas)
    if args.con_estatico:
        from training.eval_static import evaluar_estatico
        from common.config import cargar_yaml
        evaluar_estatico(cargar_yaml("config/experimentos/estatico_rf.yaml"))
    df = evaluate.resumir_todo(cfg["salidas"]["directorio"], cfg["salidas"].get("dpi", 300))
    print(f"\n[run_all] Resumen: {cfg['salidas']['directorio']}/summary_all.md")
    print(df[["experimento", "esquema", "arquitectura", "f1_macro_media", "f1_macro_desviacion",
              "latencia_media_ms"]].to_string(index=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
