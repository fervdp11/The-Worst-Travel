import { ROLES } from '../../shared/roles';
import { h, ICONS, modal } from './dom';
import { tip } from './SettingsUI';

export function showHowTo() {
  const roles = h('div', { class: 'roles-grid' }, ROLES.map((r) => h('div', { class: `rolebox ${r.team}` },
    h('div', { class: 'rh', html: ICONS[r.id] }, ), h('p', null, h('b', null, `${r.name}: `), r.desc))));
  roles.querySelectorAll('.rh').forEach((el, i) => el.append(h('h4', null, ROLES[i].name), h('span', { class: `badge ${ROLES[i].team}` }, ROLES[i].team === 'worker' ? 'TRABAJADOR' : 'IMPOSTOR')));
  modal('Cómo jugar', h('div', { class: 'col' },
    h('div', { class: 'howto' },
      tip('El viaje', 'Entre 4 y 12 empleados trabajan en un tren, un barco o un avión. Uno de ellos es el IMPOSTOR. El resto son TRABAJADORES.'),
      tip('Trabajadores', 'Completad vuestras tareas y llegad a destino sin averías críticas, o expulsad al impostor en una votación.'),
      tip('Impostor', 'Finge trabajar, sabotea en las instalaciones y sigue una cadena secreta de cinco pasos para conseguir el cuchillo y llegar hasta el responsable del viaje.'),
      tip('Responsable del viaje', 'El conductor, la capitana o el piloto es un personaje no jugador. Si el impostor lo alcanza con el arma, el viaje termina en desastre.'),
      tip('Sabotajes', 'Apagón, comunicaciones y puertas complican el trabajo. Las averías críticas tienen cuenta atrás: si nadie las repara, el impostor gana.'),
      tip('Reuniones', 'Pulsa un botón de emergencia para reunir a todos, discutir y votar. Durante una avería crítica no se puede convocar.'),
      tip('Visión', 'Solo ves lo que tu línea de visión permite: las paredes y puertas ocultan a las personas y sus nombres.'),
      tip('Expulsados', 'Quien es expulsado sigue como espectador: puede terminar sus tareas, pero no votar ni hablar con los vivos.'),
    ),
    h('h3', null, 'Especialidades opcionales'),
    roles,
  ), { wide: true });
}
