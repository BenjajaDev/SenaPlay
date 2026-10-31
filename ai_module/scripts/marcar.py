"""
Marcador de caso de la prueba en vivo (ver scripts/prueba_en_vivo.py).

Escribe {tipo: "marca", hora, etiqueta} en el registro. Cada respuesta del
servidor queda asignada al último marcador anterior a su llegada. Solo usa la
biblioteca estándar: sirve cualquier Python.

    cd ai_module
    python -m scripts.marcar "tcn · en vivo · acomodarse · r2"
"""

import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.prueba_en_vivo import escribir, ruta_registro  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        print('Uso: python -m scripts.marcar "tcn · en vivo · Nombre · r1"')
        return 2
    ahora = time.time()
    etiqueta = sys.argv[1].strip()
    escribir({"tipo": "marca", "inicio": ahora,
              "hora": datetime.fromtimestamp(ahora).strftime("%H:%M:%S.%f")[:-3],
              "etiqueta": etiqueta})
    print(f"[{datetime.fromtimestamp(ahora):%H:%M:%S}] marcador: {etiqueta}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
