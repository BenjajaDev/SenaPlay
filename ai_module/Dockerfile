# Servidor de IA de SeñaPlay para Hugging Face Spaces (SDK Docker).
# Ver docs/05-despliegue.md. Probar en local:
#   docker build -t senaplay-ia ai_module
#   docker run --rm -p 7860:7860 senaplay-ia     →  http://localhost:7860/
FROM python:3.11-slim

# libGL/glib: los pide opencv-contrib (dependencia de mediapipe) aunque no haya
# pantalla. EGL/GLES: la librería nativa de las tareas de mediapipe (Holistic)
# no carga sin ellas. portaudio: mediapipe importa sounddevice.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 libegl1 libgles2 libportaudio2 \
 && rm -rf /var/lib/apt/lists/*

# Spaces corre el contenedor con el usuario 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PRECARGAR_MODELOS=1
WORKDIR /home/user/app

# torch desde el índice CPU: el de PyPI trae CUDA (varios GB) que acá no se usa.
COPY --chown=user requirements-server.txt .
RUN pip install --no-cache-dir --user \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements-server.txt

COPY --chown=user . .

EXPOSE 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
