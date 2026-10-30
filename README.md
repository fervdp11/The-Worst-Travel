# The Worst Travel

Juego multijugador de deducción social para navegador, ambientado en tres vehículos: **TREN · El Expreso**, **BARCO · El Ferry** y **AVIÓN · El Vuelo**. Entre 4 y 12 empleados atienden al pasaje y mantienen el vehículo en marcha; uno de ellos es el **IMPOSTOR**, que sabotea, sigue una cadena secreta para conseguir un cuchillo y quiere llegar hasta el responsable del viaje (conductor, capitana o piloto, un personaje no jugador).

Toda la interfaz está en español de España. El arte, los personajes, los escenarios, los textos y el sonido son originales y se generan en el propio proyecto (dibujo vectorial en Canvas 2D durante la carga y audio sintetizado con WebAudio).

## Requisitos

- Node.js **20.19 o superior** (probado con Node 22).
- Un navegador moderno con WebGL (Chrome, Edge, Firefox o Safari recientes).

## Comandos

```bash
npm install
```

```bash
npm run dev
```

Arranca el servidor de desarrollo en `http://localhost:3000` con recarga en caliente (Vite en modo *middleware* + Socket.IO en el mismo puerto).

```bash
npm run build
```

Compila el cliente en `dist/client` y el servidor en `dist/server/index.js`.

```bash
npm start
```

Sirve la compilación de producción. Variables de entorno:

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP y WebSocket. |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `CLIENT_DIR` | `dist/client` | Carpeta del cliente compilado. |

El cliente se conecta siempre al mismo origen que sirve la página: no hay ninguna URL `localhost` fija, así que funciona detrás de un proxy o en cualquier plataforma que asigne el puerto por `PORT`. `GET /health` devuelve el estado del servidor.

```bash
npm test
```

Pruebas de lógica con Vitest (59 casos: votos, asignación de roles, tareas idempotentes, cadena del cuchillo, críticos resolubles por una persona, reuniones, desconexiones, resolución terminal, correspondencia de planos, textos por vehículo, simulación independiente de FPS).

```bash
npm run typecheck
```

```bash
npm run validate:maps
```

Valida los tres planos maestros y la sala de espera: accesibilidad a pie de todas las estaciones, escaleras, trampillas, salas y puntos de aparición, y que ninguna celda transitable quede fuera del contorno del vehículo.

```bash
node scripts/bots.mjs CODIGO 3
```

Une 3 clientes de prueba sin interfaz a una sala existente (útil para probar el multijugador con un solo navegador).

## Cómo jugar

- **CREAR SALA**: eliges vehículo, plazas (4–12) y preset (CLÁSICO SIN ROLES, EQUILIBRADO, PERSONALIZADO). Compartes el código de 5 caracteres o el enlace (`?sala=CODIGO`).
- **UNIRSE CON CÓDIGO**: entras en una sala privada.
- **PRÁCTICA**: modo de un jugador claramente identificado, sin red (ejecuta la misma lógica del servidor dentro del navegador). Eliges vehículo, bando y especialidad; en práctica también los trabajadores pueden provocar sabotajes para probarlos.
- En la **sala de espera** (terminal de viajes con vestuarios) puedes moverte, chatear y personalizar color y accesorio en el vestuario. Solo el anfitrión cambia ajustes y pulsa **INICIAR** (mínimo 4 personas conectadas con el mapa cargado; cuenta atrás de 3 s).

### Controles

| Acción | Teclado | Táctil |
| --- | --- | --- |
| Moverse (8 direcciones) | WASD / flechas | Joystick |
| Usar / reparar / reunión / escalera | E | USAR |
| Ocultarse en taquilla | E (OCULTARSE) | OCULTARSE |
| Trampilla | V | TRAMPILLA |
| Sabotear (impostor) | X | SABOTEAR |
| Atacar al responsable (impostor, al final) | T | ATACAR |
| Habilidad | Q (configurable) | HABILIDAD |
| Mapa | M / Tab | MAPA |
| Cerrar paneles | Escape | ✕ |
| Depuración (colisiones, contorno, salas) | F3 | — |

Mientras escribes en el chat o manejas un minijuego no se activan acciones del mundo.

## Reglas implementadas

