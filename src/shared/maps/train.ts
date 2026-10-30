import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef, NpcSeat } from './types';

/**
 * TREN — EL EXPRESO
 * Disposición horizontal; la locomotora queda a la izquierda (sentido de marcha).
 * Nueve módulos de MOD_L × MOD_W unidos por pasarelas de GAP de longitud.
 * El techo reutiliza exactamente las mismas X/Y y anchuras de los módulos.
 */
export const TRAIN = {
  MOD_L: 600,
  MOD_W: 300,
  GAP: 70,
  X0: 240,
  /** Banda de la puerta de intercomunicación (centro vertical). */
  DOOR_Y: 167,
  FLOOR_Y0: 56,
  FLOOR_Y1: 278,
  END_T: 20,
  WALK_Y0: 121,
  WALK_Y1: 213,
};
export const xs = (i: number) => TRAIN.X0 + i * (TRAIN.MOD_L + TRAIN.GAP);
export const xe = (i: number) => xs(i) + TRAIN.MOD_L;

const MODULES = [
  'Locomotora', 'Máquinas', 'Técnico', 'Servicio', 'Comedor', 'Pasajeros A', 'Pasajeros B', 'Seguridad', 'Personal y equipaje',
];

export function buildTrain(): MapDef {
  const b = new MapBuilder();
  const I = 'interior';
  const T = 'roof';
  const { MOD_W, GAP, DOOR_Y, FLOOR_Y0: F0, FLOOR_Y1: F1, END_T } = TRAIN;

  // ---------- Estructura común de los módulos (interior) ----------
  for (let i = 0; i < 9; i++) {
    const x0 = xs(i), x1 = xe(i);
    const windows: number[] = [];
    for (let wx = x0 + 70; wx < x1 - 40; wx += 92) windows.push(wx);
    b.hwall(I, x0, x1, 0, HW, { kind: 'hull', windows: i === 0 ? [x0 + 140, x0 + 230] : windows });
    b.hwall(I, x0, x1, F1, MOD_W - F1, { kind: 'hull', face: false });
    b.vwall(I, x0, F0, F1, END_T, { kind: 'hull', openings: i > 0 ? [{ at: DOOR_Y }] : [] });
    b.vwall(I, x1 - END_T, F0, F1, END_T, {
      kind: 'hull',
      openings: i < 8 ? [{ at: DOOR_Y, door: { id: `d_g${i}`, name: `Puerta ${MODULES[i]} → ${MODULES[i + 1]}`, lockable: true } }] : [],
    });
    if (i < 8) {
      // Pasarela con suelo y fuelles entre módulos.
      const g0 = x1, g1 = xs(i + 1);
      b.hwall(I, g0, g1, 70, TRAIN.WALK_Y0 - 70, { kind: 'bellows' });
      b.hwall(I, g0, g1, TRAIN.WALK_Y1, 17, { kind: 'bellows', face: false });
      b.room(`g${i}`, `Pasarela ${i + 1}`, I, R(g0, TRAIN.WALK_Y0, GAP, TRAIN.WALK_Y1 - TRAIN.WALK_Y0), 'grate', 'neutral', '#8a8f9c', gangZone(i));
    }
  }
  const fx = (i: number) => xs(i) + END_T; // inicio de suelo útil
  const fw = TRAIN.MOD_L - END_T * 2;

  // ---------- M0 Locomotora ----------
  {
    const x0 = xs(0);
    b.room('cabina', 'Cabina de conducción', I, R(fx(0), F0, 300, F1 - F0), 'rubber', 'cold', '#58b4ff', 'z_loco');
    b.room('control', 'Puesto de control', I, R(x0 + 338, F0, 242, F1 - F0), 'metal', 'neutral', '#ffb347', 'z_loco');
    b.vwall(I, x0 + 320, F0, F1, VW, { kind: 'partition', openings: [{ at: DOOR_Y, door: { id: 'd_cabina', name: 'Puerta de cabina', lockable: true } }] });
    b.prop(I, 'cabConsole', x0 + 22, 72, 70, 190, 46, { anim: 'screen' });
    b.prop(I, 'instrumentPanel', x0 + 120, F0, 180, 20, 50, { anim: 'blink' });
    b.prop(I, 'pilotSeat', x0 + 108, 150, 40, 42, 40);
    b.st('assist_loco', I, x0 + 210, 102, 'task', 'Instrumentos de cabina');
    b.st('crit_brakes_confirm', I, x0 + 118, 112, 'repair', 'Confirmación de frenos');
    b.prop(I, 'tempGauge', x0 + 200, F1 - 22, 70, 22, 40, { anim: 'blink' });
    // Puesto de control
    b.prop(I, 'accessPanel', x0 + 360, F0, 64, 18, 52, { anim: 'blink' });
    b.st('k5_control', I, x0 + 392, 100, 'knife', 'Panel de autorización');
    b.prop(I, 'emergencyButton', x0 + 500, F0, 44, 16, 40);
    b.st('btn1', I, x0 + 522, 98, 'emergency', 'Botón de emergencia');
    b.prop(I, 'signalPanel', x0 + 370, F1 - 26, 100, 26, 44, { anim: 'blink' });
    b.st('signal_loco', I, x0 + 420, 230, 'task', 'Panel de señalización');
    b.prop(I, 'routeDesk', x0 + 480, F1 - 40, 60, 40, 34);
    b.st('k1_hoja', I, x0 + 510, 220, 'knife', 'Hojas de ruta');
    b.prop(I, 'vent', x0 + 540, 135, 36, 30, 2, { solid: false, flat: true });
    b.prop(I, 'extinguisher', x0 + 560, F0, 16, 14, 34, { solid: false });
  }

  // ---------- M1 Máquinas ----------
  {
    const x0 = xs(1);
    b.room('maquinas', 'Sala de máquinas', I, R(fx(1), F0, fw, F1 - F0), 'metal', 'cold', '#ff7b54', 'z_maq');
    b.prop(I, 'engine', x0 + 150, 135, 300, 50, 70, { anim: 'fan' });
    b.prop(I, 'coolant', x0 + 40, F0, 90, 20, 60, { anim: 'liquid' });
    b.st('crit_overheat_cool', I, x0 + 85, 112, 'repair', 'Circuito de refrigeración');
    b.prop(I, 'brakeMechanism', x0 + 250, F0, 100, 18, 52, { anim: 'blink' });
    b.st('crit_brakes_mech', I, x0 + 300, 108, 'repair', 'Mecanismo de frenos');
    b.prop(I, 'radiatorValve', x0 + 470, F0, 60, 18, 56);
    b.st('sab_overheat', I, x0 + 500, 106, 'sabotage', 'Válvula del radiador');
    b.prop(I, 'pipes', x0 + 380, F0, 70, 14, 60, { solid: false });
    b.prop(I, 'valvePanel', x0 + 480, F1 - 30, 80, 30, 46);
    b.st('pressure_maq', I, x0 + 520, 228, 'task', 'Válvulas de presión');
    b.st('filter_maq', I, x0 + 520, 170, 'task', 'Filtro del motor');
    b.prop(I, 'brakeGauge', x0 + 230, F1 - 22, 70, 22, 40, { anim: 'blink' });
    b.st('brakes_maq', I, x0 + 265, 232, 'task', 'Manómetro de frenos');
    b.prop(I, 'pump', x0 + 120, F1 - 30, 70, 30, 44, { anim: 'fan' });
    b.prop(I, 'toolChest', x0 + 330, F1 - 28, 70, 28, 40);
    b.st('k3_tools', I, x0 + 365, 226, 'knife', 'Arcón de herramientas');
    b.st('k1_parte', I, x0 + 400, 102, 'knife', 'Partes de mantenimiento');
    b.prop(I, 'vent', x0 + 40, 205, 40, 30, 2, { solid: false, flat: true });
    b.prop(I, 'steamPipe', x0 + 560, F0, 18, 14, 60, { anim: 'steam', solid: false });
  }

  // ---------- M2 Técnico (eléctrica | comunicaciones) ----------
  {
    const x0 = xs(2);
    b.room('electrica', 'Sala eléctrica', I, R(fx(2), F0, 270, F1 - F0), 'grate', 'cold', '#ffd23f', 'z_tec');
    b.room('comms', 'Comunicaciones', I, R(x0 + 308, F0, 272, F1 - F0), 'lino', 'cold', '#5ce1e6', 'z_tec');
    b.vwall(I, x0 + 290, F0, F1, VW, { kind: 'partition', openings: [{ at: DOOR_Y, door: { id: 'd_tec', name: 'Puerta eléctrica/comunicaciones', lockable: true } }] });
    b.prop(I, 'fuseBox', x0 + 40, F0, 70, 18, 52, { anim: 'blink' });
    b.st('fuses_elec', I, x0 + 75, 104, 'task', 'Caja de fusibles');
    b.prop(I, 'wiringPanel', x0 + 140, F0, 80, 18, 52);
    b.st('wiring_elec', I, x0 + 180, 104, 'task', 'Cuadro de cableado');
    b.prop(I, 'breakerPanel', x0 + 40, F1 - 22, 80, 22, 46, { anim: 'blink' });
    b.st('rep_lights', I, x0 + 80, 236, 'repair', 'Cuadro general de luces');
    b.prop(I, 'junctionBox', x0 + 170, F1 - 22, 70, 22, 44);
    b.st('sab_lights', I, x0 + 205, 236, 'sabotage', 'Caja de derivación');
    b.prop(I, 'vent', x0 + 230, 150, 40, 30, 2, { solid: false, flat: true });
    b.prop(I, 'radioDesk', x0 + 330, F0, 140, 40, 46, { anim: 'screen' });
    b.st('rep_comms', I, x0 + 400, 124, 'repair', 'Equipo de radio');
    b.prop(I, 'commsTerminal', x0 + 340, F1 - 26, 80, 26, 48, { anim: 'screen' });
    b.st('term_tec', I, x0 + 380, 232, 'commsTerminal', 'Terminal de comunicaciones');
    b.prop(I, 'cableRack', x0 + 480, F1 - 30, 80, 30, 50, { anim: 'blink' });
    b.st('sab_comms', I, x0 + 520, 228, 'sabotage', 'Bastidor de antena');
    b.prop(I, 'serverRack', x0 + 500, F0, 60, 30, 64, { anim: 'blink' });
    b.st('k3_rack', I, x0 + 530, 112, 'knife', 'Compartimento del rack');
  }

  // ---------- M3 Servicio ----------
  {
    const x0 = xs(3);
    b.room('servicio', 'Servicio y minicocina', I, R(fx(3), F0, fw, F1 - F0), 'tile', 'warm', '#ff9f43', 'z_serv');
    b.room('despensa', 'Despensa', I, R(x0 + 328, F0, 162, 94), 'tile', 'dim', '#c08552', 'z_serv');
    b.vwall(I, x0 + 310, F0, 176, VW, { kind: 'partition', openings: [{ at: 108, w: 72, door: { id: 'd_desp', name: 'Puerta de la despensa' } }] });
    b.vwall(I, x0 + 490, F0, 176, VW, { kind: 'partition' });
    b.hwall(I, x0 + 310, x0 + 508, 150, 26, { kind: 'partition' });
    b.prop(I, 'stove', x0 + 30, F0, 70, 42, 42, { anim: 'steam' });
    b.st('cooking_serv', I, x0 + 65, 124, 'task', 'Fogones');
    b.prop(I, 'sink', x0 + 100, F0, 70, 42, 40, { anim: 'liquid' });
    b.st('dishes_serv', I, x0 + 135, 124, 'task', 'Fregadero');
    b.prop(I, 'counter', x0 + 170, F0, 40, 42, 40);
    b.prop(I, 'passWindow', x0 + 210, F0, 70, 42, 44);
    b.st('orders_pick', I, x0 + 245, 124, 'task', 'Pase de comandas');
    b.prop(I, 'shelf', x0 + 340, F0, 130, 22, 64);
    b.st('k2_tarro', I, x0 + 400, 110, 'knife', 'Tarros de la despensa');
    b.prop(I, 'vent', x0 + 440, 112, 36, 26, 2, { solid: false, flat: true });
    b.prop(I, 'fridge', x0 + 30, F1 - 44, 60, 44, 66);
    b.prop(I, 'knifeDrawer', x0 + 130, F1 - 34, 90, 34, 36);
    b.st('k4_cajon', I, x0 + 175, 228, 'knife', 'Cajón de cubertería');
    b.prop(I, 'cleanLocker', x0 + 360, F1 - 34, 50, 34, 70);
    b.st('locker_serv', I, x0 + 385, 226, 'locker', 'Taquilla de limpieza');
    b.prop(I, 'trash', x0 + 430, F1 - 28, 34, 28, 34);
  }

  // ---------- M4 Comedor ----------
  const npcs: NpcSeat[] = [];
  {
    const x0 = xs(4);
    b.room('comedor', 'Comedor', I, R(fx(4), F0, fw, F1 - F0), 'parquet', 'warm', '#ff6b6b', 'z_com');
    const tables = [
      { x: x0 + 40, y: 64, st: 'orders_t1', sy: 136 },
      { x: x0 + 240, y: 64, st: 'orders_t2', sy: 136 },
      { x: x0 + 40, y: 222, st: 'orders_t3', sy: 200 },
      { x: x0 + 240, y: 222, st: 'orders_t4', sy: 200 },
    ];
    tables.forEach((t, k) => {
      b.prop(I, 'diningSet', t.x, t.y, 150, 50, 34, { variant: k });
      b.st(t.st, I, t.x + 75, t.sy, 'task', `Mesa ${k + 1}`);
      npcs.push({ id: `n_t${k}a`, level: I, x: t.x + 18, y: t.y + 34, facing: 1, pose: 'sit', act: k % 2 ? 'talk' : 'order', station: t.st });
      npcs.push({ id: `n_t${k}b`, level: I, x: t.x + 132, y: t.y + 34, facing: -1, pose: 'sit', act: k === 1 ? 'read' : 'talk', station: t.st });
    });
    b.prop(I, 'barCounter', x0 + 430, F0, 40, 134, 44);
    b.prop(I, 'coffeeMachine', x0 + 490, F0, 60, 26, 52, { anim: 'steam' });
    b.st('drink_com', I, x0 + 520, 112, 'task', 'Cafetera del bar');
    b.prop(I, 'barShelf', x0 + 520, F0 + 30, 40, 20, 40, { solid: false, flat: true });
    b.st('k2_barra', I, x0 + 492, 172, 'knife', 'Cajón de la barra');
    b.prop(I, 'vent', x0 + 410, 238, 36, 26, 2, { solid: false, flat: true });
  }

  // ---------- M5 Pasajeros A ----------
  {
    const x0 = xs(5);
    b.room('pasajerosA', 'Pasajeros A', I, R(fx(5), F0, fw, F1 - F0), 'carpet', 'warm', '#a66cff', 'z_pasA');
    for (let k = 0; k < 5; k++) {
      const sx = x0 + 40 + k * 64;
      b.prop(I, 'seat', sx, 60, 40, 52, 42, { flip: k % 2 === 1, variant: 0 });
      b.prop(I, 'seat', sx, 222, 40, 52, 42, { flip: k % 2 === 1, variant: 0 });
      if (k !== 2) npcs.push({ id: `n_a${k}n`, level: I, x: sx + 20, y: 96, facing: k % 2 ? -1 : 1, pose: 'sit', act: (['window', 'read', 'sleep', 'phone', 'window'] as const)[k] });
      if (k % 2 === 0) npcs.push({ id: `n_a${k}s`, level: I, x: sx + 20, y: 258, facing: 1, pose: 'sit', act: k === 0 ? 'talk' : 'read' });
    }
    // Aseo A (no toca la banda de la puerta).
    b.room('aseoA', 'Aseo A', I, R(x0 + 418, F0, 82, 94), 'tile', 'cold', '#7bdff2', 'z_pasA');
    b.vwall(I, x0 + 400, F0, 176, VW, { kind: 'partition', openings: [{ at: 112, w: 64, door: { id: 'd_aseoA', name: 'Puerta del aseo A', sensor: true } }] });
    b.vwall(I, x0 + 500, F0, 176, VW, { kind: 'partition' });
    b.hwall(I, x0 + 400, x0 + 518, 150, 26, { kind: 'partition' });
    b.prop(I, 'toilet', x0 + 440, F0, 36, 30, 30);
    b.prop(I, 'washbasin', x0 + 478, F0 + 30, 22, 30, 30);
    b.st('toilet_A', I, x0 + 452, 118, 'task', 'Aseo A');
    b.prop(I, 'luggageRack', x0 + 520, F1 - 46, 56, 46, 56);
    b.st('luggage_A', I, x0 + 548, 206, 'task', 'Portaequipajes');
    b.st('k2_maleta', I, x0 + 370, 210, 'knife', 'Maleta olvidada');
    b.prop(I, 'vent', x0 + 352, 150, 36, 26, 2, { solid: false, flat: true });
  }

  // ---------- M6 Pasajeros B ----------
  {
    const x0 = xs(6);
    b.room('pasajerosB', 'Pasajeros B', I, R(fx(6), F0, fw, F1 - F0), 'carpet', 'warm', '#4dd599', 'z_pasB');
    b.room('aseoB', 'Aseo B', I, R(x0 + 258, F0, 92, 94), 'tile', 'cold', '#7bdff2', 'z_pasB');
    b.vwall(I, x0 + 240, F0, 176, VW, { kind: 'partition' });
    b.vwall(I, x0 + 350, F0, 176, VW, { kind: 'partition' });
    b.hwall(I, x0 + 240, x0 + 368, 150, 26, { kind: 'partition', openings: [{ at: x0 + 304, w: 64, door: { id: 'd_aseoB', name: 'Puerta del aseo B' } }] });
    b.prop(I, 'toilet', x0 + 270, F0, 36, 30, 30);
    b.prop(I, 'washbasin', x0 + 320, F0, 26, 26, 30);
    b.st('toilet_B', I, x0 + 300, 108, 'task', 'Aseo B');
    for (let k = 0; k < 4; k++) {
      const ax = x0 + 30 + k * 132;
      b.prop(I, 'armchairSet', ax, 218, 108, 56, 40, { variant: k });
      npcs.push({ id: `n_b${k}`, level: I, x: ax + 20, y: 250, facing: 1, pose: 'sit', act: (['read', 'window', 'talk', 'sleep'] as const)[k] });
      if (k % 2 === 0) npcs.push({ id: `n_b${k}x`, level: I, x: ax + 88, y: 250, facing: -1, pose: 'sit', act: 'talk' });
    }
    b.prop(I, 'minibar', x0 + 40, F0, 80, 36, 46);
    b.st('drink_B', I, x0 + 80, 116, 'task', 'Minibar de atención');
    b.prop(I, 'brakeValve', x0 + 470, F0, 60, 18, 48);
    b.st('sab_brakes', I, x0 + 500, 104, 'sabotage', 'Válvula de freno de emergencia');
    b.prop(I, 'luggage', x0 + 400, F0, 50, 30, 40);
    b.st('k4_equipaje', I, x0 + 425, 110, 'knife', 'Baúl con candado');
    b.prop(I, 'vent', x0 + 160, 140, 36, 26, 2, { solid: false, flat: true });
  }

  // ---------- M7 Seguridad ----------
  {
    const x0 = xs(7);
    b.room('seguridad', 'Seguridad', I, R(fx(7), F0, fw, F1 - F0), 'lino', 'cold', '#4d96ff', 'z_seg');
    b.prop(I, 'monitors', x0 + 130, F0, 160, 40, 50, { anim: 'screen' });
    b.st('cams_seg', I, x0 + 210, 124, 'cameras', 'Monitores de cámaras');
    b.prop(I, 'occupancyPanel', x0 + 330, F0, 80, 18, 54, { anim: 'screen' });
    b.st('occ_seg', I, x0 + 370, 102, 'occupancy', 'Panel de ocupación');
    b.prop(I, 'accessControl', x0 + 50, F1 - 24, 80, 24, 48, { anim: 'blink' });
    b.st('sab_doors', I, x0 + 90, 234, 'sabotage', 'Control de accesos');
    b.prop(I, 'commsTerminal', x0 + 330, F1 - 26, 80, 26, 48, { anim: 'screen' });
    b.st('term_seg', I, x0 + 370, 232, 'commsTerminal', 'Terminal de seguridad');
    b.prop(I, 'locker', x0 + 470, F1 - 32, 50, 32, 72);
    b.st('locker_seg', I, x0 + 495, 226, 'locker', 'Taquilla de seguridad');
    b.prop(I, 'deskDrawer', x0 + 450, F0, 90, 36, 36);
    b.st('k2_mesa', I, x0 + 495, 116, 'knife', 'Mesa del jefe de seguridad');
    b.prop(I, 'vent', x0 + 40, 120, 36, 26, 2, { solid: false, flat: true });
    b.prop(I, 'chair', x0 + 190, 140, 34, 34, 36);
  }

  // ---------- M8 Personal y equipaje + salón de reunión ----------
  {
    const x0 = xs(8);
    b.room('taquillas', 'Personal y equipaje', I, R(fx(8), F0, 262, F1 - F0), 'lino', 'neutral', '#f9a826', 'z_pers');
    b.room('reunion', 'Salón de reunión', I, R(x0 + 298, F0, 282, F1 - F0), 'parquet', 'warm', '#ff8a3d', 'z_pers');
    b.vwall(I, x0 + 280, F0, F1, VW, { kind: 'partition', openings: [{ at: DOOR_Y, door: { id: 'd_pers', name: 'Puerta del salón', lockable: true } }] });
    for (let k = 0; k < 4; k++) b.prop(I, 'locker', x0 + 34 + k * 54, F0, 50, 30, 74, { variant: k });
    b.st('locker_p1', I, x0 + 59, 112, 'locker', 'Taquilla 1');
    b.st('locker_p2', I, x0 + 167, 112, 'locker', 'Taquilla 3');
    b.st('k2_taquilla', I, x0 + 113, 112, 'knife', 'Taquilla 2 (cerrada)');
    b.prop(I, 'luggageShelf', x0 + 40, F1 - 40, 200, 40, 52);
    b.st('luggage_P', I, x0 + 140, 224, 'task', 'Estantería de equipaje');
    b.st('k4_caja', I, x0 + 230, 168, 'knife', 'Caja de herramientas del personal');
    b.prop(I, 'meetingTable', x0 + 360, 128, 150, 76, 34);
    b.prop(I, 'emergencyButton', x0 + 420, F0, 44, 16, 40);
    b.st('btn2', I, x0 + 442, 98, 'emergency', 'Botón de emergencia');
    b.prop(I, 'brakeWheel', x0 + 548, 210, 30, 50, 46);
    b.st('brakes_P', I, x0 + 526, 236, 'task', 'Freno de mano');
    b.st('k1_libro', I, x0 + 330, 100, 'knife', 'Libro de servicio');
    b.prop(I, 'bookShelf', x0 + 310, F0, 50, 18, 56);
    b.prop(I, 'vent', x0 + 320, 236, 36, 26, 2, { solid: false, flat: true });
  }

  // ---------- Techo ----------
  const ROOF_ZONES = ['z_roof_front', 'z_roof_front', 'z_roof_front', 'z_roof_mid', 'z_roof_mid', 'z_roof_mid', 'z_roof_rear', 'z_roof_rear', 'z_roof_rear'];
  for (let i = 0; i < 9; i++) {
    const x0 = xs(i), x1 = xe(i);
    b.room(`r${i}`, `Techo · ${MODULES[i]}`, T, R(x0 + 12, 24, TRAIN.MOD_L - 24, 252), 'roof', 'exterior', '#9aa5b1', ROOF_ZONES[i], undefined, true);
    b.hwall(T, x0, x1, 8, 16, { kind: 'edge', invisible: true, occludes: false, face: false });
    b.hwall(T, x0, x1, 276, 16, { kind: 'edge', invisible: true, occludes: false, face: false });
    b.vwall(T, x0, 8, 292, 12, { kind: 'edge', invisible: true, occludes: false, openings: i > 0 ? [{ at: 150, w: 90 }] : [] });
    b.vwall(T, x1 - 12, 8, 292, 12, { kind: 'edge', invisible: true, occludes: false, openings: i < 8 ? [{ at: 150, w: 90 }] : [] });
    if (i < 8) {
      const g0 = x1 - 12, g1 = xs(i + 1) + 12;
      b.hwall(T, g0, g1, 91, 14, { kind: 'rail', occludes: false, face: false });
      b.hwall(T, g0, g1, 195, 14, { kind: 'rail', occludes: false, face: false });
      b.room(`rw${i}`, `Pasarela superior ${i + 1}`, T, R(g0, 105, g1 - g0, 90), 'grate', 'exterior', '#9aa5b1', ROOF_ZONES[i], undefined, true);
    }
  }
  b.prop(T, 'pantograph', xs(0) + 330, 110, 140, 80, 34);
  b.prop(T, 'horn', xs(0) + 120, 60, 40, 30, 20);
  b.prop(T, 'radiators', xs(1) + 60, 40, 180, 60, 26, { anim: 'fan' });
  b.prop(T, 'reliefValve', xs(1) + 320, 40, 70, 40, 40, { anim: 'steam' });
  b.st('crit_overheat_relief', T, xs(1) + 355, 112, 'repair', 'Válvulas de alivio del techo');
  b.prop(T, 'exhaust', xs(1) + 420, 200, 60, 60, 50, { anim: 'steam' });
  b.prop(T, 'antenna', xs(2) + 280, 50, 50, 50, 96, { anim: 'blink' });
  b.st('roof_antenna', T, xs(2) + 305, 136, 'task', 'Antena del techo');
  b.prop(T, 'roofBox', xs(2) + 440, 200, 80, 50, 30);
  b.st('k3_techo', T, xs(2) + 480, 180, 'knife', 'Cubierta técnica del techo');
  b.prop(T, 'roofVent', xs(3) + 150, 60, 80, 50, 22, { anim: 'steam' });
  b.prop(T, 'roofVent', xs(3) + 380, 200, 80, 50, 22, { anim: 'fan' });
  b.prop(T, 'roofCover', xs(4) + 250, 40, 110, 56, 18);
  b.st('roof_cover', T, xs(4) + 305, 128, 'task', 'Cubierta de ventilación');
  b.prop(T, 'acUnit', xs(5) + 120, 50, 120, 60, 34, { anim: 'fan' });
  b.prop(T, 'acUnit', xs(5) + 360, 190, 120, 60, 34, { anim: 'fan' });
  b.prop(T, 'acUnit', xs(6) + 240, 50, 120, 60, 34, { anim: 'fan' });
  b.prop(T, 'cameraMast', xs(7) + 280, 60, 40, 40, 70, { anim: 'blink' });
  b.prop(T, 'roofVent', xs(8) + 200, 190, 80, 50, 22, { anim: 'fan' });
  b.prop(T, 'hatch', xs(8) + 420, 60, 70, 50, 10, { solid: false, flat: true });

  // ---------- Escaleras (tres puntos repartidos, extremos emparejados) ----------
  const ladders = [1, 4, 7].map((g, k) => {
    const x = xe(g) + GAP / 2;
    return {
      id: `lad${k + 1}`, name: `Escalera ${k + 1}`, kind: 'ladder' as const,
      a: { level: I, x, y: 140 }, b: { level: T, x, y: 140 },
    };
  });
  for (const l of ladders) {
    b.st(`${l.id}_a`, I, l.a.x, l.a.y, 'ladder', `${l.name} (subir al techo)`);
    b.st(`${l.id}_b`, T, l.b.x, l.b.y, 'ladder', `${l.name} (bajar)`);
  }

  // ---------- Trampillas ----------
  const vents = [
    { id: 'v_loco', name: 'Trampilla del puesto de control', level: I, x: xs(0) + 558, y: 150, links: ['v_maq'] },
    { id: 'v_maq', name: 'Trampilla de máquinas', level: I, x: xs(1) + 60, y: 220, links: ['v_loco', 'v_elec'] },
    { id: 'v_elec', name: 'Trampilla eléctrica', level: I, x: xs(2) + 250, y: 165, links: ['v_maq'] },
    { id: 'v_serv', name: 'Trampilla de la despensa', level: I, x: xs(3) + 458, y: 125, links: ['v_com'] },
    { id: 'v_com', name: 'Trampilla del comedor', level: I, x: xs(4) + 428, y: 251, links: ['v_serv', 'v_pasA'] },
    { id: 'v_pasA', name: 'Trampilla de pasajeros A', level: I, x: xs(5) + 370, y: 163, links: ['v_com'] },
    { id: 'v_pasB', name: 'Trampilla de pasajeros B', level: I, x: xs(6) + 178, y: 153, links: ['v_seg', 'v_pers'] },
    { id: 'v_seg', name: 'Trampilla de seguridad', level: I, x: xs(7) + 58, y: 133, links: ['v_pasB', 'v_pers'] },
    { id: 'v_pers', name: 'Trampilla del salón', level: I, x: xs(8) + 338, y: 249, links: ['v_pasB', 'v_seg'] },
  ];
  for (const v of vents) b.st(v.id, v.level, v.x, v.y, 'vent', v.name, { range: 56 });

  const def = b.finish({
    id: 'train',
    name: 'Tren · El Expreso',
    levels: [
      { id: I, name: 'Interior', index: 0, bounds: R(-200, -420, 6700, 1140), outline: trainOutline(false) },
      { id: T, name: 'Techo', index: 1, bounds: R(-200, -420, 6700, 1140), outline: trainOutline(true), open: true },
    ],
    ladders,
    vents,
    escapistLinks: [['v_elec', 'v_serv'], ['v_pasA', 'v_pasB']],
    cameras: [
      { id: 'cam1', name: 'Pasarela Máquinas–Técnico', level: I, x: xe(1) + 35, y: 70, view: R(xe(1) + 35 - 320, -10, 640, 340) },
      { id: 'cam2', name: 'Comedor', level: I, x: xs(4) + 300, y: 56, view: R(xs(4) - 20, -10, 640, 340) },
      { id: 'cam3', name: 'Pasajeros B', level: I, x: xs(6) + 300, y: 56, view: R(xs(6) - 20, -10, 640, 340) },
      { id: 'cam4', name: 'Techo central', level: T, x: xe(4) + 35, y: 100, view: R(xe(4) + 35 - 320, -20, 640, 340) },
    ],
    zones: [
      { id: 'z_loco', name: 'Locomotora', level: I }, { id: 'z_maq', name: 'Máquinas', level: I },
      { id: 'z_tec', name: 'Técnico', level: I }, { id: 'z_serv', name: 'Servicio', level: I },
      { id: 'z_com', name: 'Comedor', level: I }, { id: 'z_pasA', name: 'Pasajeros A', level: I },
      { id: 'z_pasB', name: 'Pasajeros B', level: I }, { id: 'z_seg', name: 'Seguridad', level: I },
      { id: 'z_pers', name: 'Personal', level: I },
      { id: 'z_roof_front', name: 'Techo delantero', level: T }, { id: 'z_roof_mid', name: 'Techo central', level: T },
      { id: 'z_roof_rear', name: 'Techo trasero', level: T },
    ],
    doorGroups: [
      { id: 'dg_front', name: 'Cabina y máquinas', doors: ['d_cabina', 'd_g0', 'd_g1', 'd_tec'] },
      { id: 'dg_mid', name: 'Servicio y comedor', doors: ['d_g2', 'd_g3', 'd_g4'] },
      { id: 'dg_rear', name: 'Pasajeros, seguridad y salón', doors: ['d_g5', 'd_g6', 'd_g7', 'd_pers'] },
    ],
    interference: [
      { station: 'term_tec', name: 'Zona delantera', cameras: ['cam1', 'cam4'], zones: ['z_loco', 'z_maq', 'z_tec', 'z_serv', 'z_roof_front', 'z_roof_mid'], stations: ['cams_seg', 'occ_seg'] },
      { station: 'term_seg', name: 'Zona trasera', cameras: ['cam2', 'cam3'], zones: ['z_com', 'z_pasA', 'z_pasB', 'z_seg', 'z_pers', 'z_roof_rear'], stations: ['cams_seg', 'occ_seg'] },
    ],
    sabotages: [
      { id: 'lights', kind: 'lights', name: 'Apagón', activation: ['sab_lights'], repair: [{ stations: ['rep_lights'], minigame: 'rep_lights', label: 'Restablecer el cuadro general (Técnico)' }], alarm: 'lights' },
      { id: 'comms', kind: 'comms', name: 'Comunicaciones', activation: ['sab_comms'], repair: [{ stations: ['rep_comms'], minigame: 'rep_comms', label: 'Sintonizar la radio (Técnico)' }], alarm: 'comms' },
      { id: 'doors', kind: 'doors', name: 'Puertas', activation: ['sab_doors'], repair: [], alarm: 'doors' },
      {
        id: 'brakes', kind: 'critical', name: 'Fallo de frenos', activation: ['sab_brakes'],
        repair: [
          { stations: ['crit_brakes_mech'], minigame: 'crit_levers', label: 'Rearmar el mecanismo (Máquinas)' },
          { stations: ['crit_brakes_confirm'], minigame: 'crit_keyconfirm', label: 'Confirmar en cabina (Locomotora)' },
        ],
        failTitle: 'Descarrilamiento', failText: 'Sin frenos, El Expreso tomó la curva a toda velocidad y descarriló.', failScene: 'derail', alarm: 'critical',
      },
      {
        id: 'overheat', kind: 'critical', name: 'Sobrecalentamiento', activation: ['sab_overheat'],
        repair: [
          { stations: ['crit_overheat_cool'], minigame: 'crit_coolant', label: 'Reabrir la refrigeración (Máquinas)' },
          { stations: ['crit_overheat_relief'], minigame: 'crit_relief', label: 'Abrir las válvulas de alivio (Techo de Máquinas)' },
        ],
        failTitle: 'Avería catastrófica', failText: 'El motor se sobrecalentó hasta reventar y el tren quedó destrozado en mitad de la vía.', failScene: 'explode', alarm: 'critical',
      },
    ],
    tasks: [
      { id: 'orders', type: 'orders', name: 'Servir comandas', length: 'long', stages: [{ stations: ['orders_pick'], label: 'Recoge la comanda en Servicio' }, { stations: ['orders_t1', 'orders_t2', 'orders_t3', 'orders_t4'], label: 'Sirve al pasajero en el Comedor' }] },
      { id: 'cooking', type: 'cooking', name: 'Preparar plato', length: 'short', stages: [{ stations: ['cooking_serv'], label: 'Cocina en los fogones de Servicio' }] },
      { id: 'drink', type: 'drink', name: 'Servir café', length: 'short', stages: [{ stations: ['drink_com', 'drink_B'], label: 'Sirve una bebida' }] },
      { id: 'dishes', type: 'dishes', name: 'Fregar vajilla', length: 'short', stages: [{ stations: ['dishes_serv'], label: 'Friega en Servicio' }] },
      { id: 'toilet', type: 'toilet', name: 'Limpiar aseo', length: 'short', stages: [{ stations: ['toilet_A', 'toilet_B'], label: 'Limpia y repón el aseo' }] },
      { id: 'wiring', type: 'wiring', name: 'Reparar cableado', length: 'short', stages: [{ stations: ['wiring_elec'], label: 'Une los cables en la Sala eléctrica' }] },
      { id: 'fuses', type: 'fuses', name: 'Cambiar fusible', length: 'short', stages: [{ stations: ['fuses_elec'], label: 'Sustituye el fusible averiado' }] },
      { id: 'pressure', type: 'pressure', name: 'Ajustar presión', length: 'short', stages: [{ stations: ['pressure_maq'], label: 'Ajusta las válvulas en Máquinas' }] },
      { id: 'filter', type: 'filter', name: 'Limpiar filtro del motor', length: 'long', stages: [{ stations: ['filter_maq'], label: 'Extrae, limpia y reinstala el filtro' }] },
      { id: 'assist', type: 'assist', name: 'Asistir al conductor', length: 'short', stages: [{ stations: ['assist_loco'], label: 'Calibra los instrumentos de cabina' }] },
      { id: 'luggage', type: 'luggage', name: 'Ordenar equipaje', length: 'short', stages: [{ stations: ['luggage_A', 'luggage_P'], label: 'Coloca las maletas sin bloquear el pasillo' }] },
      { id: 'roof', type: 'roof', name: 'Ajustar antena del techo', length: 'short', exclusive: true, stages: [{ stations: ['roof_antenna', 'roof_cover'], label: 'Ajusta y ancla en el techo' }] },
      { id: 'signal', type: 'signal', name: 'Señalización de vía', length: 'short', exclusive: true, stages: [{ stations: ['signal_loco'], label: 'Fija la ruta en el panel de señales' }] },
      { id: 'brakes', type: 'brakes', name: 'Calibrar frenos', length: 'long', exclusive: true, stages: [{ stations: ['brakes_maq'], label: 'Lee el manómetro en Máquinas' }, { stations: ['brakes_P'], label: 'Calibra el freno de mano del salón' }] },
    ],
    knife: {
      docName: 'documentación de servicio manipulada',
      keyName: 'llave del revisor',
      compartmentName: 'compartimento técnico',
      containerName: 'contenedor con combinación',
      authName: 'autorización del puesto de control',
      stages: [
        { stations: ['k1_hoja', 'k1_parte', 'k1_libro'], label: 'Consulta la documentación manipulada' },
        { stations: ['k2_tarro', 'k2_barra', 'k2_maleta', 'k2_mesa', 'k2_taquilla'], label: 'Busca la llave del revisor' },
        { stations: ['k3_tools', 'k3_rack', 'k3_techo'], label: 'Abre el compartimento técnico' },
        { stations: ['k4_cajon', 'k4_equipaje', 'k4_caja'], label: 'Abre el contenedor y coge el cuchillo' },
        { stations: ['k5_control'], label: 'Manipula la autorización del puesto de control' },
      ],
    },
    responsible: {
      title: 'Conductor', name: 'Conductor Bermúdez', level: I, room: 'cabina',
      patrol: [{ x: xs(0) + 180, y: 128 }, { x: xs(0) + 240, y: 122 }, { x: xs(0) + 260, y: 200 }, { x: xs(0) + 180, y: 225 }],
    },
    npcs,
    spawn: [0, 1, 2, 3, 4, 5].slice(0, 5).flatMap((k) => [
      { level: I, x: xs(4) + 120 + k * 60, y: 160 },
      { level: I, x: xs(4) + 150 + k * 60, y: 185 },
    ]),
    safePoints: [],
    meetingRoom: 'reunion',
    texts: {
      vehicle: 'El Expreso',
      short: 'TREN',
      description: 'Nueve módulos encadenados, de la locomotora al salón del personal, con un techo transitable.',
      routes: 'Pasarelas entre vagones, techo con tres escaleras y trampillas por tramos.',
      arrivalTitle: 'Llegada a la estación',
      arrivalText: 'El Expreso entra en el andén a su hora. Todo el trabajo está hecho.',
      murderTitle: 'Tren sin conductor',
      murderText: 'Sin nadie a los mandos, El Expreso pierde el control y se sale de la vía.',
      accessGoal: 'Accede al conductor',
      approach: 'Aproximación a la estación',
      ejectText: 'La bota de servicio abre la puerta lateral y…',
    },
    critTimeScale: 1,
    theme: {
      scenery: 'land', bg: '#5f8f4e', hull: '#7a2e3a', hullDark: '#4d1a25', trim: '#d9a441',
      wallTop: '#3a2b33', wallFace: '#c9b79c', wallFaceDark: '#9d8a72', accent: '#d9a441', metal: '#8d99ae',
    },
  });
  return def;
}

