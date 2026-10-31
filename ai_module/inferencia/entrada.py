"""
Validación de lo que llega al servidor: cuadros JPEG, videos y tamaño del cuerpo.

El servidor es público y cada cuadro cuesta CPU de MediaPipe, así que se
rechaza lo que la app nunca manda antes de decodificar o detectar nada. Los
límites salen de `Ajustes` (ver docs/ai/integracion_diseno.md §6):

    413  algo pesa más de lo permitido (cuerpo, cuadro, video, cuadros del video)
    422  algo tiene mal formato (prefijo, base64, no es JPEG, mime no admitido)

Los mensajes no incluyen excepciones internas ni rutas de archivos.
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from fastapi import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

PREFIJO_JPEG = "data:image/jpeg;base64"
MARCA_JPEG = b"\xff\xd8\xff"
SUFIJOS_VIDEO = {"video/webm": ".webm", "video/mp4": ".mp4"}


class EntradaInvalida(Exception):
    """Entrada rechazada: `status` es 413 o 422 y `mensaje` va tal cual al cliente."""

    def __init__(self, status: int, mensaje: str):
        super().__init__(mensaje)
        self.status = status
        self.mensaje = mensaje


def _kb(caracteres: int) -> int:
    return round(caracteres / 1024)


def _b64(datos: str, que: str) -> bytes:
    try:
        return base64.b64decode(datos, validate=True)
    except (binascii.Error, ValueError):
        raise EntradaInvalida(422, f"{que} no es base64 válido") from None


@dataclass(frozen=True)
class Cuadro:
    indice: int          # posición en el tramo: fija el timestamp para MediaPipe
    imagen: np.ndarray   # BGR


def validar_cuadros(cuadros: list[str], max_cuadros: int, max_bytes_cuadro: int) -> list[bytes]:
    """
    Valida el tramo completo antes de decodificar nada y devuelve los bytes
    JPEG de cada cuadro. Acepta el prefijo `data:image/jpeg;base64,` o ninguno.
    """
    if not cuadros:
        raise EntradaInvalida(422, "El tramo no trae cuadros")
    if len(cuadros) > max_cuadros:
        raise EntradaInvalida(422, f"El tramo trae {len(cuadros)} cuadros; "
                                   f"el máximo es {max_cuadros}")
    jpegs = []
    for numero, datos in enumerate(cuadros, start=1):
        cuerpo = datos
        if "," in datos:
            prefijo, cuerpo = datos.split(",", 1)
            if prefijo != PREFIJO_JPEG:
                tipo = prefijo.split(";", 1)[0][:40]
                raise EntradaInvalida(422, f"El cuadro {numero} no es JPEG ({tipo})")
        if len(cuerpo) > max_bytes_cuadro:
            raise EntradaInvalida(413, f"El cuadro {numero} pesa {_kb(len(cuerpo))} KB; "
                                       f"el máximo es {_kb(max_bytes_cuadro)} KB")
        jpeg = _b64(cuerpo, f"El cuadro {numero}")
        if not jpeg.startswith(MARCA_JPEG):
            raise EntradaInvalida(422, f"El cuadro {numero} no es un JPEG")
        jpegs.append(jpeg)
    return jpegs


def decodificar_cuadros(jpegs: list[bytes]) -> list[Cuadro]:
    """
    JPEG → imágenes BGR. Un JPEG que OpenCV no logra decodificar se salta,
    como hacía el servidor legado; su índice igual cuenta para el timestamp.
    """
    import cv2

    cuadros = []
    for indice, jpeg in enumerate(jpegs):
        imagen = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if imagen is not None:
            cuadros.append(Cuadro(indice, imagen))
    if not cuadros:
        raise EntradaInvalida(422, "Ningún cuadro se pudo decodificar")
    return cuadros


def validar_video(video_base64: str, mime: str, max_bytes_video: int) -> tuple[bytes, str]:
    """Devuelve (bytes del video, sufijo del archivo temporal)."""
    tipo = mime.split(";", 1)[0].strip().lower()   # "video/webm;codecs=vp8" → "video/webm"
    if tipo not in SUFIJOS_VIDEO:
        raise EntradaInvalida(422, f"Formato de video no admitido: {tipo[:40]}. "
                                   f"Se aceptan {', '.join(SUFIJOS_VIDEO)}")
    if len(video_base64) > max_bytes_video:
        raise EntradaInvalida(413, f"El video pesa {_kb(len(video_base64))} KB; "
                                   f"el máximo es {_kb(max_bytes_video)} KB")
    return _b64(video_base64, "El video"), SUFIJOS_VIDEO[tipo]


# ── Tamaño del cuerpo ─────────────────────────────────────────────────────────

class LimiteCuerpo:
    """
    Middleware ASGI: rechaza con 413 un cuerpo sobre el límite de su ruta.

    Sin esto, FastAPI arma el JSON completo en memoria antes de que se pueda
    validar nada. Si la petición trae Content-Length, se rechaza sin leer el
    cuerpo; si no (chunked), se cuentan los bytes mientras llegan.
    """

    def __init__(self, app: ASGIApp, limite_para: Callable[[Scope], int | None]):
        self.app = app
        self.limite_para = limite_para

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        limite = self.limite_para(scope) if scope["type"] == "http" else None
        if limite is None:
            await self.app(scope, receive, send)
            return

        declarado = dict(scope.get("headers", [])).get(b"content-length")
        if declarado is not None and declarado.isdigit() and int(declarado) > limite:
            await self._rechazar(scope, receive, send, limite)
            return

        recibidos = 0
        respuesta_iniciada = False

        async def recibir_limitado() -> Message:
            nonlocal recibidos
            mensaje = await receive()
            if mensaje["type"] == "http.request":
                recibidos += len(mensaje.get("body", b""))
                if recibidos > limite:
                    # Se lanza mientras FastAPI lee el cuerpo: como es una
                    # HTTPException, FastAPI la deja pasar y responde 413.
                    raise _CuerpoExcedido(limite)
            return mensaje

        async def enviar(mensaje: Message) -> None:
            nonlocal respuesta_iniciada
            respuesta_iniciada = respuesta_iniciada or mensaje["type"] == "http.response.start"
            await send(mensaje)

        try:
            await self.app(scope, recibir_limitado, enviar)
        except _CuerpoExcedido:
            if not respuesta_iniciada:
                await self._rechazar(scope, receive, send, limite)

    @staticmethod
    async def _rechazar(scope: Scope, receive: Receive, send: Send, limite: int) -> None:
        respuesta = JSONResponse(status_code=413, content={"detail": _mensaje_cuerpo(limite)})
        await respuesta(scope, receive, send)


def _mensaje_cuerpo(limite: int) -> str:
    return f"La petición pesa más de {_kb(limite)} KB, el máximo de esta ruta"


class _CuerpoExcedido(HTTPException):
    def __init__(self, limite: int):
        super().__init__(status_code=413, detail=_mensaje_cuerpo(limite))
