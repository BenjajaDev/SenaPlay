"""
Modelos de salida del servidor (aparecen en el OpenAPI de /docs).

Es el contrato que consume la app (src/features/camera/presentation/signCamera.js):
`seña`, `confianza`, `es_seña`, `motivo` y `alternativas`. Las claves y los
redondeos (4 decimales las confianzas, 3 el movimiento y el ratio) son los
del servidor legado.
"""

from __future__ import annotations

from pydantic import BaseModel

from inferencia.barreras import Evaluacion, Motivo


class RespuestaEstatica(BaseModel):
    """/clasificar y /clasificar_secuencia."""

    seña: str
    confianza: float


class Alternativa(BaseModel):
    seña: str
    confianza: float


class RespuestaDinamica(BaseModel):
    """/clasificar_frames y /clasificar_video."""

    seña: str                       # mejor clase, aunque es_seña sea False
    confianza: float
    es_seña: bool                   # motivo is None
    motivo: Motivo | None           # nunca "modelo_sin_seña" si el modelo no tiene clase de rechazo
    alternativas: list[Alternativa]  # las 2 siguientes del ranking
    movimiento_muñeca: float | None  # None sin pose suficiente para medirlo
    frames_procesados: int
    ratio_con_mano: float


def respuesta_estatica(seña: str, confianza: float) -> RespuestaEstatica:
    return RespuestaEstatica(seña=seña, confianza=round(float(confianza), 4))


def respuesta_dinamica(ranking: list[tuple[str, float]], evaluacion: Evaluacion,
                       frames_procesados: int) -> RespuestaDinamica:
    seña, confianza = ranking[0]
    movimiento = evaluacion.movimiento_muñeca
    return RespuestaDinamica(
        seña=seña,
        confianza=round(float(confianza), 4),
        es_seña=evaluacion.es_seña,
        motivo=evaluacion.motivo,
        alternativas=[Alternativa(seña=s, confianza=round(float(p), 4)) for s, p in ranking[1:3]],
        movimiento_muñeca=None if movimiento is None else round(movimiento, 3),
        frames_procesados=frames_procesados,
        ratio_con_mano=evaluacion.ratio_con_mano,
    )
