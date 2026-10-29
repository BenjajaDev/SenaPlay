#!/usr/bin/env bash
# Toma las capturas de SeñaPlay en modo claro y oscuro con Maestro
# (.maestro/capturas.yaml), sobre un emulador o teléfono Android conectado.
#
#   SENAPLAY_EMAIL=prueba@correo.com SENAPLAY_PASSWORD='***' scripts/capturas.sh [carpeta]
#
# Requisitos (ver docs/10-capturas.md): adb, Maestro y la app instalada en
# versión preview (no el dev client: al limpiar el estado vuelve al launcher).
# Usa una cuenta de PRUEBA: las credenciales solo viajan por variables de
# entorno y no quedan en el repositorio.
set -euo pipefail

: "${SENAPLAY_EMAIL:?Define SENAPLAY_EMAIL con el correo de una cuenta de prueba}"
: "${SENAPLAY_PASSWORD:?Define SENAPLAY_PASSWORD con su contraseña}"

for tool in adb maestro; do
  command -v "$tool" >/dev/null || { echo "Falta «$tool» en el PATH (ver docs/10-capturas.md)." >&2; exit 1; }
done

if [ "$(adb devices | grep -c 'device$')" -ne 1 ]; then
  echo "Conecta exactamente un emulador o teléfono Android (adb devices)." >&2
  exit 1
fi

if ! adb shell pm list packages | grep -q 'com.benjajadev.senaplay'; then
  echo "SeñaPlay no está instalada. Instala la build preview (pnpm build:preview)." >&2
  exit 1
fi

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SALIDA="$(mkdir -p "${1:-$RAIZ/capturas}" && cd "${1:-$RAIZ/capturas}" && pwd)"
MODO_ORIGINAL="$(adb shell cmd uimode night | tr -d '\r' | awk '{print $NF}')"

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }

# Barra de estado de demostración: hora fija, batería llena y sin
# notificaciones, para que todas las capturas se vean iguales.
activar_demo() {
  adb shell settings put global sysui_demo_allowed 1
  demo enter
  demo clock -e hhmm 1200
  demo battery -e level 100 -e plugged false
  demo network -e wifi show -e level 4
  demo network -e mobile show -e datatype none -e level 4
  demo notifications -e visible false
}

restaurar() {
  demo exit || true
  adb shell cmd uimode night "${MODO_ORIGINAL:-auto}" >/dev/null || true
}
trap restaurar EXIT

activar_demo

# La app sigue el modo del sistema cuando no hay tema guardado (el flujo
# limpia el estado al abrirla).
for tema in claro oscuro; do
  if [ "$tema" = "oscuro" ]; then adb shell cmd uimode night yes >/dev/null; else adb shell cmd uimode night no >/dev/null; fi
  mkdir -p "$SALIDA/$tema"
  echo "→ Capturas en modo $tema: $SALIDA/$tema"
  maestro test "$RAIZ/.maestro/capturas.yaml" \
    -e EMAIL="$SENAPLAY_EMAIL" \
    -e PASSWORD="$SENAPLAY_PASSWORD" \
    -e OUT="$SALIDA/$tema"
done

echo "Listo: $(find "$SALIDA" -name '*.png' | wc -l | tr -d ' ') capturas en $SALIDA"