- Un único impostor. Gana **solo** si un sabotaje crítico agota su plazo o si asesina al responsable tras completar la cadena del arma (5 etapas variables por semilla). No hay asesinatos de trabajadores ni victoria por paridad.
- Los trabajadores ganan expulsando al impostor o completando todas las tareas obligatorias: entonces empieza la maniobra de llegada (estación, puerto o aterrizaje), que se pausa si hay un crítico activo.
- Reuniones: convocatoria → discusión → votación (con confirmación y SALTAR) → resultados → expulsión cómica propia de cada vehículo. Empate o SALTAR con el máximo: nadie es expulsado. Abstenerse no cuenta.
- Expulsados: espectadores fantasma con chat propio; pueden terminar sus tareas, no votan ni reparan.
- Sabotajes físicos (hay que ir a la instalación): apagón, comunicaciones, puertas y dos críticos distintos por mapa con reparación secuencial que una sola persona puede completar.
- Trampillas con red explícita, estancia y enfriamiento; taquillas para una persona con tiempo máximo.
- Cámaras fijas con encuadre real, oclusión y piloto visible; panel de ocupación por nivel; SIN SEÑAL con comunicaciones caídas.
- Trece especialidades opcionales con nombres canónicos idénticos en los tres mapas (7 de trabajador, 6 de impostor), todas configurables antes de iniciar.
- Servidor autoritativo: el cliente solo envía intenciones. Visibilidad filtrada por observador (no se envían jugadores fuera de visión), identificadores opacos por observador (un disfraz o un señuelo no se delatan por su identificador), validación de distancia, línea de visión, prerrequisitos y duraciones mínimas en cada etapa de minijuego, acciones con identificador para descartar duplicados, reconexión con token y 30 s de margen.

## Estructura

```
src/shared/        Lógica compartida cliente/servidor
  maps/            Planos maestros (tren, barco, avión, terminal), runtime de colisión/visión y validador
  settings.ts      Ajustes, presets, validación y asignación de roles
  roles.ts         Trece especialidades y sus parámetros
  minigames.ts     Generación y validación de puzles de cada minijuego
  movement.ts      Paso fijo de movimiento (predicción del cliente = simulación del servidor)
  protocol.ts      Mensajes y tipos de red (versión de protocolo)
src/server/        Servidor Node.js + Socket.IO
  room/            Salas, sesiones, anfitrión, cuenta atrás, chat, sala de espera
  game/            Partida: fases, tareas, sabotajes, cuchillo, roles, visibilidad
src/client/        Cliente Phaser 3 (WebGL) + interfaz DOM
  art/             Guía de arte y generación de texturas (personajes, mobiliario, niveles, paisaje)
  world/           Escena del mundo: capas por nivel, predicción, interpolación, niebla, cámaras
  ui/              Menús, sala, ajustes, HUD, mapa, reuniones, finales
  minigames/       Más de 40 minijuegos en Canvas 2D (tareas, reparaciones y preparación del arma)
  audio/           Sonido sintetizado (ambiente por vehículo, alarmas, interfaz, música)
tests/             Pruebas de Vitest
scripts/           Validación de mapas y clientes de prueba
docs/              Arquitectura, planos dimensionales y guía de arte
```

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/GUIA_ARTE.md](docs/GUIA_ARTE.md).

## Verificación realizada y limitaciones

Comprobado en este entorno:

- `npm run typecheck`, `npm test` (59 pruebas) y `npm run validate:maps` sin errores.
- Compilación de producción y servidor real: menú, creación de sala, sala de espera con 4 jugadores (un navegador + 3 clientes Socket.IO automáticos), inicio, carga del mapa con barra de progreso, tarjeta de rol, exploración, mapa ampliado y una reunión completa (convocatoria, discusión, chat, voto, resultados) capturados con Playwright en los tres vehículos.

No verificado, para ser transparentes:

- **Rendimiento**: el entorno de pruebas no tiene GPU (Chromium con SwiftShader por software), donde la escena va a unos pocos FPS. No hay mediciones en un PC con GPU ni en móviles; los objetivos de 60 FPS a 1080p están sin medir. El panel de diagnóstico (Ajustes → GRÁFICOS → Panel de diagnóstico) muestra FPS, tiempo de fotograma, ping, jitter y entidades para medirlo en un equipo real.
- **Red real**: las pruebas multijugador han sido en local (mismo equipo); no se ha probado con latencias de Internet reales ni con 12 navegadores simultáneos.
- **Móvil**: hay joystick, botones táctiles amplios y minijuegos con puntero unificado, pero no se ha probado en dispositivos físicos.
- La revisión visual se ha hecho sobre capturas de zonas representativas; puede haber detalles de acabado mejorables en salas concretas.
