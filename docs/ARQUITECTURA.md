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

- **Plano maestro único** (`src/shared/maps`): cada mapa se construye con `MapBuilder` a partir de constantes y tiene **una sola planta**. De ese plano salen la colisión y la visión (`MapRuntime`), el render horneado (`MapPainter`), el minimapa y el mapa ampliado (`MapDraw`) y la validación (`validate.ts`). No hay geometrías paralelas.
- **Una definición por objeto** (`objects.ts`): de cada mueble se derivan por separado su colisión (huella en el suelo más la parte alta proyectada, sin huecos por los que colarse en diagonal), su oclusión (solo los objetos altos tapan la vista), su tipo de sombra (soporte, base del mástil, contacto… nunca un óvalo genérico) y su rectángulo visual y profundidad. Los muebles son opacos; las interacciones se hacen desde el lado accesible.
- **Autoridad del servidor**: el cliente envía direcciones cuantizadas con número de secuencia y acciones con identificador. El servidor aplica cada entrada como un paso de 1/30 s con un sistema de créditos que impide acelerar; valida estación, distancia, línea de visión, fase y prerrequisitos; los minijuegos se validan por partes con puzle generado en el servidor, respuesta comprobada y duración mínima plausible.
- **Visibilidad**: cada instantánea se filtra por observador (radio de visión + línea de visión contra muros, puertas cerradas y objetos altos, más lo que muestre su cámara activa). Las entidades usan identificadores opacos por observador; disfraces y señuelos reciben identificadores nuevos.
- **Polígono de visión exacto** (`MapRuntime.visibility`): rayos hacia cada esquina de los oclusores (rectángulos y segmentos) más un anillo base; la luz entra en el muro hasta su cara opuesta y nunca más allá, así que los bordes siguen al muro en línea recta. En el cliente la niebla es una textura a resolución de pantalla: polígono × degradado radial suave, y se recortan encima las siluetas visibles de personajes y muebles, sin bandas horizontales sobre el personaje.
- **Contornos de interacción**: la silueta del objeto se perfila (amarillo para trabajo o compra, rojo solo para el impostor) en lugar de aros o discos bajo él. Los marcadores del minimapa se enlazan por identificador al objetivo actual real.
- **Tiempo**: el reloj de juego `gt` solo avanza en exploración, de modo que reuniones pausan enfriamientos, sabotajes no críticos, preparación del arma y llegada. Los plazos viajan como valores `gt` absolutos y el cliente los estima con corrección suave.
- **Estados**: Viaje `ESPERA → INICIO → EXPLORACIÓN → DISCUSIÓN → VOTACIÓN → RESULTADOS → EXPULSIÓN → FINAL`; Supermercado `ESPERA → INICIO → COMPRA → CAJA → DISCUSIÓN → VOTACIÓN → RESULTADOS → EXPULSIÓN → COMPRA…`. Los finales de fase viajan como instantes absolutos del reloj del servidor. La resolución terminal es atómica (`endGame` bloquea más acciones y emite un único resultado).
- **Supermercado** (`src/server/game/market.ts`): la comida elegida solo se envía en el estado privado de los trabajadores; el impostor no la recibe nunca. Las estanterías, la mano, la entrega y la devolución las valida el servidor; los demás solo ven una bolsa. Al cierre se construye la cola de caja (con SIN APORTE para quien no entregó) y se revela uno a uno; el historial de rondas queda en la reunión.
- **Trampillas**: estados explícitos FUERA → ENTRANDO → DENTRO → VIAJANDO → SALIENDO, con la tapa animada una sola vez por transición. Dentro, el servidor envía solo los ángulos de las conexiones reales (sin nombres) y cada pulsación es una única petición.
- **Personajes**: un único compositor (`art/compose.ts`) con anclajes de cabeza, ojos y cuello sirve al mundo, la vista previa del vestuario, el chat, los votos y las cinemáticas.
- **Práctica**: `LocalTransport` ejecuta el mismo `RoomManager` dentro del navegador; no es multijugador.

## Planos dimensionales

Unidades de mundo (u). Personaje: cuerpo 34 × 40 u, colisión circular de 14 u en los pies. Muros horizontales con cara visible: 56 u. Muros verticales: 18 u. Puertas: 92 u. Todos los mapas tienen una sola planta: no hay escaleras, techos ni niveles técnicos.

### BARCO · El Ferry (proa a la izquierda)

Salas en x 130–3442, y 70–1030. 16 salas: cubiertas exteriores de proa y popa, bandas de babor y estribor con barandilla, pasillo central, puente de mando, salón de pasajeros, comedor, cocina, sala de personal, radio y comunicaciones, baños, seguridad, electricidad, sala de máquinas y almacén y bodega. 7 trampillas en red explícita, 14 tareas y 5 sabotajes (apagón, comunicaciones, puertas y dos críticos: propulsión y vía de agua).

### AVIÓN · El Vuelo (cabina de mando a la izquierda)

Salas en x 380–3440, y 216–884 dentro del fuselaje; alas y motores son decorado fijo. 13 salas: cabina de mando, cocina delantera, pasillo de tripulación, comunicaciones, vestíbulo L1, cabina de pasajeros, vestíbulo trasero, aseos, descanso de tripulación, pasillo de servicio, seguridad, equipos eléctricos y bodega de servicio. 7 trampillas, 14 tareas y 5 sabotajes.

### SÚPER · El Carrito

Edificio de 2400 × 1480 u con tres zonas: **Frescos** (mostradores refrigerados de carnicería, pescadería, lácteos y refrigerados en la pared norte), **Pasillos** (3 filas × 3 lineales altos de dos caras, con bahías de producto en cada cara) y **Cajas** (caja abierta con cola marcada, cajas cerradas y salida de emergencia). 150 productos en 11 secciones y 100 comidas. Sin trampillas ni sabotajes. Las estanterías altas bloquean la visión.

## Rendimiento (diseño)

- Fondos estáticos horneados por nivel en bloques de 1024 u (con solape para evitar costuras), resolución según calidad (1×, 1,25×, 1,5×). Mobiliario alto empaquetado en atlas.
- Niebla en una textura de render a la resolución de pantalla (según calidad) con el polígono de visibilidad exacto; se recrea al cambiar el zoom o la calidad.
- Minimapa con base cacheada; solo se redibujan marcadores.
- Densidad de píxeles limitada por calidad (1, 1,5 o 2).
- Pasajeros deterministas simulados en el cliente; el servidor no los envía.
- Recursos exclusivos de cada mapa liberados al cambiar de mapa.
