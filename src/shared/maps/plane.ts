import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef, NpcSeat } from './types';

/**
 * AVIÓN — EL VUELO (una sola cubierta jugable)
 * Morro a la izquierda. Fuselaje x 200–3520, y 150–915; interior y 216–884.
 *  - Cabina de mando en el morro (x 380–760).
 *  - Bloque delantero: Cocina (norte) · Pasillo de tripulación · Comunicaciones (sur).
 *  - Vestíbulo L1 · Cabina de pasajeros con doble pasillo · Vestíbulo trasero.
 *  - Bloque trasero: Aseos y Descanso (norte) · Pasillo de servicio · Seguridad y Equipos (sur).
 *  - Bodega de servicio en la cola.
 * Las alas y los motores son decorado exterior: se atienden desde paneles interiores.
 */
export const PLANE = {
  FUSELAGE: [
    { x: 200, y: 550 }, { x: 240, y: 430 }, { x: 330, y: 320 }, { x: 460, y: 230 }, { x: 620, y: 172 }, { x: 800, y: 150 },
    { x: 3150, y: 150 }, { x: 3330, y: 200 }, { x: 3470, y: 320 }, { x: 3520, y: 440 }, { x: 3520, y: 660 }, { x: 3470, y: 780 },
    { x: 3330, y: 870 }, { x: 3150, y: 915 }, { x: 800, y: 915 }, { x: 620, y: 900 }, { x: 460, y: 850 }, { x: 330, y: 780 },
    { x: 240, y: 670 }, { x: 200, y: 550 },
  ],
  WING_N: [{ x: 1650, y: 150 }, { x: 2450, y: -1050 }, { x: 2660, y: -1050 }, { x: 2300, y: 150 }],
  WING_S: [{ x: 1650, y: 915 }, { x: 2450, y: 2115 }, { x: 2660, y: 2115 }, { x: 2300, y: 915 }],
  ENGINES: [{ x: 2060, y: -380 }, { x: 2060, y: 1445 }],
  STAB_N: [{ x: 3180, y: 160 }, { x: 3420, y: -260 }, { x: 3520, y: -260 }, { x: 3420, y: 230 }],
  STAB_S: [{ x: 3180, y: 905 }, { x: 3420, y: 1325 }, { x: 3520, y: 1325 }, { x: 3420, y: 835 }],
};

