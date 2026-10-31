"""
Preprocesamiento compartido entre entrenamiento y servidor.

    extraction     → landmarks crudos desde video (MediaPipe Holistic)
    spec           → FeatureSpec: qué landmarks, en qué orden, qué bloques
    normalization  → marco corporal (hombros) y marco local de cada mano
    resampling     → remuestreo temporal a T frames
    features       → posición, velocidad y aceleración
    augmentation   → aumento de datos (solo entrenamiento)
    pipeline       → Preprocesador: fachada que encadena todo lo anterior
"""
