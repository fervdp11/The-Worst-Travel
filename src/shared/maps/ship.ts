import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef, NpcSeat } from './types';

/**
 * BARCO — EL FERRY (una sola cubierta jugable)
 * Proa a la izquierda. Casco x 60–3480, y 40–1060. Interior x 718–3082,
 * y 206–930, con un pasillo central (y 516–606) que recorre todo el barco:
 *  - fila norte: Puente · Salón de pasajeros · Comedor · Cocina · Sala de personal
 *  - fila sur:   Radio · Baños · Seguridad · Electricidad · Máquinas · Almacén
 * Paseo exterior en la MISMA cubierta: proa, bandas norte/sur y popa.
 */
export const SHIP = {
  HULL: [
    { x: 60, y: 550 }, { x: 200, y: 360 }, { x: 420, y: 190 }, { x: 700, y: 70 }, { x: 900, y: 44 },
    { x: 3300, y: 44 }, { x: 3440, y: 50 }, { x: 3480, y: 110 }, { x: 3480, y: 990 }, { x: 3440, y: 1050 },
    { x: 3300, y: 1056 }, { x: 900, y: 1056 }, { x: 700, y: 1030 }, { x: 420, y: 910 }, { x: 200, y: 740 }, { x: 60, y: 550 },
  ],
};

