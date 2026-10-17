---
title: SeñaPlay IA
emoji: 🤟
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: other
short_description: Reconocimiento de Lengua de Señas Chilena para SeñaPlay
---

# SeñaPlay IA

Servidor de reconocimiento de señas de la app SeñaPlay (Lengua de Señas Chilena).

- `POST /clasificar`: letra estática a partir de 21 landmarks de mano.
- `POST /clasificar_frames`: seña con movimiento a partir de cuadros JPEG.
- `GET /`: estado de los modelos.

Este Space se publica automáticamente desde la carpeta `ai_module/` del
repositorio de GitHub `BenjajaDev/oratioLingoRN` (rama `main`). No editar aquí.
