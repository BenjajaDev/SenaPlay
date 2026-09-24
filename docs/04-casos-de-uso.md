# 4. Casos de uso

Mermaid no tiene un tipo nativo de diagrama de casos de uso. Se representan con `flowchart`: actores a la izquierda y casos de uso como óvalos dentro del límite del sistema. Las relaciones `«include»` y `«extend»` van en las aristas.

## 4.1 Estudiante (app móvil)

```mermaid
flowchart LR
  E(["👤 Estudiante"])
  IA(["🧠 Servidor IA"])
  SB(["☁️ Supabase"])

  subgraph APP["App móvil SeñaPlay"]
    UC1(("Registrarse y<br/>verificar correo"))
    UC2(("Iniciar sesión"))
    UC3(("Recuperar contraseña"))
    UC4(("Jugar un nivel"))
    UC5(("Pedir pista"))
    UC6(("Ver celebración<br/>y estrellas"))
    UC7(("Consultar diccionario"))
    UC8(("Jugar memoria / quiz"))
    UC9(("Practicar con cámara"))
    UC10(("Ver videos"))
    UC11(("Revisar progreso y racha"))
    UC12(("Editar perfil y foto"))
    UC13(("Configurar tema<br/>y vibración"))
    UC14(("Cerrar sesión"))
    UC15(("Recibir avisos /<br/>mantenimiento"))
    UCC(("Confirmar acción crítica"))
  end

  E --- UC1 & UC2 & UC3 & UC4 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12 & UC13 & UC14
  UC4 -. «extend» .-> UC5
  UC4 -. «include» .-> UC6
  UC12 -. «include» .-> UCC
  UC14 -. «include» .-> UCC
  UC4 -. «extend»<br/>salir a mitad .-> UCC
  UC9 --- IA
  UC1 & UC2 & UC3 & UC12 --- SB
  UC15 --- SB
  E --- UC15
```

### Especificación: «Jugar un nivel»

| Campo | Detalle |
|---|---|
| Actor | Estudiante |
| Precondición | Sesión iniciada, nivel desbloqueado y visible. En modo pool, al menos una vida. |
| Flujo principal | 1. Elige el nivel en la ruta. 2. Responde el ejercicio y toca «Verificar». 3. Recibe feedback visual, háptico y por lector de pantalla. 4. «Continuar». 5. Repite hasta el último ejercicio. 6. Ve la celebración (confeti, estrellas, resumen) y su progreso queda guardado. |
| Flujo alternativo A | Respuesta incompleta: aparece un aviso informativo y **no se pierde vida**. |
| Flujo alternativo B | Respuesta incorrecta: se pierde una vida con una animación sutil y se reintenta el mismo ejercicio. |
| Flujo alternativo C | Sin vidas: mensaje no punitivo con opción de reintentar o salir. |
| Flujo alternativo D | Salir a mitad: confirmación «¿Salir del nivel?». |
| Extensión | Pista: ampolleta flotante o mantener presionada una seña. Suma una penalización leve por ejercicio. |
| Postcondición | `LEVEL_COMPLETED` → progreso persistido y siguiente nivel desbloqueado. |

## 4.2 Administrador y editor (portal web)

```mermaid
flowchart LR
  ED(["✍️ Editor"])
  AD(["🛡️ Administrador"])
  V(["🌐 Visitante"])

  subgraph WEB["Portal web"]
    L1(("Ver landing<br/>y métricas"))
    L2(("Descargar la app"))
    A0(("Iniciar sesión<br/>en el panel"))
    C1(("Gestionar niveles<br/>y ejercicios"))
    C2(("Gestionar diccionario"))
    C3(("Gestionar vocabulario"))
    M1(("Subir y categorizar medios"))
    M2(("Publicar / ocultar medio"))
    R1(("Activar mantenimiento"))
    R2(("Publicar avisos / eventos"))
    R3(("Ajustar vidas, puntaje<br/>y dificultad"))
    R4(("Exigir versión mínima"))
    F1(("Gestionar feature flags"))
    U1(("Asignar roles"))
    H1(("Revisar historial<br/>de cambios"))
    CF(("Confirmar acción"))
  end

  V --- L1 & L2
  ED --- A0 & C1 & C2 & C3 & M1 & M2
  AD --- A0 & R1 & R2 & R3 & R4 & F1 & U1 & H1
  AD -. hereda .-> ED
  C1 & C2 & C3 & M2 & R1 & R2 & R3 & R4 & F1 & U1 -. «include» .-> CF
```

### Especificación: «Activar mantenimiento»

| Campo | Detalle |
|---|---|
| Actor | Administrador |
| Precondición | Sesión con rol `admin` (verificado en el front y por RLS). |
| Flujo | 1. Configuración remota → Modo mantenimiento. 2. Activa el interruptor y edita título y mensaje. 3. «Publicar». 4. El diálogo advierte que esto bloqueará la app para todos y muestra el JSON exacto. 5. Confirma. 6. Se guarda en `app_config` y el trigger registra la auditoría. |
| Resultado en la app | Al abrir la app o al volver a primer plano (como máximo cada 5 min), `evaluateRemoteState` devuelve `gate: 'maintenance'` y se muestra `AppGateScreen` con «Reintentar». Los administradores no quedan bloqueados. |
