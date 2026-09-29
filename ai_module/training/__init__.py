"""
Entrenamiento y evaluación de la comparación temporal (TCN, LSTM, GRU).

    datos        carga del dataset desde data/manifest.csv
    cv           particiones agrupadas por signer (StratifiedGroupKFold / LOSO)
    train        protocolo de entrenamiento común y corrida por arquitectura
    evaluate     métricas, latencia, figuras y tablas de resultados
    run_all      las tres arquitecturas con un solo comando
    select_model selección y exportación del modelo para el servidor
    add_batch    incorporación de un lote nuevo de grabaciones
    eval_static  el Random Forest estático con validación agrupada
"""
