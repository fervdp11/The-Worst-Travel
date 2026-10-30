# The Worst Travel

Juego multijugador de deducción social para navegador con dos modos:

- **VIAJE**, en dos mapas de una sola planta: **BARCO · El Ferry** y **AVIÓN · El Vuelo**. Entre 4 y 12 empleados atienden al pasaje y mantienen el vehículo en marcha; uno de ellos es el **IMPOSTOR**, que sabotea, sigue una cadena secreta para conseguir un cuchillo y quiere llegar hasta el responsable del viaje (la capitana o el piloto, un personaje no jugador).
- **SUPERMERCADO**, en su propio edificio: **SÚPER · El Carrito**. Todos los trabajadores reciben el nombre de la misma comida; el impostor no la conoce. Cada uno compra un ingrediente, las compras se revelan una a una en caja y se vota.

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

Pruebas de lógica con Vitest (72 casos). Además de votos, roles, tareas idempotentes, cadena del cuchillo, críticos, reuniones, desconexiones y resolución terminal, cubren: colisión de objetos sólidos desde todos los lados y en diagonal, oclusión de estanterías altas, polígono de visión exacto junto a muros, catálogo de 100 comidas y 150 productos, privacidad de la comida (el impostor nunca la recibe), compra/devolución/entrega con autoridad del servidor, SIN APORTE sin expulsión automática, revelación en caja uno a uno con historial, rondas tras expulsar a un inocente sin repetir producto propio, victoria del impostor con un solo trabajador activo (solo en el súper), abandono del impostor, flechas de trampilla solo hacia conexiones reales, plazos absolutos que no se reinician al reconectar, secuencia de resultados también sin expulsado, tareas por trabajador y migración de salas guardadas con el antiguo mapa del tren.

```bash
npm run typecheck
```

```bash
npm run validate:maps
```

Valida los tres planos (barco, avión, súper) y la sala de espera: una sola planta, accesibilidad a pie de todas las estaciones desde su lado accesible, holgura de las puertas, objetos dentro de su sala, trampillas, puntos de aparición, cadena del cuchillo y, en el súper, estanterías, caja, cola y salida.

```bash
node scripts/bots.mjs CODIGO 3
```

Une 3 clientes de prueba sin interfaz a una sala existente (útil para probar el multijugador con un solo navegador).

## Cómo jugar

- **CREAR SALA**: eliges primero el **modo** (VIAJE o SUPERMERCADO) y después el **mapa** de ese modo, las plazas (4–12) y, en el viaje, el preset de especialidades (CLÁSICO SIN ROLES, EQUILIBRADO, PERSONALIZADO). Compartes el código de 5 caracteres o el enlace (`?sala=CODIGO`).
- **UNIRSE CON CÓDIGO**: entras en una sala privada.
- **PRÁCTICA**: modo de un jugador claramente identificado, sin red (ejecuta la misma lógica del servidor dentro del navegador). Eliges mapa, bando y especialidad; en práctica también los trabajadores pueden provocar sabotajes para probarlos.
- En la **sala de espera** (vestíbulo de salidas) puedes moverte y chatear. La cabecera muestra modo, mapa, reglas y plazas; la lista de tripulación marca al anfitrión con una corona. **PERSONALIZAR** abre el vestuario (color, complemento y nombre) con vista previa y botones APLICAR/CANCELAR. Solo el anfitrión cambia ajustes (**AJUSTES DE SALA**: tarjetas MODO → MAPA y pestañas por modo) y pulsa **INICIAR** (mínimo 4 personas conectadas con el mapa cargado; cuenta atrás de 3 s).

### Supermercado

1. **Compra** (30–180 s, 90 por defecto): los trabajadores ven el nombre de la comida (solo el nombre, sin imagen ni ingredientes); el impostor ve «No conoces la comida · Dedúcela». Cada uno coge **un** producto de las estanterías (más de 100, por secciones) y lo entrega en la caja abierta. Se puede devolver a su estantería antes de entregar. Nadie ve lo que llevan los demás: solo una bolsa.
2. **Caja**: cuando todos han entregado o se agota el tiempo, cada aporte pasa por caja uno a uno (2–5 s cada uno) con el retrato de quien lo trajo. Quien no entregó aparece como **SIN APORTE**, sin expulsión automática.
3. **Discusión y votación** con el registro de aportes de todas las rondas a la vista.
4. **Resultados** siempre, también sin expulsado: NADIE HA SIDO EXPULSADO, EMPATE o SE HA SALTADO LA VOTACIÓN. Quien sale lo hace por la salida de emergencia en un carrito.
5. Si sale un inocente (o nadie), nueva compra con **la misma comida**; nadie puede repetir su propio producto. Los trabajadores ganan al expulsar al impostor; el impostor gana si queda solo con un trabajador activo. Los expulsados no compran ni votan. No hay trampillas, sabotajes ni especialidades en este modo.

