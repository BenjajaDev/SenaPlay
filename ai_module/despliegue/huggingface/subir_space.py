"""
Publica el servidor de IA (ai_module/) en un Hugging Face Space con SDK Docker.

Copia a una carpeta temporal SOLO lo que el servidor usa en producción
(código, config, modelos, Dockerfile) más el README con la cabecera del Space,
y la sube en un único commit. Los archivos de esos tipos que ya no existen en
el repo se borran del Space, para que quede igual a `main`.

Lo corre el workflow .github/workflows/desplegar-ia.yml en cada push a main.
También se puede correr a mano:

    pip install huggingface_hub
    HF_TOKEN=hf_xxx python ai_module/despliegue/huggingface/subir_space.py   # Space "senaplay-ia" del dueño del token
"""

import argparse
import glob
import os
import shutil
import tempfile

from huggingface_hub import HfApi

DIR_AI = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
README_SPACE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "README.md")

ARCHIVOS = [
    "Dockerfile",
    ".dockerignore",
    "requirements-server.txt",
    "server.py",
    "signs_reference.json",
    "config/dataset_config.yaml",
    "model/*.py",
    "scripts/*.py",
    "models_saved/estatico.pkl",
    "models_mediapipe/*.task",
    "data/models/dinamico_tcn.pt",
]

# Lo que se borra del Space si ya no está en la subida (no toca .gitattributes).
TIPOS_SINCRONIZADOS = ["*.py", "*.yaml", "*.json", "*.txt", "*.pkl", "*.pt", "*.task",
                       "Dockerfile", ".dockerignore"]


def preparar(destino: str) -> list[str]:
    copiados = []
    for patron in ARCHIVOS:
        coincidencias = glob.glob(os.path.join(DIR_AI, patron))
        if not coincidencias:
            raise SystemExit(f"Falta {patron} en ai_module/ — ¿está commiteado?")
        for origen in coincidencias:
            relativo = os.path.relpath(origen, DIR_AI)
            os.makedirs(os.path.dirname(os.path.join(destino, relativo)), exist_ok=True)
            shutil.copy2(origen, os.path.join(destino, relativo))
            copiados.append(relativo.replace(os.sep, "/"))
    shutil.copy2(README_SPACE, os.path.join(destino, "README.md"))
    return copiados


def main(space: str, mensaje: str) -> None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("Falta la variable HF_TOKEN (token de Hugging Face con permiso de escritura).")

    api = HfApi(token=token)
    if "/" not in space:  # solo el nombre: el usuario sale del token
        space = f"{api.whoami()['name']}/{space}"
    api.create_repo(space, repo_type="space", space_sdk="docker", exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        copiados = preparar(tmp)
        api.upload_folder(
            repo_id=space,
            repo_type="space",
            folder_path=tmp,
            commit_message=(mensaje.strip().splitlines() or ["Despliegue"])[0][:200],
            delete_patterns=TIPOS_SINCRONIZADOS,
        )

    # El subdominio del Space: usuario-nombre en minúsculas, "_" y "." → "-".
    subdominio = space.replace("/", "-").replace("_", "-").replace(".", "-").lower()
    print(f"[Space] {len(copiados)} archivos publicados en https://huggingface.co/spaces/{space}")
    print(f"[Space] URL del servidor (EXPO_PUBLIC_AI_SERVER_URL): https://{subdominio}.hf.space")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publica ai_module/ en un Hugging Face Space")
    parser.add_argument("--space", default=os.environ.get("HF_SPACE") or "senaplay-ia",
                        help="nombre del Space, o usuario/nombre (o variable HF_SPACE)")
    parser.add_argument("--mensaje", default=os.environ.get("MENSAJE_COMMIT", "Despliegue desde GitHub"))
    args = parser.parse_args()
    main(args.space, args.mensaje)
