"""
Ajustes del servidor de IA, validados al arrancar (pydantic-settings).

Todo lo configurable del servidor vive en `Ajustes`: qué modelo dinámico se
sirve, de dónde se cargan los modelos y los límites de entrada. Cada campo se
lee de la variable de entorno con su nombre en mayúsculas (MODELO_DINAMICO,
RUTA_MODELO_TCN, MAX_CUADROS_VIDEO…). Si un valor no es válido o falta un
archivo, el servidor no arranca: es preferible a servir en silencio otro
modelo, o ninguno.

    MODELO_DINAMICO=tcn   TCN legada con la clase «ninguna» (producción, por defecto)
    MODELO_DINAMICO=lstm  LSTM exportada por training/select_model.py, solo para
                          pruebas locales (no tiene clase de rechazo)
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal, Self

from pydantic import PositiveInt, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DIR_MODULO = Path(__file__).resolve().parent.parent  # ai_module/

MIB = 1024 * 1024


class AjustesInvalidos(RuntimeError):
    """La configuración del servidor no es válida; el mensaje dice qué variable y por qué."""


class Ajustes(BaseSettings):
    # case_sensitive=False aplica al NOMBRE de la variable de entorno, no a su
    # valor: MODELO_DINAMICO=TCN se rechaza (los valores válidos son tcn | lstm).
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore",
                                      validate_default=True)

    modelo_dinamico: Literal["tcn", "lstm"] = "tcn"
    ruta_modelo_tcn: Path = Path("data/models/dinamico_tcn.pt")
    ruta_modelo_lstm: Path = Path("models_saved/dinamico.pt")
    ruta_modelo_estatico: Path = Path("models_saved/estatico.pkl")
    # En el despliegue (Dockerfile) el estático se carga al arrancar: si no, la
    # primera seña de cada arranque espera varios segundos y la app la da por
    # perdida (timeout de 2,5 s del estático). El dinámico se carga siempre.
    precargar_modelos: bool = False

    # ── Límites de entrada (ver docs/ai/integracion_diseno.md §6) ──
    # El visor manda tramos de ≤ 3,4 s a 15 fps (~51 cuadros) y clips de ≤ 4 s:
    # los valores por defecto dejan holgura amplia sobre eso.
    max_cuadros_tramo: PositiveInt = 120
    # Cuadros muestreados del video (los que pasan por MediaPipe): 10 s a 30 fps.
    max_cuadros_video: PositiveInt = 300
    max_bytes_cuadro: PositiveInt = 256 * 1024
    max_bytes_video: PositiveInt = 8 * MIB
    max_bytes_cuerpo_frames: PositiveInt = 8 * MIB
    max_bytes_cuerpo_video: PositiveInt = 9 * MIB
    max_bytes_cuerpo: PositiveInt = 1 * MIB

    @field_validator("ruta_modelo_tcn", "ruta_modelo_lstm", "ruta_modelo_estatico")
    @classmethod
    def _desde_el_modulo(cls, ruta: Path) -> Path:
        # Relativas a ai_module/, no al directorio desde el que se lanzó uvicorn.
        return ruta if ruta.is_absolute() else DIR_MODULO / ruta

    @property
    def ruta_modelo_dinamico(self) -> Path:
        return self.ruta_modelo_tcn if self.modelo_dinamico == "tcn" else self.ruta_modelo_lstm

    @model_validator(mode="after")
    def _archivos_existen(self) -> Self:
        # Solo el dinámico elegido: sin dinamico.pt se puede arrancar con tcn.
        variable_dinamico = f"RUTA_MODELO_{self.modelo_dinamico.upper()}"
        for variable, ruta in (("RUTA_MODELO_ESTATICO", self.ruta_modelo_estatico),
                               (variable_dinamico, self.ruta_modelo_dinamico)):
            if not ruta.is_file():
                raise ValueError(f"{variable}: no existe el archivo {ruta}")
        return self

    @model_validator(mode="after")
    def _limites_coherentes(self) -> Self:
        if self.max_bytes_cuadro > self.max_bytes_cuerpo_frames:
            raise ValueError("MAX_BYTES_CUADRO no puede superar MAX_BYTES_CUERPO_FRAMES")
        if self.max_bytes_video >= self.max_bytes_cuerpo_video:
            raise ValueError("MAX_BYTES_VIDEO debe ser menor que MAX_BYTES_CUERPO_VIDEO "
                             "(el cuerpo lleva además el JSON que lo envuelve)")
        return self


_MENSAJES = {
    "literal_error": "debe ser uno de {esperado} (llegó {valor!r})",
    "greater_than": "debe ser mayor que 0 (llegó {valor!r})",
    "int_parsing": "debe ser un número entero (llegó {valor!r})",
    "bool_parsing": "debe ser 1/0 o true/false (llegó {valor!r})",
}


def _describir(error: ValidationError) -> str:
    lineas = []
    for detalle in error.errors():
        campo = ".".join(str(parte) for parte in detalle["loc"]).upper()
        plantilla = _MENSAJES.get(detalle["type"])
        if plantilla:
            mensaje = plantilla.format(valor=detalle.get("input"),
                                       esperado=str(detalle.get("ctx", {}).get("expected", ""))
                                       .replace(" or ", " o "))
        else:
            mensaje = str(detalle["msg"]).removeprefix("Value error, ")
        lineas.append(f"  - {campo}: {mensaje}" if campo else f"  - {mensaje}")
    return "\n".join(lineas)


def cargar_ajustes(**valores) -> Ajustes:
    """
    Lee los ajustes del entorno (los `valores` explícitos tienen prioridad).
    Lanza AjustesInvalidos con un mensaje en español si algo no es válido.
    """
    try:
        return Ajustes(**valores)
    except ValidationError as error:
        raise AjustesInvalidos(
            "Configuración del servidor de IA inválida; el servidor no arranca:\n"
            + _describir(error)
        ) from None