### Controles

| Acción | Teclado | Táctil |
| --- | --- | --- |
| Moverse (8 direcciones) | WASD / flechas | Joystick |
| Usar / reparar / reunión / recoger, devolver o entregar en el súper | E | USAR / RECOGER |
| Ocultarse en taquilla | E (OCULTARSE) | OCULTARSE |
| Trampilla (entrar o salir; dentro, flechas en pantalla) | V | TRAMPILLA |
| Sabotear (impostor) | X | SABOTEAR |
| Atacar al responsable (impostor, al final) | T | ATACAR |
| Habilidad | Q (configurable) | HABILIDAD |
| Mapa | M / Tab | MAPA |
| Cerrar paneles | Escape | ✕ |
| Depuración (colisiones, contorno, salas) | F3 | — |

Mientras escribes en el chat o manejas un minijuego no se activan acciones del mundo.

## Reglas implementadas (modo Viaje)

- Un único impostor. Gana **solo** si un sabotaje crítico agota su plazo o si ataca al responsable tras completar la cadena del arma. La dificultad del cuchillo (FÁCIL, NORMAL, DIFÍCIL o PERSONALIZADA) cambia la cadena real: 3, 5 o 7 etapas, ayudas y dispersión por el mapa. No hay asesinatos de trabajadores ni victoria por paridad.
- Los trabajadores ganan expulsando al impostor o completando todas las tareas obligatorias (cantidad de tareas cortas y largas por trabajador configurable, con totales y validación de al menos una): entonces empieza la maniobra de llegada (puerto o aterrizaje), que se pausa si hay un crítico activo.
- Reuniones: convocatoria → discusión → votación (con confirmación y SALTAR) → resultados → secuencia de expulsión propia de cada mapa, que se reproduce **siempre**: sin expulsado muestra la misma escena vacía con la causa. Empate o SALTAR con el máximo: nadie es expulsado. Abstenerse no cuenta.
- Expulsados: espectadores fantasma con chat propio; pueden terminar sus tareas, no votan ni reparan.
- Sabotajes físicos (hay que ir a la instalación): apagón, comunicaciones, puertas y dos críticos distintos por mapa con reparación secuencial que una sola persona puede completar.
- Trampillas con red explícita y estados FUERA → ENTRANDO → DENTRO → VIAJANDO → SALIENDO: dentro se ven flechas grandes solo hacia las conexiones reales (sin nombres de destino), la vista se reduce al entorno inmediato y se sale con SALIR (o al agotar la estancia máxima). Taquillas para una persona con puerta animada y tiempo máximo.
- Cámaras fijas con encuadre real, oclusión y piloto visible; panel de ocupación; SIN SEÑAL con comunicaciones caídas.
- Trece especialidades opcionales con nombres canónicos idénticos en los dos mapas de viaje (7 de trabajador, 6 de impostor), todas configurables antes de iniciar.
- Un único reloj del servidor para todos los plazos (fases, compra, críticos): viajan como instantes absolutos, así que reconectar no reinicia nada.
- Chat con retrato de cada jugador hecho con el mismo compositor de personajes que el mundo, contador de caracteres, desplazamiento automático con aviso «NUEVOS MENSAJES», mensajes del sistema separados y texto siempre escapado. El impostor ve su propio nombre en rojo solo en su pantalla.
- Servidor autoritativo: el cliente solo envía intenciones. Visibilidad filtrada por observador (no se envían jugadores fuera de visión), identificadores opacos por observador (un disfraz o un señuelo no se delatan por su identificador), validación de distancia, línea de visión, prerrequisitos y duraciones mínimas en cada etapa de minijuego, acciones con identificador para descartar duplicados, reconexión con token y 30 s de margen.

## Estructura

