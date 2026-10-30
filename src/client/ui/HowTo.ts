import { ROLES } from '../../shared/roles';
import { h, ICONS, modal } from './dom';
import { tip } from './SettingsUI';

export function showHowTo() {
  const roles = h('div', { class: 'roles-grid' }, ROLES.map((r) => h('div', { class: `rolebox ${r.team}` },
    h('div', { class: 'rh', html: ICONS[r.id] }, ), h('p', null, h('b', null, `${r.name}: `), r.desc))));
  roles.querySelectorAll('.rh').forEach((el, i) => el.append(h('h4', null, ROLES[i].name), h('span', { class: `badge ${ROLES[i].team}` }, ROLES[i].team === 'worker' ? 'TRABAJADOR' : 'IMPOSTOR')));
  modal('Cómo jugar', h('div', { class: 'col' },
    h('div', { class: 'howto' },
      tip('Dos modos', 'VIAJE (barco o avión) y SUPERMERCADO (edificio propio). En ambos juegan de 4 a 12 personas y siempre hay un único IMPOSTOR; el resto son TRABAJADORES.'),
      tip('Viaje · Trabajadores', 'Completad vuestras tareas y llegad a destino sin averías críticas, o expulsad al impostor en una votación.'),
      tip('Viaje · Impostor', 'Finge trabajar, sabotea en las instalaciones y sigue una cadena secreta de etapas (3, 5 o 7 según la dificultad) para conseguir el cuchillo y llegar hasta el responsable del viaje.'),
      tip('Responsable del viaje', 'La capitana del barco o el piloto del avión es un personaje no jugador. Si el impostor lo alcanza con el arma, el viaje termina en desastre.'),
      tip('Sabotajes', 'Apagón, comunicaciones y puertas complican el trabajo. Las averías críticas tienen cuenta atrás: si nadie las repara, el impostor gana.'),
      tip('Reuniones', 'Pulsa un botón de emergencia para reunir a todos, discutir y votar. Durante una avería crítica no se puede convocar.'),
      tip('Supermercado · Compra', 'Los trabajadores reciben el nombre de una comida; el impostor no. Cada uno coge UN ingrediente de las estanterías y lo entrega en caja antes del cierre. Nadie ve las compras hasta entonces.'),
      tip('Supermercado · Caja y votación', 'Al cierre, las compras pasan por caja una a una con quién las trajo. Después se discute y se vota. Quien no entregó nada aparece como SIN APORTE, pero no se le expulsa por ello.'),
      tip('Supermercado · Final', 'Si sale un inocente, se repite la compra con la misma comida y sin repetir producto propio. El impostor gana si queda solo con un trabajador activo. No hay trampillas ni especialidades.'),
      tip('Visión', 'Solo ves lo que tu línea de visión permite: las paredes, puertas y estanterías altas ocultan a las personas y sus nombres.'),
      tip('Expulsados', 'Quien es expulsado sigue como espectador: en el viaje puede terminar sus tareas; en el súper no compra. Nunca vota ni habla con los vivos.'),
    ),
    h('h3', null, 'Especialidades opcionales'),
    roles,
  ), { wide: true });
}
