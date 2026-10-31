"""
Carga de configuraciones YAML.

Un YAML puede heredar de otro con la clave `hereda: <ruta>`: primero se carga
el archivo base y luego se le superponen (merge profundo) las claves del
archivo hijo. Así las ablaciones solo declaran lo que cambian respecto del
experimento principal.

Las claves cuyo valor es la ruta a otro YAML (`preprocesamiento`, `aumento`,
`modelos`) se resuelven a su contenido con `resolver_experimento`, y la
configuración ya resuelta es la que se copia a `results/<corrida>/config.yaml`:
lo que queda guardado es exactamente lo que se usó.
"""

import copy
import os

import yaml

from common.rutas import resolver


def cargar_yaml(ruta: str) -> dict:
    """Carga un YAML aplicando la herencia `hereda:` recursivamente."""
    ruta_abs = resolver(ruta)
    with open(ruta_abs, "r", encoding="utf-8") as f:
        datos = yaml.safe_load(f) or {}

    base = datos.pop("hereda", None)
    if base is None:
        return datos
    return fusionar(cargar_yaml(base), datos)


def fusionar(base: dict, encima: dict) -> dict:
    """Merge profundo: los dicts se combinan, cualquier otro valor se reemplaza."""
    resultado = copy.deepcopy(base)
    for clave, valor in encima.items():
        if isinstance(valor, dict) and isinstance(resultado.get(clave), dict):
            resultado[clave] = fusionar(resultado[clave], valor)
        else:
            resultado[clave] = copy.deepcopy(valor)
    return resultado


def _cargar_si_ruta(valor):
    if isinstance(valor, str) and valor.endswith((".yaml", ".yml")):
        return cargar_yaml(valor)
    return copy.deepcopy(valor)


def resolver_experimento(ruta_o_dict) -> dict:
    """
    Devuelve la configuración del experimento con todas las referencias a
    otros YAML reemplazadas por su contenido. Si la sección tiene la clave
    `ajustes`, se superpone sobre el archivo referenciado.
    """
    cfg = cargar_yaml(ruta_o_dict) if isinstance(ruta_o_dict, str) else copy.deepcopy(ruta_o_dict)

    for seccion in ("preprocesamiento", "aumento"):
        valor = cfg.get(seccion)
        if isinstance(valor, dict) and "archivo" in valor:
            ajustes = valor.get("ajustes", {})
            cfg[seccion] = fusionar(cargar_yaml(valor["archivo"]), ajustes)
        else:
            cfg[seccion] = _cargar_si_ruta(valor)

    modelos = []
    ajustes_modelos = cfg.get("ajustes_modelos", {}) or {}
    for entrada in cfg.get("modelos", []):
        modelo = _cargar_si_ruta(entrada)
        ajuste = ajustes_modelos.get(modelo.get("arquitectura"), {})
        modelos.append(fusionar(modelo, ajuste))
    cfg["modelos"] = modelos
    cfg.pop("ajustes_modelos", None)
    return cfg


def guardar_yaml(datos: dict, ruta: str) -> None:
    os.makedirs(os.path.dirname(resolver(ruta)), exist_ok=True)
    with open(resolver(ruta), "w", encoding="utf-8") as f:
        yaml.safe_dump(datos, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