export function buildPlane(): MapDef {
  const b = new MapBuilder();
  const P = 'cabin';
  const npcs: NpcSeat[] = [];

  // ================= FUSELAJE =================
  const win: number[] = [];
  for (let x = 830; x < 3120; x += 64) if (!(x > 1150 && x < 1320) && !(x > 2400 && x < 2570)) win.push(x);
  b.hwall(P, 780, 3170, 160, HW, { kind: 'hull', windows: win });
  b.hwall(P, 780, 3170, 884, 20, { kind: 'hull', face: false });
  b.hullPoly(P, [{ x: 790, y: 190 }, { x: 620, y: 214 }, { x: 480, y: 286 }, { x: 380, y: 400 }, { x: 340, y: 550 }, { x: 380, y: 700 }, { x: 480, y: 814 }, { x: 620, y: 886 }, { x: 790, y: 902 }], 20);
  b.hullPoly(P, [{ x: 3160, y: 190 }, { x: 3320, y: 252 }, { x: 3440, y: 366 }, { x: 3480, y: 470 }, { x: 3480, y: 630 }, { x: 3440, y: 734 }, { x: 3320, y: 848 }, { x: 3160, y: 902 }], 20);

  // ================= CABINA DE MANDO =================
  b.vwall(P, 760, 196, 902, VW, { kind: 'partition', openings: [{ at: 550, w: 90, door: { id: 'd_cabina', name: 'Puerta de la cabina de mando', lockable: true } }] });
  b.room('cockpit', 'Cabina de mando', P, R(380, 240, 380, 620), 'rubber', 'cold', '#5cc8ff', 'z_cockpit');
  b.prop(P, 'cockpitPanel', 430, 440, 60, 220, 40, { anim: 'screen' });
  b.prop(P, 'pilotSeat', 560, 466, 50, 50, 40);
  b.prop(P, 'pilotSeat', 560, 590, 50, 50, 40);
  b.st('assist_cockpit', P, 524, 404, 'task', 'Panel superior de cabina');
  b.prop(P, 'navDisplay', 640, 760, 90, 34, 40, { anim: 'screen' });
  b.st('crit_nav_confirm', P, 685, 724, 'repair', 'Alineación de navegación');
  b.prop(P, 'overheadPanel', 640, 300, 90, 34, 40, { anim: 'blink' });

  // ================= BLOQUE DELANTERO =================
  b.hwall(P, 778, 1150, 470, 30, { kind: 'partition', openings: [{ at: 964, door: { id: 'd_galley', name: 'Cocina delantera' } }] });
  b.hwall(P, 778, 1150, 600, 30, { kind: 'partition', openings: [{ at: 964, door: { id: 'd_comms', name: 'Comunicaciones', lockable: true } }] });
  b.vwall(P, 1150, 216, 884, VW, {
    kind: 'partition',
    openings: [
      { at: 343, w: 90, door: { id: 'd_galleyE', name: 'Cocina ↔ vestíbulo' } },
      { at: 550, w: 90 },
      { at: 757, w: 90, door: { id: 'd_commsE', name: 'Comunicaciones ↔ vestíbulo', lockable: true } },
    ],
  });
  b.room('galley', 'Cocina delantera', P, R(778, 216, 372, 254), 'tile', 'warm', '#ff9f43', 'z_galley');
  b.prop(P, 'galleyUnit', 800, 222, 110, 40, 44);
  b.st('cooking_galley', P, 855, 300, 'task', 'Hornos de la cocina');
  b.prop(P, 'coffeeMachine', 930, 222, 60, 30, 40, { anim: 'steam' });
  b.st('drink_galley', P, 960, 300, 'task', 'Cafetera');
  b.prop(P, 'sink', 1010, 222, 70, 40, 40, { anim: 'liquid' });
  b.st('dishes_galley', P, 1045, 300, 'task', 'Fregadero de la cocina');
  b.prop(P, 'trayRack', 800, 380, 90, 50, 40);
  b.st('orders_pick', P, 925, 404, 'task', 'Bandejas de comidas');
  b.prop(P, 'cartBay', 1040, 410, 90, 50, 40);
  b.st('carts_galley', P, 1010, 380, 'task', 'Carros de servicio');
  b.prop(P, 'knifeDrawer', 1090, 222, 50, 30, 34);
  b.st('k_keypad_galley', P, 1112, 286, 'knife', 'Cajón de cubiertos con combinación');
  b.prop(P, 'vent', 790, 300, 40, 30, 2, { solid: false, flat: true });

  b.room('crewcorr', 'Pasillo de tripulación', P, R(778, 500, 372, 100), 'carpet', 'neutral', '#d4a373', 'z_galley');
  b.prop(P, 'accessPanel', 800, 486, 40, 10, 30, { solid: false, mount: 'wall' });
  b.st('k_auth_cabina', P, 820, 532, 'knife', 'Panel de acceso a la cabina de mando');

  b.room('comms', 'Comunicaciones', P, R(778, 630, 372, 254), 'lino', 'cold', '#7bdff2', 'z_comms');
  b.prop(P, 'radioDesk', 790, 652, 120, 48, 42, { anim: 'screen' });
  b.st('rep_comms', P, 850, 744, 'repair', 'Radio de cabina');
  b.prop(P, 'commsTerminal', 1030, 652, 90, 32, 44, { anim: 'screen' });
  b.st('term_radio', P, 1075, 726, 'commsTerminal', 'Terminal de comunicaciones');
  b.prop(P, 'cableRack', 790, 800, 40, 60, 48, { anim: 'blink' });
  b.st('sab_comms', P, 858, 830, 'sabotage', 'Repartidor de antenas');
  b.prop(P, 'crewBinder', 1000, 840, 60, 34, 30);
  b.st('k_docs_partes', P, 1030, 816, 'knife', 'Partes de vuelo');
  b.prop(P, 'vent', 1080, 845, 40, 30, 2, { solid: false, flat: true });

  // ================= VESTÍBULO L1 =================
  b.vwall(P, 1300, 216, 884, VW, { kind: 'partition', openings: [{ at: 414, w: 100 }, { at: 676, w: 100 }] });
  b.room('vestL1', 'Vestíbulo L1', P, R(1168, 216, 132, 668), 'carpet', 'warm', '#ffb347', 'z_vest');
  b.prop(P, 'emergencyButton', 1212, 216, 44, 16, 40);
  b.st('btn1', P, 1234, 272, 'emergency', 'Botón de emergencia');
  b.prop(P, 'magazineRack', 1172, 404, 26, 90, 40);
  b.st('k_docs_revista', P, 1222, 449, 'knife', 'Revistero de a bordo');
  b.prop(P, 'doorPanel', 1190, 846, 70, 30, 40);
  b.st('crit_pressure_seal', P, 1225, 816, 'repair', 'Panel de la puerta L1');

  // ================= CABINA DE PASAJEROS =================
  b.vwall(P, 2400, 216, 884, VW, { kind: 'partition', openings: [{ at: 414, w: 100 }, { at: 676, w: 100 }] });
  b.room('pasaje', 'Cabina de pasajeros', P, R(1318, 216, 1082, 668), 'carpet', 'warm', '#d4a373', 'z_pasaje');
  let row = 0;
  for (let x = 1340; x + 44 < 2392; x += 64) {
    if (x + 44 > 1810 && x < 1900) continue;
    b.prop(P, 'seatRow', x, 240, 44, 120, 34, { variant: 3 });
    b.prop(P, 'seatRow', x, 476, 44, 150, 34, { variant: 4 });
    b.prop(P, 'seatRow', x, 734, 44, 120, 34, { variant: 3 });
    const acts = ['read', 'sleep', 'window', 'phone', 'talk', 'order'] as const;
    if (row % 2 === 0) npcs.push({ id: `n_pN${row}`, level: P, x: x + 22, y: 300 + (row % 4) * 10, facing: -1, pose: 'sit', act: acts[row % acts.length] });
    if (row % 3 === 1) npcs.push({ id: `n_pC${row}`, level: P, x: x + 22, y: 530, facing: -1, pose: 'sit', act: acts[(row + 2) % acts.length] });
    if (row % 2 === 1) npcs.push({ id: `n_pS${row}`, level: P, x: x + 22, y: 790, facing: -1, pose: 'sit', act: acts[(row + 4) % acts.length] });
    row++;
  }
  b.prop(P, 'overheadBins', 1340, 206, 460, 10, 40, { solid: false });
  b.prop(P, 'overheadBins', 1900, 206, 480, 10, 40, { solid: false });
  b.st('orders_s1', P, 1520, 414, 'task', 'Fila 4 (pasillo norte)');
  b.st('orders_s2', P, 2110, 414, 'task', 'Fila 12 (pasillo norte)');
  b.st('orders_s3', P, 1640, 676, 'task', 'Fila 6 (pasillo sur)');
  b.st('orders_s4', P, 2260, 676, 'task', 'Fila 14 (pasillo sur)');
  b.st('luggage_binsF', P, 1400, 414, 'task', 'Compartimentos delanteros');
  b.st('luggage_binsR', P, 2320, 414, 'task', 'Compartimentos traseros');
  b.st('k_key_bolsillo', P, 1980, 676, 'knife', 'Bolsillo del asiento 9C');
  b.prop(P, 'vent', 1835, 385, 40, 30, 2, { solid: false, flat: true });
  b.prop(P, 'vent', 1835, 685, 40, 30, 2, { solid: false, flat: true });

  // ================= VESTÍBULO TRASERO =================
  b.vwall(P, 2550, 216, 884, VW, { kind: 'partition', openings: [{ at: 550, w: 90 }] });
  b.room('vestR', 'Vestíbulo trasero', P, R(2418, 216, 132, 668), 'carpet', 'neutral', '#ffd166', 'z_vest');
  b.prop(P, 'jumpSeat', 2430, 226, 40, 36, 36);
  b.st('k_key_carrito', P, 2450, 300, 'knife', 'Asiento plegable de tripulación');
  b.prop(P, 'airPack', 2522, 250, 26, 80, 50);
  b.st('filter_vent', P, 2500, 336, 'task', 'Filtro de aire acondicionado');
  b.prop(P, 'valvePanel', 2522, 760, 26, 80, 50);
  b.st('pressure_hyd', P, 2496, 800, 'task', 'Válvulas hidráulicas');

  // ================= BLOQUE TRASERO =================
  b.hwall(P, 2568, 3150, 470, 30, { kind: 'partition', openings: [{ at: 2684, w: 80, door: { id: 'd_aseos', name: 'Aseos' } }, { at: 2984, door: { id: 'd_descanso', name: 'Descanso de tripulación', lockable: true } }] });
  b.hwall(P, 2568, 3150, 600, 30, { kind: 'partition', openings: [{ at: 2610, w: 80, door: { id: 'd_seg', name: 'Seguridad', lockable: true } }, { at: 2984, door: { id: 'd_equipos', name: 'Equipos eléctricos', lockable: true } }] });
  b.vwall(P, 2800, 216, 470, VW, { kind: 'partition' });
  b.vwall(P, 2800, 630, 884, VW, { kind: 'partition' });
  b.vwall(P, 3150, 196, 902, VW, { kind: 'partition', openings: [{ at: 550, w: 90, door: { id: 'd_bodega', name: 'Bodega de servicio', lockable: true } }] });

  b.room('aseos', 'Aseos', P, R(2568, 216, 232, 254), 'tile', 'cold', '#7bdff2', 'z_aseos');
  b.prop(P, 'toilet', 2590, 226, 40, 40, 30);
  b.prop(P, 'toilet', 2740, 226, 40, 40, 30);
  b.prop(P, 'washbasin', 2652, 222, 64, 26, 30);
  b.st('toilet_lav1', P, 2610, 300, 'task', 'Aseo izquierdo');
  b.st('toilet_lav2', P, 2760, 300, 'task', 'Aseo derecho');
  b.prop(P, 'cleanLocker', 2580, 380, 40, 60, 70);
  b.st('locker_aseo', P, 2648, 410, 'locker', 'Armario de limpieza');
  b.prop(P, 'trash', 2760, 420, 30, 30, 34);
  b.st('k_key_aseo', P, 2740, 380, 'knife', 'Papelera del aseo');

  b.room('descanso', 'Descanso de tripulación', P, R(2818, 216, 332, 254), 'parquet', 'warm', '#ff8a3d', 'z_descanso');
  b.prop(P, 'meetingTable', 2900, 320, 160, 80, 34);
  b.prop(P, 'emergencyButton', 2830, 216, 44, 16, 40);
  b.st('btn2', P, 2852, 272, 'emergency', 'Botón de emergencia');
  b.prop(P, 'locker', 3080, 234, 50, 30, 74);
  b.st('locker_crew', P, 3105, 310, 'locker', 'Taquilla de tripulación');
  b.prop(P, 'noticeBoard', 2960, 206, 56, 12, 46, { solid: false, mount: 'wall' });
  b.st('k_docs_tablon', P, 2988, 268, 'knife', 'Tablón de turnos');
  b.prop(P, 'crewLog', 2830, 400, 50, 34, 30);
  b.st('k_ledger_descanso', P, 2905, 432, 'knife', 'Registro de tripulación');
  b.prop(P, 'vent', 3090, 420, 40, 30, 2, { solid: false, flat: true });

  b.room('servicio', 'Pasillo de servicio', P, R(2568, 500, 582, 100), 'rubber', 'neutral', '#adb5bd', 'z_serv');
  b.prop(P, 'wallScreen', 2740, 490, 50, 10, 30, { solid: false, mount: 'wall', anim: 'screen' });
  b.st('term_av', P, 2765, 536, 'commsTerminal', 'Repetidor de señal');

  b.room('seguridad', 'Seguridad', P, R(2568, 630, 232, 254), 'lino', 'cold', '#9ad1ff', 'z_seg');
  b.prop(P, 'monitors', 2670, 652, 110, 40, 46, { anim: 'screen' });
  b.st('cams_seg', P, 2725, 738, 'cameras', 'Monitores de cámaras');
  b.prop(P, 'occupancyPanel', 2572, 720, 26, 80, 46, { anim: 'screen' });
  b.st('occ_seg', P, 2622, 760, 'occupancy', 'Panel de ocupación');
  b.prop(P, 'accessControl', 2580, 836, 90, 40, 36, { anim: 'blink' });
  b.st('sab_doors', P, 2625, 808, 'sabotage', 'Control de accesos');
  b.prop(P, 'deskDrawer', 2700, 836, 90, 46, 34);
  b.st('k_key_seg', P, 2745, 808, 'knife', 'Mesa de seguridad');
  b.prop(P, 'vent', 2740, 780, 40, 30, 2, { solid: false, flat: true });

  b.room('equipos', 'Equipos eléctricos', P, R(2818, 630, 332, 254), 'grate', 'cold', '#ffd23f', 'z_equipos');
  b.prop(P, 'powerPanel', 2830, 656, 80, 30, 50, { anim: 'blink' });
  b.st('rep_lights', P, 2870, 730, 'repair', 'Cuadro eléctrico');
  b.prop(P, 'wiringPanel', 3050, 656, 90, 30, 50);
  b.st('wiring_ee', P, 3095, 730, 'task', 'Panel de cableado');
  b.prop(P, 'fuseBox', 2822, 770, 34, 60, 48);
  b.st('fuses_ee', P, 2882, 800, 'task', 'Caja de fusibles');
  b.prop(P, 'avionicsRack', 2930, 846, 90, 34, 70, { anim: 'blink' });
  b.st('sab_nav', P, 2975, 786, 'sabotage', 'Rack de aviónica');
  b.prop(P, 'navComputer', 3040, 850, 70, 30, 40, { anim: 'screen' });
  b.st('crit_nav_power', P, 3075, 818, 'repair', 'Distribución de navegación');
  b.prop(P, 'junctionBox', 3112, 760, 34, 50, 40);
  b.st('sab_lights', P, 3084, 760, 'sabotage', 'Caja de empalmes');
  b.st('k_comp_rack', P, 2930, 740, 'knife', 'Compartimento del rack');
  b.prop(P, 'toolChest', 2826, 880 - 34, 50, 34, 30);
  b.st('k_tool_eq', P, 2896, 856, 'knife', 'Caja de herramientas');

  // ================= BODEGA DE SERVICIO (cola) =================
  b.room('bodega', 'Bodega de servicio', P, R(3168, 330, 272, 440), 'concrete', 'dim', '#f4a261', 'z_bodega');
  b.prop(P, 'conveyor', 3200, 362, 170, 40, 30);
  b.st('sorting_bodega', P, 3285, 430, 'task', 'Cinta de equipaje');
  b.st('k_comp_bodega', P, 3200, 430, 'knife', 'Panel de mantenimiento de la cinta');
  b.prop(P, 'pressurePanel', 3396, 480, 30, 90, 44);
  b.st('cabinPressure_panel', P, 3364, 525, 'task', 'Unidad de presurización');
  b.prop(P, 'uld', 3250, 560, 70, 56, 70);
  b.st('k_keypad_uld', P, 3285, 642, 'knife', 'Contenedor con combinación');
  b.prop(P, 'outflowValves', 3190, 700, 80, 44, 44);
  b.st('crit_pressure_valves', P, 3230, 670, 'repair', 'Válvulas de flujo');
  b.prop(P, 'outflowControl', 3320, 700, 60, 40, 40);
  b.st('sab_pressure', P, 3350, 668, 'sabotage', 'Control de salida de aire');
  b.st('k_tool_bodega', P, 3384, 432, 'knife', 'Arcón de herramientas de la bodega');
  b.prop(P, 'toolChest', 3380, 362, 40, 30, 30);
  b.prop(P, 'vent', 3190, 470, 40, 30, 2, { solid: false, flat: true });

  // ================= TRAMPILLAS =================
  const vents = [
    { id: 'v_galley', name: 'Trampilla de la cocina', level: P, x: 810, y: 315, links: ['v_comms', 'v_cabinN'] },
    { id: 'v_comms', name: 'Trampilla de comunicaciones', level: P, x: 1100, y: 860, links: ['v_galley', 'v_cabinS'] },
    { id: 'v_cabinN', name: 'Trampilla del pasillo norte', level: P, x: 1855, y: 400, links: ['v_galley', 'v_descanso'] },
    { id: 'v_cabinS', name: 'Trampilla del pasillo sur', level: P, x: 1855, y: 700, links: ['v_comms', 'v_seg'] },
    { id: 'v_descanso', name: 'Trampilla del descanso', level: P, x: 3110, y: 435, links: ['v_cabinN', 'v_bodega'] },
    { id: 'v_seg', name: 'Trampilla de seguridad', level: P, x: 2760, y: 795, links: ['v_cabinS', 'v_bodega'] },
    { id: 'v_bodega', name: 'Trampilla de la bodega', level: P, x: 3210, y: 485, links: ['v_descanso', 'v_seg'] },
  ];
  for (const v of vents) b.st(v.id, v.level, v.x, v.y, 'vent', v.name, { range: 56 });

  return b.finish({
    id: 'plane',
    name: 'Avión · El Vuelo',
    levels: [{ id: P, name: 'Cubierta', index: 0, bounds: R(-200, -300, 4000, 1700), outline: [PLANE.FUSELAGE] }],
    vents,
    escapistLinks: [['v_galley', 'v_bodega'], ['v_cabinN', 'v_seg']],
    cameras: [
      { id: 'cam1', name: 'Pasaje delantero', level: P, x: 1309, y: 300, view: R(1318, 216, 580, 326) },
      { id: 'cam2', name: 'Pasaje trasero', level: P, x: 2409, y: 800, view: R(1820, 558, 580, 326) },
      { id: 'cam3', name: 'Vestíbulo L1', level: P, x: 1159, y: 250, view: R(900, 216, 520, 292) },
      { id: 'cam4', name: 'Pasillo de servicio', level: P, x: 2559, y: 500, view: R(2560, 420, 600, 338) },
    ],
    zones: [
      { id: 'z_cockpit', name: 'Cabina de mando', level: P }, { id: 'z_galley', name: 'Cocina y tripulación', level: P },
      { id: 'z_comms', name: 'Comunicaciones', level: P }, { id: 'z_vest', name: 'Vestíbulos', level: P },
      { id: 'z_pasaje', name: 'Cabina de pasajeros', level: P }, { id: 'z_aseos', name: 'Aseos', level: P },
      { id: 'z_descanso', name: 'Descanso', level: P }, { id: 'z_serv', name: 'Pasillo de servicio', level: P },
      { id: 'z_seg', name: 'Seguridad', level: P }, { id: 'z_equipos', name: 'Equipos eléctricos', level: P },
      { id: 'z_bodega', name: 'Bodega de servicio', level: P },
    ],
    doorGroups: [
      { id: 'dg_proa', name: 'Delantera: cabina y comunicaciones', doors: ['d_cabina', 'd_comms', 'd_commsE'] },
      { id: 'dg_popa', name: 'Trasera: descanso, seguridad y equipos', doors: ['d_descanso', 'd_seg', 'd_equipos'] },
      { id: 'dg_bodega', name: 'Bodega de servicio', doors: ['d_bodega', 'd_equipos'] },
    ],
    interference: [
      { station: 'term_radio', name: 'Delantera', cameras: ['cam1', 'cam3'], zones: ['z_cockpit', 'z_galley', 'z_comms', 'z_vest', 'z_pasaje'], stations: ['cams_seg', 'occ_seg'] },
      { station: 'term_av', name: 'Trasera', cameras: ['cam2', 'cam4'], zones: ['z_aseos', 'z_descanso', 'z_serv', 'z_seg', 'z_equipos', 'z_bodega'], stations: ['cams_seg', 'occ_seg'] },
    ],
    sabotages: [
      { id: 'lights', kind: 'lights', name: 'Apagón', activation: ['sab_lights'], repair: [{ stations: ['rep_lights'], minigame: 'rep_lights', label: 'Restablecer el cuadro (Equipos eléctricos)' }], alarm: 'lights' },
      { id: 'comms', kind: 'comms', name: 'Comunicaciones', activation: ['sab_comms'], repair: [{ stations: ['rep_comms'], minigame: 'rep_comms', label: 'Sintonizar la radio (Comunicaciones)' }], alarm: 'comms' },
      { id: 'doors', kind: 'doors', name: 'Puertas', activation: ['sab_doors'], repair: [], alarm: 'doors' },
      {
        id: 'pressure', kind: 'critical', name: 'Pérdida de presión', activation: ['sab_pressure'],
        repair: [
          { stations: ['crit_pressure_valves'], minigame: 'crit_valves', label: 'Restablecer las válvulas (Bodega de servicio)' },
          { stations: ['crit_pressure_seal'], minigame: 'crit_seal', label: 'Confirmar el sellado (Vestíbulo L1)' },
        ],
        failTitle: 'Despresurización', failText: 'La cabina perdió la presión y El Vuelo tuvo que bajar a toda prisa hasta un amerizaje desastroso.', failScene: 'crash', alarm: 'critical',
      },
      {
        id: 'nav', kind: 'critical', name: 'Fallo eléctrico de navegación', activation: ['sab_nav'],
        repair: [
          { stations: ['crit_nav_power'], minigame: 'crit_power', label: 'Recomponer la distribución (Equipos eléctricos)' },
          { stations: ['crit_nav_confirm'], minigame: 'crit_navalign', label: 'Confirmar en la cabina de mando' },
        ],
        failTitle: 'Vuelo a ciegas', failText: 'Sin navegación, El Vuelo se adentró en la tormenta y perdió el control.', failScene: 'crash', alarm: 'critical',
      },
    ],
    tasks: [
      { id: 'orders', type: 'orders', name: 'Servir comidas', length: 'long', stages: [{ stations: ['orders_pick'], label: 'Recoge la bandeja (Cocina delantera)' }, { stations: ['orders_s1', 'orders_s2', 'orders_s3', 'orders_s4'], label: 'Sirve al pasajero de la fila' }] },
      { id: 'cooking', type: 'cooking', name: 'Calentar menús', length: 'short', stages: [{ stations: ['cooking_galley'], label: 'Prepara los menús en los hornos (Cocina delantera)' }] },
      { id: 'drink', type: 'drink', name: 'Servir café', length: 'short', stages: [{ stations: ['drink_galley'], label: 'Sirve café (Cocina delantera)' }] },
      { id: 'dishes', type: 'dishes', name: 'Fregar vajilla', length: 'short', stages: [{ stations: ['dishes_galley'], label: 'Friega (Cocina delantera)' }] },
      { id: 'toilet', type: 'toilet', name: 'Limpiar aseo', length: 'short', stages: [{ stations: ['toilet_lav1', 'toilet_lav2'], label: 'Limpia y repón un aseo (Aseos)' }] },
      { id: 'wiring', type: 'wiring', name: 'Reparar cableado', length: 'short', stages: [{ stations: ['wiring_ee'], label: 'Une los cables (Equipos eléctricos)' }] },
      { id: 'fuses', type: 'fuses', name: 'Cambiar fusible', length: 'short', stages: [{ stations: ['fuses_ee'], label: 'Sustituye el fusible (Equipos eléctricos)' }] },
      { id: 'pressure', type: 'pressure', name: 'Ajustar hidráulica', length: 'short', stages: [{ stations: ['pressure_hyd'], label: 'Ajusta las válvulas hidráulicas (Vestíbulo trasero)' }] },
      { id: 'filter', type: 'filter', name: 'Limpiar filtro de aire', length: 'long', stages: [{ stations: ['filter_vent'], label: 'Extrae, limpia y reinstala el filtro (Vestíbulo trasero)' }] },
      { id: 'assist', type: 'assist', name: 'Asistir al piloto', length: 'short', stages: [{ stations: ['assist_cockpit'], label: 'Reproduce la secuencia del panel (Cabina de mando)' }] },
      { id: 'luggage', type: 'luggage', name: 'Ordenar compartimentos', length: 'short', stages: [{ stations: ['luggage_binsF', 'luggage_binsR'], label: 'Coloca el equipaje de mano (Cabina de pasajeros)' }] },
      { id: 'carts', type: 'carts', name: 'Asegurar carros', length: 'short', exclusive: true, stages: [{ stations: ['carts_galley'], label: 'Bloquea los carros (Cocina delantera)' }] },
      { id: 'sorting', type: 'sorting', name: 'Clasificar equipaje', length: 'short', exclusive: true, stages: [{ stations: ['sorting_bodega'], label: 'Clasifica maletas por destino (Bodega de servicio)' }] },
      { id: 'cabinPressure', type: 'cabinPressure', name: 'Calibrar presurización', length: 'long', exclusive: true, stages: [{ stations: ['cabinPressure_panel'], label: 'Calibra la unidad de presión (Bodega de servicio)' }, { stations: ['crit_pressure_seal'], label: 'Verifica el panel de la puerta L1' }] },
    ],
    knife: {
      docName: 'los partes de vuelo manipulados',
      keyName: 'la llave de precintos',
      toolName: 'la llave de servicio',
      compartmentName: 'el compartimento de mantenimiento',
      ledgerName: 'el registro de tripulación',
      containerName: 'el contenedor con combinación',
      authName: 'el código de acceso a la cabina',
      pools: {
        docs: ['k_docs_partes', 'k_docs_tablon', 'k_docs_revista'],
        search: ['k_key_bolsillo', 'k_key_carrito', 'k_key_aseo', 'k_key_seg'],
        tool: ['k_tool_eq', 'k_tool_bodega'],
        compartment: ['k_comp_rack', 'k_comp_bodega'],
        ledger: ['k_ledger_descanso'],
        keypad: ['k_keypad_galley', 'k_keypad_uld'],
        auth: ['k_auth_cabina'],
      },
    },
    responsible: {
      title: 'Piloto', name: 'Piloto Okafor', level: P, room: 'cockpit',
      patrol: [{ x: 650, y: 420 }, { x: 700, y: 550 }, { x: 650, y: 680 }, { x: 600, y: 550 }],
    },
    npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: P, x: 1360 + k * 70, y: 400 }, { level: P, x: 1360 + k * 70, y: 690 }]),
    safePoints: [],
    meetingRoom: 'descanso',
    texts: {
      vehicle: 'El Vuelo',
      short: 'AVIÓN',
      description: 'Avión de fuselaje ancho en una sola cubierta: cabina de mando, doble pasillo y zona técnica en la cola.',
      routes: 'Doble pasillo, dos vestíbulos transversales y siete trampillas de servicio.',
      arrivalTitle: 'Aterrizaje perfecto',
      arrivalText: 'El Vuelo toma tierra con suavidad. Aplausos en la cabina.',
      murderTitle: 'Avión sin piloto',
      murderText: 'Sin nadie a los mandos, El Vuelo entra en barrena y se estrella de forma muy aparatosa.',
      accessGoal: 'Accede al piloto',
      approach: 'Aproximación final',
      ejectText: 'La compuerta de servicio se abre y…',
    },
    critTimeScale: 0.95,
    theme: {
      scenery: 'sky', bg: '#8ec5ff', hull: '#e9eef5', hullDark: '#b8c3d3', trim: '#2f6fb3',
      wallTop: '#4a5568', wallFace: '#eef1f6', wallFaceDark: '#cdd5e1', accent: '#2f6fb3', metal: '#c0c8d4',
    },
  });
}