export function buildShip(): MapDef {
  const b = new MapBuilder();
  const M = 'deck';
  const npcs: NpcSeat[] = [];

  // ================= CASCO, BORDAS Y PASEO EXTERIOR =================
  b.rail(M, [{ x: 700, y: 73 }, { x: 440, y: 196 }, { x: 230, y: 360 }, { x: 116, y: 550 }, { x: 230, y: 740 }, { x: 440, y: 904 }, { x: 700, y: 1027 }]);
  b.hullPoly(M, [{ x: 700, y: 58 }, { x: 420, y: 178 }, { x: 196, y: 352 }, { x: 70, y: 550 }, { x: 196, y: 748 }, { x: 420, y: 922 }, { x: 700, y: 1042 }], 22);
  b.hwall(M, 700, 3460, 52, 18, { kind: 'rail', occludes: false, face: false });
  b.hwall(M, 700, 3460, 1030, 18, { kind: 'rail', occludes: false, face: false });
  b.vwall(M, 3442, 52, 1048, 18, { kind: 'rail', occludes: false });
  b.room('proa', 'Cubierta de proa', M, R(130, 200, 570, 700), 'deck', 'exterior', '#6ec1e4', 'z_ext', [R(330, 120, 370, 80), R(330, 900, 370, 80)], true);
  b.room('bandaN', 'Banda de babor', M, R(700, 70, 2400, 80), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);
  b.room('bandaS', 'Banda de estribor', M, R(700, 950, 2400, 80), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);
  b.room('popa', 'Cubierta de popa', M, R(3100, 70, 342, 960), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);

  // Caja interior (muro norte con cara y ventanas; sur sin cara)
  const winN: number[] = [];
  for (let x = 790; x < 3060; x += 110) if (Math.abs(x - 1260) > 70 && Math.abs(x - 2960) > 70) winN.push(x);
  b.hwall(M, 700, 3100, 150, HW, {
    kind: 'hull', windows: winN,
    openings: [
      { at: 1260, door: { id: 'd_extN1', name: 'Puerta de babor del salón', lockable: true } },
      { at: 2960, door: { id: 'd_extN2', name: 'Puerta de babor del personal', lockable: true } },
    ],
  });
  b.hwall(M, 700, 3100, 930, 20, {
    kind: 'hull', face: false,
    openings: [
      { at: 934, door: { id: 'd_extS1', name: 'Puerta de estribor de la radio', lockable: true } },
      { at: 2900, door: { id: 'd_extS2', name: 'Puerta de estribor del almacén', lockable: true } },
    ],
  });
  b.vwall(M, 700, 206, 930, VW, { kind: 'hull', openings: [{ at: 561, w: 90, door: { id: 'd_proa', name: 'Puerta de proa', lockable: true } }] });
  b.vwall(M, 3082, 206, 930, VW, { kind: 'hull', openings: [{ at: 561, w: 90, door: { id: 'd_popa', name: 'Puerta de popa', lockable: true } }] });

  // ================= PASILLO CENTRAL =================
  b.hwall(M, 718, 3082, 486, 30, {
    kind: 'partition',
    openings: [
      { at: 934, door: { id: 'd_puente', name: 'Puente', lockable: true } },
      { at: 1409, w: 120 },
      { at: 1909, door: { id: 'd_comedor', name: 'Comedor', lockable: true } },
      { at: 2359, door: { id: 'd_cocina', name: 'Cocina' } },
      { at: 2825, door: { id: 'd_personal', name: 'Sala de personal', lockable: true } },
    ],
  });
  b.hwall(M, 718, 3082, 606, 30, {
    kind: 'partition',
    openings: [
      { at: 934, door: { id: 'd_radio', name: 'Radio', lockable: true } },
      { at: 1294, door: { id: 'd_banos', name: 'Baños' } },
      { at: 1619, door: { id: 'd_seg', name: 'Seguridad', lockable: true } },
      { at: 1984, door: { id: 'd_elec', name: 'Electricidad', lockable: true } },
      { at: 2385, door: { id: 'd_maq', name: 'Sala de máquinas', lockable: true } },
      { at: 2900, door: { id: 'd_alm', name: 'Almacén' } },
    ],
  });
  b.room('pasillo', 'Pasillo central', M, R(718, 516, 2364, 90), 'carpet', 'warm', '#d4a373', 'z_pasillo');

  // Tabiques fila norte
  b.vwall(M, 1150, 206, 486, VW, { kind: 'partition' });
  b.vwall(M, 1650, 206, 486, VW, { kind: 'partition', openings: [{ at: 346, w: 120 }] });
  b.vwall(M, 2150, 206, 486, VW, { kind: 'partition', openings: [{ at: 300, w: 90, door: { id: 'd_com_coc', name: 'Paso comedor-cocina' } }] });
  b.vwall(M, 2550, 206, 486, VW, { kind: 'partition' });
  // Tabiques fila sur
  b.vwall(M, 1150, 636, 930, VW, { kind: 'partition' });
  b.vwall(M, 1420, 636, 930, VW, { kind: 'partition' });
  b.vwall(M, 1800, 636, 930, VW, { kind: 'partition' });
  b.vwall(M, 2150, 636, 930, VW, { kind: 'partition', openings: [{ at: 800, w: 90, door: { id: 'd_elec_maq', name: 'Paso electricidad-máquinas' } }] });
  b.vwall(M, 2700, 636, 930, VW, { kind: 'partition', openings: [{ at: 800, w: 90, door: { id: 'd_maq_alm', name: 'Paso máquinas-almacén', lockable: true } }] });

  // ================= PUENTE =================
  b.room('puente', 'Puente de mando', M, R(718, 206, 432, 280), 'wood', 'cold', '#5cc8ff', 'z_puente');
  b.prop(M, 'radar', 740, 216, 120, 40, 46, { anim: 'screen' });
  b.st('crit_prop_bridge', M, 800, 296, 'repair', 'Telégrafo de máquinas');
  b.prop(M, 'helm', 900, 216, 90, 44, 44, { anim: 'blink' });
  b.st('assist_puente', M, 945, 300, 'task', 'Radar y timón');
  b.prop(M, 'chartTable', 1010, 226, 110, 56, 32);
  b.st('k_auth_puente', M, 1065, 326, 'knife', 'Consola de autorización del puente');
  b.prop(M, 'plant', 1112, 446, 30, 30, 50);

  // ================= SALÓN DE PASAJEROS =================
  b.room('salon', 'Salón de pasajeros', M, R(1168, 206, 482, 280), 'carpet', 'warm', '#ffb347', 'z_salon');
  b.prop(M, 'emergencyButton', 1410, 206, 44, 16, 40);
  b.st('btn1', M, 1432, 262, 'emergency', 'Botón de emergencia');
  b.prop(M, 'armchairSet', 1190, 300, 70, 110, 34);
  npcs.push({ id: 'n_sal1', level: M, x: 1225, y: 330, facing: 1, pose: 'sit', act: 'read' });
  b.prop(M, 'roundTable', 1310, 340, 70, 56, 32);
  b.st('orders_t1', M, 1345, 432, 'task', 'Mesa 1 del salón');
  npcs.push({ id: 'n_sal2', level: M, x: 1296, y: 372, facing: 1, pose: 'sit', act: 'order', station: 'orders_t1' });
  b.prop(M, 'bookShelf', 1500, 210, 80, 26, 50);
  b.st('k_key_revistero', M, 1540, 286, 'knife', 'Revistero del salón');
  b.prop(M, 'vent', 1580, 420, 40, 30, 2, { solid: false, flat: true });
  b.prop(M, 'plant', 1614, 214, 28, 28, 48);

  // ================= COMEDOR =================
  b.room('comedor', 'Comedor', M, R(1668, 206, 482, 280), 'parquet', 'warm', '#ff6b6b', 'z_salon');
  b.prop(M, 'roundTable', 1720, 250, 70, 56, 32);
  b.st('orders_t2', M, 1755, 346, 'task', 'Mesa 2 del comedor');
  npcs.push({ id: 'n_com1', level: M, x: 1706, y: 282, facing: 1, pose: 'sit', act: 'talk', station: 'orders_t2' });
  npcs.push({ id: 'n_com2', level: M, x: 1804, y: 282, facing: -1, pose: 'sit', act: 'order', station: 'orders_t2' });
  b.prop(M, 'roundTable', 1720, 380, 70, 56, 32);
  b.st('orders_t3', M, 1840, 410, 'task', 'Mesa 3 del comedor');
  npcs.push({ id: 'n_com3', level: M, x: 1706, y: 412, facing: 1, pose: 'sit', act: 'phone', station: 'orders_t3' });
  b.prop(M, 'barCounter', 1930, 236, 140, 44, 42);
  b.prop(M, 'coffeeMachine', 2010, 206, 60, 22, 40, { anim: 'steam' });
  b.st('drink_rest', M, 1990, 330, 'task', 'Barra del comedor');
  b.prop(M, 'menuBoard', 1880, 206, 60, 12, 40, { solid: false, mount: 'wall' });
  b.st('k_docs_carta', M, 1910, 268, 'knife', 'Pizarra de la carta');
  b.st('k_key_propinas', M, 2060, 330, 'knife', 'Bote de propinas de la barra');

  // ================= COCINA =================
  b.room('cocina', 'Cocina', M, R(2168, 206, 382, 280), 'tile', 'warm', '#ff9f43', 'z_cocina');
  b.prop(M, 'stove', 2190, 206, 80, 42, 42, { anim: 'steam' });
  b.st('cooking_coc', M, 2230, 290, 'task', 'Fogones');
  b.prop(M, 'sink', 2290, 206, 70, 42, 40, { anim: 'liquid' });
  b.st('dishes_coc', M, 2325, 290, 'task', 'Fregadero');
  b.prop(M, 'fridge', 2380, 218, 56, 40, 66);
  b.prop(M, 'passWindow', 2460, 206, 70, 42, 44);
  b.st('orders_pick', M, 2495, 290, 'task', 'Pase de comandas');
  b.prop(M, 'knifeDrawer', 2190, 380, 100, 36, 34);
  b.st('k_keypad_cocina', M, 2240, 456, 'knife', 'Cajón de cuchillos con combinación');
  b.prop(M, 'crewBinder', 2420, 400, 50, 30, 30);
  b.st('k_ledger_cocina', M, 2445, 460, 'knife', 'Libro de pedidos de la cocina');
  b.prop(M, 'vent', 2490, 330, 40, 30, 2, { solid: false, flat: true });

  // ================= SALA DE PERSONAL (reuniones) =================
  b.room('personal', 'Sala de personal', M, R(2568, 206, 514, 280), 'parquet', 'warm', '#ff8a3d', 'z_personal');
  b.prop(M, 'meetingTable', 2740, 300, 170, 84, 34);
  b.prop(M, 'emergencyButton', 2800, 206, 44, 16, 40);
  b.st('btn2', M, 2822, 262, 'emergency', 'Botón de emergencia');
  b.prop(M, 'locker', 2590, 224, 50, 30, 74);
  b.prop(M, 'locker', 2645, 224, 50, 30, 74);
  b.st('locker_pers', M, 2645, 300, 'locker', 'Taquilla del personal');
  b.prop(M, 'noticeBoard', 3010, 206, 56, 12, 46, { solid: false, mount: 'wall' });
  b.st('k_docs_tablon', M, 3038, 270, 'knife', 'Tablón de turnos');
  b.prop(M, 'crewLog', 2600, 420, 60, 34, 30);
  b.st('k_ledger_personal', M, 2700, 437, 'knife', 'Registro de guardias');
  b.prop(M, 'vent', 3020, 420, 40, 30, 2, { solid: false, flat: true });

  // ================= RADIO =================
  b.room('radio', 'Radio y comunicaciones', M, R(718, 636, 432, 294), 'lino', 'cold', '#7bdff2', 'z_radio');
  b.prop(M, 'radioDesk', 740, 652, 140, 48, 42, { anim: 'screen' });
  b.st('rep_comms', M, 810, 744, 'repair', 'Radio de a bordo');
  b.prop(M, 'commsTerminal', 1000, 652, 80, 32, 44, { anim: 'screen' });
  b.st('term_radio', M, 1040, 726, 'commsTerminal', 'Terminal de radio');
  b.prop(M, 'cableRack', 1092, 760, 40, 60, 48, { anim: 'blink' });
  b.st('sab_comms', M, 1060, 790, 'sabotage', 'Repartidor de antenas');
  b.prop(M, 'bookShelf', 740, 830, 90, 26, 50);
  b.st('k_docs_diario', M, 860, 843, 'knife', 'Diario de navegación');
  b.prop(M, 'vent', 1070, 870, 40, 30, 2, { solid: false, flat: true });

  // ================= BAÑOS =================
  b.room('banos', 'Baños', M, R(1168, 636, 252, 294), 'tile', 'cold', '#7bdff2', 'z_banos');
  b.prop(M, 'toilet', 1190, 850, 36, 40, 30);
  b.prop(M, 'toilet', 1360, 850, 36, 40, 30);
  b.prop(M, 'washbasin', 1172, 712, 30, 70, 30);
  b.st('toilet_banos', M, 1290, 760, 'task', 'Baños públicos');
  b.prop(M, 'medCabinet', 1360, 656, 50, 26, 50);
  b.st('k_key_botiquin', M, 1385, 736, 'knife', 'Botiquín');

  // ================= SEGURIDAD =================
  b.room('seguridad', 'Seguridad', M, R(1438, 636, 362, 294), 'lino', 'cold', '#9ad1ff', 'z_seg');
  b.prop(M, 'monitors', 1450, 652, 110, 40, 46, { anim: 'screen' });
  b.st('cams_seg', M, 1505, 738, 'cameras', 'Monitores de cámaras');
  b.prop(M, 'occupancyPanel', 1690, 652, 90, 20, 46, { anim: 'screen' });
  b.st('occ_seg', M, 1735, 718, 'occupancy', 'Panel de ocupación');
  b.prop(M, 'accessControl', 1460, 846, 100, 40, 40, { anim: 'blink' });
  b.st('sab_doors', M, 1510, 820, 'sabotage', 'Control de accesos');
  b.prop(M, 'deskDrawer', 1640, 846, 110, 46, 34);
  b.st('k_key_mesa', M, 1695, 820, 'knife', 'Mesa del oficial de seguridad');
  b.prop(M, 'vent', 1750, 760, 40, 30, 2, { solid: false, flat: true });

  // ================= ELECTRICIDAD =================
  b.room('electricidad', 'Electricidad', M, R(1818, 636, 332, 294), 'grate', 'cold', '#ffd23f', 'z_tec');
  b.prop(M, 'breakerPanel', 1830, 656, 80, 30, 50, { anim: 'blink' });
  b.st('rep_lights', M, 1870, 730, 'repair', 'Cuadro general');
  b.prop(M, 'wiringPanel', 2050, 656, 90, 30, 50);
  b.st('wiring_elec', M, 2095, 730, 'task', 'Panel de cableado');
  b.prop(M, 'fuseBox', 1822, 770, 34, 60, 48);
  b.st('fuses_elec', M, 1882, 800, 'task', 'Caja de fusibles');
  b.prop(M, 'junctionBox', 1900, 880, 70, 40, 36);
  b.st('sab_lights', M, 1935, 846, 'sabotage', 'Caja de empalmes');
  b.prop(M, 'cableRack', 2060, 870, 50, 40, 46, { anim: 'blink' });
  b.st('term_dist', M, 2040, 820, 'commsTerminal', 'Repetidor de señal');
  b.st('k_comp_elec', M, 2005, 884, 'knife', 'Compartimento del rack de cables');

  // ================= SALA DE MÁQUINAS =================
  b.room('maquinas', 'Sala de máquinas', M, R(2168, 636, 532, 294), 'metal', 'cold', '#ff7b54', 'z_tec');
  b.prop(M, 'engine', 2210, 690, 120, 80, 56, { anim: 'fan' });
  b.prop(M, 'engine', 2450, 690, 130, 80, 56, { anim: 'fan' });
  b.st('filter_maq', M, 2270, 812, 'task', 'Filtro del motor');
  b.prop(M, 'valvePanel', 2600, 656, 80, 30, 50);
  b.st('pressure_maq', M, 2640, 730, 'task', 'Válvulas de presión');
  b.prop(M, 'controlStand', 2590, 860, 60, 44, 40);
  b.st('crit_prop_stab', M, 2620, 830, 'repair', 'Control de propulsión');
  b.st('sab_prop', M, 2515, 816, 'sabotage', 'Regulador de la hélice');
  b.prop(M, 'bilgePump', 2186, 876, 64, 44, 40);
  b.st('bilge_maq', M, 2280, 892, 'task', 'Bomba de sentina');
  b.prop(M, 'pumpPanel', 2340, 880, 70, 40, 40);
  b.st('crit_leak_pumps', M, 2375, 846, 'repair', 'Bombas de achique');
  b.prop(M, 'toolChest', 2440, 890, 60, 30, 30);
  b.st('k_tool_maq', M, 2470, 862, 'knife', 'Arcón de herramientas');
  b.prop(M, 'vent', 2640, 775, 40, 30, 2, { solid: false, flat: true });

  // ================= ALMACÉN =================
  b.room('almacen', 'Almacén y bodega', M, R(2718, 636, 364, 294), 'concrete', 'dim', '#f4a261', 'z_alm');
  b.prop(M, 'luggageShelf', 2740, 684, 100, 30, 78);
  b.st('luggage_alm', M, 2790, 750, 'task', 'Estantería de equipaje');
  b.prop(M, 'crate', 2960, 656, 70, 50, 44);
  b.st('k_keypad_alm', M, 2995, 740, 'knife', 'Caja precintada con combinación');
  b.prop(M, 'watertightDoor', 3036, 642, 40, 10, 36, { solid: false, mount: 'wall' });
  b.st('seal_alm', M, 3060, 720, 'task', 'Junta de la puerta estanca');
  b.prop(M, 'hullPatch', 2740, 850, 90, 60, 2, { solid: false, flat: true });
  b.st('crit_leak_patch', M, 2785, 822, 'repair', 'Vía de agua');
  b.prop(M, 'seaValve', 2790, 900, 50, 26, 30);
  b.st('sab_leak', M, 2815, 870, 'sabotage', 'Válvula de fondo');
  b.prop(M, 'ballastPanel', 2960, 870, 90, 40, 40);
  b.st('ballast_alm', M, 3005, 840, 'task', 'Panel de lastre');
  b.st('k_comp_alm', M, 2950, 790, 'knife', 'Compartimento de mantenimiento');
  b.prop(M, 'vent', 3020, 772, 40, 30, 2, { solid: false, flat: true });

  // ================= EXTERIOR =================
  b.prop(M, 'winch', 380, 500, 90, 100, 36);
  b.prop(M, 'bollard', 270, 600, 30, 30, 24);
  b.prop(M, 'bollard', 560, 280, 30, 30, 24);
  b.prop(M, 'bollard', 560, 810, 30, 30, 24);
  b.prop(M, 'mast', 560, 540, 30, 30, 140, { anim: 'beacon' });
  b.prop(M, 'deckBox', 230, 470, 70, 46, 34);
  b.st('k_tool_proa', M, 265, 560, 'knife', 'Arcón del cabrestante');
  b.prop(M, 'deckBox', 300, 690, 64, 40, 34);
  b.st('locker_proa', M, 332, 660, 'locker', 'Arcón de cabos');
  npcs.push({ id: 'n_proa1', level: M, x: 470, y: 400, facing: -1, pose: 'stand', act: 'window', walk: [{ x: 470, y: 400 }, { x: 620, y: 380 }, { x: 620, y: 720 }, { x: 470, y: 680 }] });
  b.prop(M, 'lifering', 3424, 300, 18, 10, 40, { solid: false });
  b.prop(M, 'lifering', 3424, 780, 18, 10, 40, { solid: false });
  b.prop(M, 'lifeboat', 3170, 200, 230, 60, 44);
  b.prop(M, 'lifeboat', 3170, 840, 230, 60, 44);
  b.prop(M, 'bench', 3180, 420, 34, 110, 30);
  npcs.push({ id: 'n_popa1', level: M, x: 3215, y: 450, facing: 1, pose: 'sit', act: 'window' });
  b.prop(M, 'flagPole', 3380, 540, 24, 24, 110, { anim: 'flag' });
  b.prop(M, 'deckBox', 3250, 690, 80, 50, 34);
  b.st('k_comp_popa', M, 3290, 780, 'knife', 'Cofre de cubierta con candado');
  b.prop(M, 'deckBox', 3150, 600, 60, 44, 34);
  b.st('locker_popa', M, 3180, 676, 'locker', 'Arcón de chalecos');
  npcs.push({ id: 'n_banda1', level: M, x: 1500, y: 100, facing: 1, pose: 'stand', act: 'window', walk: [{ x: 1500, y: 100 }, { x: 2200, y: 100 }] });
  npcs.push({ id: 'n_banda2', level: M, x: 2400, y: 990, facing: -1, pose: 'stand', act: 'phone', walk: [{ x: 2400, y: 990 }, { x: 1600, y: 990 }] });

  // ================= TRAMPILLAS (red explícita) =================
  const vents = [
    { id: 'v_salon', name: 'Trampilla del salón', level: M, x: 1600, y: 435, links: ['v_radio', 'v_cocina'] },
    { id: 'v_cocina', name: 'Trampilla de la cocina', level: M, x: 2510, y: 345, links: ['v_salon', 'v_personal'] },
    { id: 'v_personal', name: 'Trampilla del personal', level: M, x: 3040, y: 435, links: ['v_cocina', 'v_alm'] },
    { id: 'v_radio', name: 'Trampilla de la radio', level: M, x: 1090, y: 885, links: ['v_salon', 'v_seg'] },
    { id: 'v_seg', name: 'Trampilla de seguridad', level: M, x: 1770, y: 775, links: ['v_radio', 'v_maq'] },
    { id: 'v_maq', name: 'Trampilla de máquinas', level: M, x: 2660, y: 790, links: ['v_seg', 'v_alm'] },
    { id: 'v_alm', name: 'Trampilla del almacén', level: M, x: 3040, y: 787, links: ['v_maq', 'v_personal'] },
  ];
  for (const v of vents) b.st(v.id, v.level, v.x, v.y, 'vent', v.name, { range: 56 });

  return b.finish({
    id: 'ship',
    name: 'Barco · El Ferry',
    levels: [{ id: M, name: 'Cubierta', index: 0, bounds: R(-300, -400, 4100, 1900), outline: [SHIP.HULL] }],
    vents,
    escapistLinks: [['v_salon', 'v_alm'], ['v_radio', 'v_personal']],
    cameras: [
      { id: 'cam1', name: 'Pasillo de proa', level: M, x: 1150, y: 500, view: R(760, 380, 720, 405) },
      { id: 'cam2', name: 'Pasillo de popa', level: M, x: 2550, y: 500, view: R(2280, 380, 720, 405) },
      { id: 'cam3', name: 'Cubierta de proa', level: M, x: 700, y: 380, view: R(140, 300, 640, 360) },
      { id: 'cam4', name: 'Cubierta de popa', level: M, x: 3082, y: 330, view: R(2960, 240, 520, 292) },
    ],
    zones: [
      { id: 'z_puente', name: 'Puente', level: M }, { id: 'z_salon', name: 'Salón y comedor', level: M },
      { id: 'z_cocina', name: 'Cocina', level: M }, { id: 'z_personal', name: 'Sala de personal', level: M },
      { id: 'z_pasillo', name: 'Pasillo central', level: M }, { id: 'z_radio', name: 'Radio', level: M },
      { id: 'z_banos', name: 'Baños', level: M }, { id: 'z_seg', name: 'Seguridad', level: M },
      { id: 'z_tec', name: 'Electricidad y máquinas', level: M }, { id: 'z_alm', name: 'Almacén', level: M },
      { id: 'z_ext', name: 'Cubiertas exteriores', level: M },
    ],
    doorGroups: [
      { id: 'dg_proa', name: 'Proa: puente y radio', doors: ['d_proa', 'd_puente', 'd_radio', 'd_extS1'] },
      { id: 'dg_centro', name: 'Centro: comedor, seguridad y electricidad', doors: ['d_comedor', 'd_seg', 'd_elec', 'd_extN1'] },
      { id: 'dg_popa', name: 'Popa: personal, máquinas y almacén', doors: ['d_personal', 'd_maq', 'd_maq_alm', 'd_popa', 'd_extN2', 'd_extS2'] },
    ],
    interference: [
      { station: 'term_radio', name: 'Proa', cameras: ['cam1', 'cam3'], zones: ['z_puente', 'z_salon', 'z_radio', 'z_banos', 'z_ext'], stations: ['cams_seg', 'occ_seg'] },
      { station: 'term_dist', name: 'Popa', cameras: ['cam2', 'cam4'], zones: ['z_cocina', 'z_personal', 'z_seg', 'z_tec', 'z_alm', 'z_pasillo'], stations: ['cams_seg', 'occ_seg'] },
    ],
    sabotages: [
      { id: 'lights', kind: 'lights', name: 'Apagón', activation: ['sab_lights'], repair: [{ stations: ['rep_lights'], minigame: 'rep_lights', label: 'Restablecer el cuadro general (Electricidad)' }], alarm: 'lights' },
      { id: 'comms', kind: 'comms', name: 'Comunicaciones', activation: ['sab_comms'], repair: [{ stations: ['rep_comms'], minigame: 'rep_comms', label: 'Sintonizar la radio (Radio)' }], alarm: 'comms' },
      { id: 'doors', kind: 'doors', name: 'Puertas', activation: ['sab_doors'], repair: [], alarm: 'doors' },
      {
        id: 'leak', kind: 'critical', name: 'Entrada de agua', activation: ['sab_leak'],
        repair: [
          { stations: ['crit_leak_patch'], minigame: 'crit_patch', label: 'Sellar la vía de agua (Almacén)' },
          { stations: ['crit_leak_pumps'], minigame: 'crit_pumps', label: 'Activar las bombas (Sala de máquinas)' },
        ],
        failTitle: 'Naufragio', failText: 'El agua inundó la bodega y El Ferry se fue a pique lentamente.', failScene: 'sink', alarm: 'critical',
      },
      {
        id: 'propulsion', kind: 'critical', name: 'Fallo de propulsión', activation: ['sab_prop'],
        repair: [
          { stations: ['crit_prop_stab'], minigame: 'crit_stabilize', label: 'Estabilizar la propulsión (Sala de máquinas)' },
          { stations: ['crit_prop_bridge'], minigame: 'crit_telegraph', label: 'Confirmar en el telégrafo del puente' },
        ],
        failTitle: 'Deriva contra las rocas', failText: 'Sin propulsión ni gobierno, El Ferry derivó hasta encallar contra el arrecife.', failScene: 'reef', alarm: 'critical',
      },
    ],
    tasks: [
      { id: 'orders', type: 'orders', name: 'Servir comandas', length: 'long', stages: [{ stations: ['orders_pick'], label: 'Recoge la comanda en el pase de la Cocina' }, { stations: ['orders_t1', 'orders_t2', 'orders_t3'], label: 'Sirve la mesa en el Salón o el Comedor' }] },
      { id: 'cooking', type: 'cooking', name: 'Preparar plato', length: 'short', stages: [{ stations: ['cooking_coc'], label: 'Cocina en los fogones (Cocina)' }] },
      { id: 'drink', type: 'drink', name: 'Servir bebida', length: 'short', stages: [{ stations: ['drink_rest'], label: 'Sirve en la barra (Comedor)' }] },
      { id: 'dishes', type: 'dishes', name: 'Fregar vajilla', length: 'short', stages: [{ stations: ['dishes_coc'], label: 'Friega en el fregadero (Cocina)' }] },
      { id: 'toilet', type: 'toilet', name: 'Limpiar baños', length: 'short', stages: [{ stations: ['toilet_banos'], label: 'Limpia y repón los Baños' }] },
      { id: 'wiring', type: 'wiring', name: 'Reparar cableado', length: 'short', stages: [{ stations: ['wiring_elec'], label: 'Une los cables (Electricidad)' }] },
      { id: 'fuses', type: 'fuses', name: 'Cambiar fusible', length: 'short', stages: [{ stations: ['fuses_elec'], label: 'Sustituye el fusible (Electricidad)' }] },
      { id: 'pressure', type: 'pressure', name: 'Ajustar presión', length: 'short', stages: [{ stations: ['pressure_maq'], label: 'Ajusta las válvulas (Sala de máquinas)' }] },
      { id: 'filter', type: 'filter', name: 'Limpiar filtro del motor', length: 'long', stages: [{ stations: ['filter_maq'], label: 'Extrae, limpia y reinstala el filtro (Sala de máquinas)' }] },
      { id: 'assist', type: 'assist', name: 'Asistir al capitán', length: 'short', stages: [{ stations: ['assist_puente'], label: 'Calibra el radar del Puente' }] },
      { id: 'luggage', type: 'luggage', name: 'Estibar equipaje', length: 'short', stages: [{ stations: ['luggage_alm'], label: 'Coloca las maletas (Almacén)' }] },
      { id: 'bilge', type: 'bilge', name: 'Achicar sentina', length: 'short', exclusive: true, stages: [{ stations: ['bilge_maq'], label: 'Achica con la bomba manual (Sala de máquinas)' }] },
      { id: 'seal', type: 'seal', name: 'Comprobar junta estanca', length: 'short', exclusive: true, stages: [{ stations: ['seal_alm'], label: 'Aprieta la junta de la puerta estanca (Almacén)' }] },
      { id: 'ballast', type: 'ballast', name: 'Equilibrar lastre', length: 'long', exclusive: true, stages: [{ stations: ['ballast_alm'], label: 'Equilibra los tanques (Almacén)' }, { stations: ['assist_puente'], label: 'Confirma el trimado en el Puente' }] },
    ],
    knife: {
      docName: 'manifiesto manipulado',
      keyName: 'llave maestra de taquillas',
      toolName: 'palanca de servicio',
      compartmentName: 'compartimento de mantenimiento',
      ledgerName: 'registro de guardias',
      containerName: 'cofre con combinación',
      authName: 'autorización de acceso al puente',
      pools: {
        docs: ['k_docs_diario', 'k_docs_tablon', 'k_docs_carta'],
        search: ['k_key_revistero', 'k_key_propinas', 'k_key_botiquin', 'k_key_mesa'],
        tool: ['k_tool_maq', 'k_tool_proa'],
        compartment: ['k_comp_elec', 'k_comp_alm', 'k_comp_popa'],
        ledger: ['k_ledger_cocina', 'k_ledger_personal'],
        keypad: ['k_keypad_cocina', 'k_keypad_alm'],
        auth: ['k_auth_puente'],
      },
    },
    responsible: {
      title: 'Capitán', name: 'Capitana Arrieta', level: M, room: 'puente',
      patrol: [{ x: 800, y: 420 }, { x: 960, y: 400 }, { x: 1080, y: 420 }, { x: 900, y: 360 }],
    },
    npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: M, x: 1500 + k * 90, y: 546 }, { level: M, x: 1545 + k * 90, y: 580 }]),
    safePoints: [],
    meetingRoom: 'personal',
    texts: {
      vehicle: 'El Ferry',
      short: 'BARCO',
      description: 'Ferry de una sola cubierta: puente y radio a proa, salón y cocina al norte, máquinas y bodega al sur.',
      routes: 'Pasillo central de proa a popa, bandas exteriores y siete trampillas de servicio.',
      arrivalTitle: 'Atraque en el puerto',
      arrivalText: 'El Ferry atraca suavemente en el muelle. Pasaje y carga, sanos y salvos.',
      murderTitle: 'Barco sin capitán',
      murderText: 'Sin nadie al timón, El Ferry gira sin rumbo hasta embestir el espigón.',
      accessGoal: 'Accede a la capitana',
      approach: 'Maniobra de atraque',
      ejectText: 'La pasarela de cubierta se abre y…',
    },
    critTimeScale: 1.0,
    theme: {
      scenery: 'sea', bg: '#1f6f9f', hull: '#20375c', hullDark: '#13213a', trim: '#e63946',
      wallTop: '#2a3446', wallFace: '#f1ede4', wallFaceDark: '#cfc6b4', accent: '#e63946', metal: '#a8b2c1',
    },
  });
}
