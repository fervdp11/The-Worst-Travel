# Arquitectura de The Worst Travel

## Visión general

```
Navegador (Phaser 3 WebGL + DOM)            Servidor (Node.js + Socket.IO)
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ WorldScene                    │  inp 15/s  │ RoomManager / ClientSession  │
│  · predicción a paso fijo     │──────────► │ Room (espera, anfitrión,     │
│  · interpolación de otros     │  act       │       chat, cuenta atrás)    │
│  · niebla con oclusión        │──────────► │ Game (30 Hz)                 │
│  · cámaras de vigilancia      │            │  · movimiento autoritativo   │
│ UI DOM: menús, HUD, reuniones │ ◄──────────│  · tareas, sabotajes, roles  │
│ Minijuegos Canvas 2D          │ snap 15/s  │  · cuchillo, ataque, votos   │
│ Audio WebAudio                │ pub/priv   │  · visibilidad por observador│
└──────────────────────────────┘            └──────────────────────────────┘
              ▲                    src/shared (planos, reglas, protocolo)
              └───────────────────── mismo código en ambos lados ───────────
```

- **Plano maestro único** (`src/shared/maps`): cada vehículo se construye con `MapBuilder` a partir de constantes. De ese plano salen la colisión y la visión (`MapRuntime`), el render horneado (`MapPainter`), el minimapa y el mapa ampliado (`MapDraw`) y la validación (`validate.ts`). No hay geometrías paralelas.
- **Autoridad del servidor**: el cliente envía direcciones cuantizadas con número de secuencia y acciones con identificador. El servidor aplica cada entrada como un paso de 1/30 s con un sistema de créditos que impide acelerar; valida estación, distancia, línea de visión, fase y prerrequisitos; los minijuegos se validan por partes con puzle generado en el servidor, respuesta comprobada y duración mínima plausible.
- **Visibilidad**: cada instantánea se filtra por observador (radio de visión + línea de visión contra muros y puertas cerradas, más lo que muestre su cámara activa). Las entidades usan identificadores opacos por observador; disfraces y señuelos reciben identificadores nuevos.
- **Tiempo**: el reloj de juego `gt` solo avanza en exploración, de modo que reuniones pausan enfriamientos, sabotajes no críticos, preparación del arma y llegada. Los plazos viajan como valores `gt` absolutos y el cliente los estima con corrección suave.
- **Estados**: `ESPERA → INICIO → EXPLORACIÓN → DISCUSIÓN → VOTACIÓN → RESULTADOS → EXPULSIÓN → FINAL`. La resolución terminal es atómica (`endGame` bloquea más acciones y emite un único resultado).
- **Práctica**: `LocalTransport` ejecuta el mismo `RoomManager` dentro del navegador; no es multijugador.

## Planos dimensionales

Unidades de mundo (u). Personaje: cuerpo 34 × 40 u, colisión circular de 12 u en los pies. Muros horizontales con cara visible: 56 u (tapa 14 + cara 42). Muros verticales: 18 u. Puertas: 92 u.

### TREN · El Expreso (locomotora a la izquierda)

| Constante | Valor |
| --- | --- |
| Módulos | 9 (locomotora + 8 vagones) |
| Longitud de módulo `MOD_L` | 600 u |
| Anchura `MOD_W` | 300 u (suelo útil y 56–278) |
| Pasarela entre módulos `GAP` | 70 u, suelo y 121–213 |
| Origen `X0` | 240 (morro decorativo de 150 u a la izquierda) |
| Extensión total | x 90–6200 |

Orden: 0 Locomotora (cabina + puesto de control) · 1 Máquinas · 2 Técnico (eléctrica | comunicaciones) · 3 Servicio (+ despensa) · 4 Comedor · 5 Pasajeros A (+ aseo) · 6 Pasajeros B (+ aseo) · 7 Seguridad · 8 Personal y equipaje (+ salón de reunión).

Niveles: **Interior** y **Techo**. El techo reutiliza exactamente las X/Y y anchuras de cada módulo, con pasarelas superiores en cada hueco. Tres escaleras en las pasarelas 1–2, 4–5 y 7–8, con extremos en la misma X/Y.

### BARCO · El Ferry (proa a la izquierda)

| Cubierta | Huella | Contenido |
| --- | --- | --- |
| Inferior (técnica) | x 600–3240, y 240–880 | Bodega de carga, distribución eléctrica, generadores, máquinas, bombas de achique, corredor, taller |
| Principal | casco x 60–3480, y 44–1056; interior x 700–3100 | Recepción, camarotes norte y sur, pasillos con anillo, restaurante, cocina, despensa, baños, enfermería, sala de personal, vestíbulo de popa, cubiertas exteriores con barandillas |
| Superior | x 740–3100, y 170–930 | Puente de mando, vestíbulo, comunicaciones, seguridad y paseo exterior con chimenea y botes |

Escaleras (misma X/Y en ambas cubiertas): proa principal↔inferior (900, 780), popa principal↔inferior (2900, 780), proa principal↔superior (1110, 402), popa principal↔superior (3030, 630).

### AVIÓN · El Vuelo (cabina a la izquierda)

| Elemento | Posición |
| --- | --- |
| Fuselaje | x 80–3500, y 0–600 |
| Alas | ancladas en x 1450–2150, envergadura y −1250…1850 (fijas, no transitables) |
| Motores | (1900, −560) y (1900, 1160) |
| Cubierta de pasajeros | cabina de pilotos · vestíbulo · pasajeros delantera (doble pasillo) · cocina central · aseos · pasajeros trasera · sala de descanso y servicio |
| Nivel técnico | equipos eléctricos · bodega delantera · comunicaciones · seguridad · presión · ventilación · taller · bodega trasera |
| Accesos de servicio | delantero (640, 450) y trasero (2870, 450): únicos enlaces entre niveles |

El doble pasillo permite rodear el bloque central de asientos; el nivel técnico cierra un circuito completo con los dos accesos.

## Rendimiento (diseño)

- Fondos estáticos horneados por nivel en bloques de 1024 u (con solape para evitar costuras), resolución según calidad (1×, 1,25×, 1,5×). Mobiliario alto empaquetado en atlas.
- Solo la capa del nivel actual se dibuja en la cámara principal; la cámara de vigilancia muestra únicamente el nivel de su cámara.
- Niebla en una textura de render de baja resolución (0,4–0,6) con polígono de visibilidad recalculado cada 2 fotogramas.
- Minimapa con base cacheada; solo se redibujan marcadores.
- Densidad de píxeles limitada por calidad (1, 1,5 o 2).
- Pasajeros deterministas simulados en el cliente; el servidor no los envía.
- Recursos exclusivos de cada mapa liberados al cambiar de mapa.