```
src/shared/        Lógica compartida cliente/servidor
  maps/            Planos (barco, avión, súper, sala de espera), definición única de objetos, runtime de colisión/visión y validador
  market.ts        Catálogo del súper: 11 secciones, 150 productos y 100 comidas
  settings.ts      Ajustes, presets, validación y asignación de roles
  roles.ts         Trece especialidades y sus parámetros
  minigames.ts     Generación y validación de puzles de cada minijuego
  movement.ts      Paso fijo de movimiento (predicción del cliente = simulación del servidor)
  protocol.ts      Mensajes y tipos de red (versión de protocolo)
src/server/        Servidor Node.js + Socket.IO
  room/            Salas, sesiones, anfitrión, cuenta atrás, chat, sala de espera
  game/            Partida: fases, tareas, sabotajes, cuchillo, roles, visibilidad y modo Supermercado (market.ts)
src/client/        Cliente Phaser 3 (WebGL) + interfaz DOM
  art/             Guía de arte y generación de texturas (personajes y compositor único de complementos, mobiliario, productos, paisaje)
  world/           Escena del mundo: capas, predicción, interpolación, niebla con polígono exacto, contornos de interacción, cámaras
  ui/              Menús, sala, ajustes, HUD, mapa, reuniones, finales
  minigames/       Más de 30 minijuegos en Canvas 2D (tareas, reparaciones y preparación del arma)
  audio/           Sonido sintetizado (ambiente por mapa, alarmas, interfaz, música)
tests/             Pruebas de Vitest
scripts/           Validación de mapas y clientes de prueba
docs/              Arquitectura, planos dimensionales y guía de arte
```

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/GUIA_ARTE.md](docs/GUIA_ARTE.md).

## Verificación realizada y limitaciones

Comprobado en este entorno (Linux sin GPU, Chromium con SwiftShader por software):

- `npm run typecheck`, `npm test` (72 pruebas) y `npm run validate:maps` sin errores.
- Con Playwright sobre el servidor de desarrollo real:
  - **Sala en línea con 4 navegadores** (anfitrión + 3 invitados con su propio almacenamiento): creación con tarjetas MODO → MAPA, unión por código, cabecera de la sala, lista con corona, chat con retratos y texto HTML escapado, ajustes del Supermercado, vestuario con APLICAR/CANCELAR e inicio de una partida del súper. El impostor vio «No conoces la comida» y su nombre en rojo solo en su pantalla; los otros tres vieron la misma comida.
  - **Supermercado en práctica**: estantería con sus productos, coger y devolver, entrega en caja, revelación en caja con retrato, discusión con registro de aportes, votación con SALTAR, secuencia de resultados sin expulsado y segunda ronda con la misma comida y el aviso de no repetir producto.
  - **Barco y avión** como trabajador e impostor: una sola planta, niebla con bordes rectos y caída suave, muebles completos y opacos, contornos amarillos (trabajo) y rojos (solo impostor), panel del objetivo secreto sin tapar el minimapa, trampilla completa (entrar, flechas, viajar, llegada, salir) y taquilla.
  - Cinemáticas de expulsión con y sin expulsado en los tres mapas, menú, «Cómo jugar» y la vista apaisada de móvil (844 × 390, táctil emulado).
  - Capturas en [docs/capturas](docs/capturas).

No verificado, para ser transparentes:

- **Las imágenes de referencia** que mencionaba el encargo no llegaron a esta sesión: las correcciones se basan en la descripción escrita de cada problema y en revisar capturas propias.
- **Rendimiento**: sin GPU la escena va a pocos FPS; no hay mediciones en un PC con GPU ni en móviles. El panel de diagnóstico (Ajustes → GRÁFICOS → Panel de diagnóstico) muestra FPS, tiempo de fotograma, ping y entidades para medirlo en un equipo real.
- **Red real**: las pruebas multijugador han sido en el mismo equipo; no se ha probado con latencias de Internet ni con 12 navegadores a la vez. Una partida completa del súper con 4 personas (votos reales y expulsión de un inocente) se ha probado en las pruebas automáticas del servidor, no con 4 navegadores hasta el final.
- **Móvil**: solo emulado en Chromium; no se ha probado en dispositivos físicos.
- La revisión visual cubre zonas representativas; puede haber detalles de acabado mejorables en salas concretas.
