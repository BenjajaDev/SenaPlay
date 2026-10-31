"""
Piezas del servidor de inferencia (server.py), separadas de las rutas:

    ajustes    → Ajustes: modelo dinámico activo, rutas y límites, validados al arrancar
    puerto     → ModeloDinamico: lo único que las rutas saben del modelo dinámico
    modelos    → cargar_modelo_dinamico: elige el adaptador (TCNLegado | LSTMExportado)
    barreras   → sin_mano, poco_movimiento y modelo_sin_seña sobre SecuenciaCruda
"""
