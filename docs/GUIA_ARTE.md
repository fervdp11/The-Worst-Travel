# Guía de arte

Definida en código en `src/client/art/palette.ts` y aplicada por todos los generadores.

- **Estilo**: cartoon limpio, formas redondeadas, contorno de tinta violácea `#1d1830` (2,5 u en personajes, 2 u en mobiliario, 3–4 u en carcasas de minijuegos).
- **Luz**: principal desde el noroeste. Tapas claras, caras frontales en tono medio, sombras proyectadas moderadas hacia el sureste (desplazamiento 6, 4; alfa 0,16–0,24). Cada objeto tiene su tipo de sombra coherente con su forma (soporte del salvavidas, base del mástil, contacto de muebles); no se usan óvalos genéricos.
- **Perspectiva**: cenital oblicua. Muros horizontales con tapa de 14 u y cara de 42 u dentro de su propio grosor; muebles como cajas oblicuas (tapa + cara frontal) ordenadas por la línea de sus pies. Orden de capas: suelo → objetos planos → sombras → muebles y personajes por profundidad → niebla → interfaz.
- **Opacidad**: los muebles son siempre opacos y completos; no se vuelven transparentes al pasar por detrás.
- **Oclusión ambiental**: degradados en la base de muros y esquinas; iluminación de sala cálida (comedor, pasajeros, cocina), fría (técnicos) o tenue (despensas, bodegas).
- **Personajes**: cuerpo en forma de judía de 34 × 40 u con cara expresiva, cuello de uniforme, botones y un distintivo bordado distinto para cada color (no se depende solo del color). Doce colores y diez accesorios, compuestos siempre por el mismo compositor con anclajes de cabeza, ojos y cuello.
- **Materiales por vehículo**:
  - Barco: madera pintada crema, acero gris azulado, rojo náutico, teca, mar.
  - Avión: paneles claros, plásticos perla, aluminio, luz indirecta azulada.
  - Súper: baldosa clara, lineales blancos con franja roja, mostradores refrigerados azulados y productos dibujados con iconos propios por categoría.
- **Tipografía**: Baloo 2 (títulos y rótulos) y Nunito (texto), incluidas mediante `@fontsource` (licencia OFL).
- **Interfaz**: paneles azul noche con borde de tinta, botones con volumen sutil y estados de reposo, hover, pulsado, foco y deshabilitado; transiciones de 120–250 ms; iconos de trazo de una sola familia.
- **Efectos**: pilotos que parpadean, pantallas con brillo, vapor localizado, ventiladores, balizas. Sin bloom generalizado ni ruido aleatorio por fotograma. Opciones de reducir movimiento, desactivar sacudidas e intensidad de efectos.
- **Interacción**: contorno que sigue la silueta del objeto (amarillo trabajo o compra; rojo solo visible para el impostor), sin aros en el suelo.