function gangZone(i: number): string {
  return ['z_loco', 'z_maq', 'z_tec', 'z_serv', 'z_com', 'z_pasA', 'z_pasB', 'z_seg'][i];
}

/** Siluetas de los nueve módulos (y morro de la locomotora). */
function trainOutline(roof: boolean) {
  const polys = [];
  for (let i = 0; i < 9; i++) {
    const x0 = xs(i), x1 = xe(i);
    if (i === 0) {
      polys.push([
        { x: x0 - 150, y: 70 }, { x: x0 - 110, y: 30 }, { x: x0 - 40, y: 6 }, { x: x0, y: 0 }, { x: x1, y: 0 },
        { x: x1, y: TRAIN.MOD_W }, { x: x0, y: TRAIN.MOD_W }, { x: x0 - 40, y: TRAIN.MOD_W - 6 },
        { x: x0 - 110, y: TRAIN.MOD_W - 30 }, { x: x0 - 150, y: TRAIN.MOD_W - 70 },
      ]);
    } else {
      polys.push([{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: TRAIN.MOD_W }, { x: x0, y: TRAIN.MOD_W }]);
    }
    if (i < 8) {
      const g0 = x1, g1 = xs(i + 1);
      polys.push(roof
        ? [{ x: g0, y: 91 }, { x: g1, y: 91 }, { x: g1, y: 209 }, { x: g0, y: 209 }]
        : [{ x: g0, y: 70 }, { x: g1, y: 70 }, { x: g1, y: 230 }, { x: g0, y: 230 }]);
    }
  }
  return polys;
}
