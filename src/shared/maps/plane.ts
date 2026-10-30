import { HW, MapBuilder, R, VW } from './builder';
import type { LadderDef, MapDef, NpcSeat } from './types';

/**
 * AVIÓN — EL VUELO
 * Cabina a la izquierda. Fuselaje x 80–3500, y 0–600. Alas fijas ancladas
 * en la sección central (x 1450–2150). Dos niveles: pasajeros y técnico,
 * conectados solo por dos accesos de servicio (delantero y trasero).
 */
export const PLANE = {
  FUSELAGE: [
    { x: 80, y: 300 }, { x: 110, y: 200 }, { x: 180, y: 112 }, { x: 300, y: 42 }, { x: 420, y: 10 }, { x: 520, y: 0 },
    { x: 3000, y: 0 }, { x: 3250, y: 60 }, { x: 3450, y: 200 }, { x: 3500, y: 262 }, { x: 3500, y: 338 }, { x: 3450, y: 400 },
    { x: 3250, y: 540 }, { x: 3000, y: 600 }, { x: 520, y: 600 }, { x: 420, y: 590 }, { x: 300, y: 558 }, { x: 180, y: 488 },
    { x: 110, y: 400 }, { x: 80, y: 300 },
  ],
  WING_N: [{ x: 1450, y: 0 }, { x: 2350, y: -1250 }, { x: 2560, y: -1250 }, { x: 2150, y: 0 }],
  WING_S: [{ x: 1450, y: 600 }, { x: 2350, y: 1850 }, { x: 2560, y: 1850 }, { x: 2150, y: 600 }],
  ENGINES: [{ x: 1900, y: -560 }, { x: 1900, y: 1160 }],
  STAB_N: [{ x: 3020, y: 10 }, { x: 3330, y: -430 }, { x: 3440, y: -430 }, { x: 3330, y: 40 }],
  STAB_S: [{ x: 3020, y: 590 }, { x: 3330, y: 1030 }, { x: 3440, y: 1030 }, { x: 3330, y: 560 }],
};

export function buildPlane(): MapDef {
  const b = new MapBuilder();
  const P = 'cabin', T = 'tech';
  const npcs: NpcSeat[] = [];

  // =============== CUBIERTA DE PASAJEROS ===============
  const winP: number[] = []; for (let x = 860; x < 2980; x += 64) if (x < 1500 || x > 1990) winP.push(x);
  b.hwall(P, 560, 3000, 10, HW, { kind: 'hull', windows: winP });
  b.hwall(P, 560, 3000, 534, 22, { kind: 'hull', face: false });
  // Morro (colisión curva) y mamparos
  b.hullPoly(P, [{ x: 560, y: 66 }, { x: 430, y: 74 }, { x: 330, y: 120 }, { x: 260, y: 200 }, { x: 236, y: 300 }, { x: 260, y: 400 }, { x: 330, y: 480 }, { x: 430, y: 526 }, { x: 560, y: 534 }], 22);
  b.vwall(P, 560, 66, 534, VW, { kind: 'partition', openings: [{ at: 300, w: 80, door: { id: 'd_cockpit', name: 'Puerta de cabina de vuelo', lockable: true } }] });
  b.vwall(P, 2990, 66, 534, VW, { kind: 'hull' });
  b.room('cockpit', 'Cabina de pilotos', P, R(260, 90, 300, 420), 'rubber', 'cold', '#58b4ff', 'z_cockpit');
  b.prop(P, 'cockpitPanel', 262, 200, 70, 200, 40, { anim: 'screen' });
  b.prop(P, 'pilotSeat', 360, 270, 46, 60, 44);
  b.prop(P, 'overheadPanel', 430, 90, 110, 30, 30, { anim: 'blink' });
  b.st('assist_cockpit', P, 470, 150, 'task', 'Panel superior de cabina');
  b.prop(P, 'navDisplay', 430, 452, 100, 30, 36, { anim: 'screen' });
  b.st('crit_nav_confirm', P, 480, 420, 'repair', 'Pantalla de navegación');
  // Vestíbulo de tripulación
  b.vwall(P, 800, 66, 534, VW, { kind: 'partition', openings: [{ at: 205, w: 90 }, { at: 395, w: 90 }] });
  b.room('vestibulo', 'Vestíbulo de tripulación', P, R(578, 66, 222, 468), 'lino', 'neutral', '#ffd166', 'z_vest');
  b.prop(P, 'exitDoor', 640, 10, 100, 56, 0, { solid: false, flat: true });
  b.prop(P, 'doorPanel', 760, 66, 30, 16, 40, { anim: 'blink' });
  b.st('crit_pressure_seal', P, 760, 108, 'repair', 'Sellado de la puerta L1');
  b.prop(P, 'emergencyButton', 600, 66, 44, 16, 40);
  b.st('btn1', P, 622, 108, 'emergency', 'Botón de emergencia');
  b.prop(P, 'accessPanel', 580, 330, 18, 60, 52, { anim: 'blink' });
  b.st('k5_cabina', P, 616, 360, 'knife', 'Autorización de la cabina');
  b.prop(P, 'jumpSeat', 700, 230, 40, 60, 40);
  b.prop(P, 'serviceHatch', 600, 470, 80, 56, 6, { solid: false, flat: true });
  b.prop(P, 'crewBinder', 740, 480, 50, 40, 36);
  b.st('k1_partes', P, 765, 456, 'knife', 'Partes de vuelo');
  b.prop(P, 'vent', 720, 330, 36, 26, 2, { solid: false, flat: true });

  // Zonas de pasajeros (doble pasillo)
  const seatBlock = (x0: number, rows: number, zone: string, prefix: string) => {
    for (let k = 0; k < rows; k++) {
      const x = x0 + k * 64;
      b.prop(P, 'seatRow', x, 76, 40, 84, 42, { variant: 2 });
      b.prop(P, 'seatRow', x, 250, 40, 100, 42, { variant: 3 });
      b.prop(P, 'seatRow', x, 440, 40, 84, 42, { variant: 2 });
      const r = (k * 7 + x0) % 5;
      if (r !== 0) npcs.push({ id: `${prefix}${k}n`, level: P, x: x + 20, y: 100 + (k % 2) * 36, facing: -1, pose: 'sit', act: (['window', 'read', 'sleep', 'phone', 'window'] as const)[r] });
      if (r === 1 || r === 3) npcs.push({ id: `${prefix}${k}c`, level: P, x: x + 20, y: 285 + (k % 3) * 22, facing: -1, pose: 'sit', act: 'read' });
      if (r === 2 || r === 4) npcs.push({ id: `${prefix}${k}s`, level: P, x: x + 20, y: 470 + (k % 2) * 30, facing: -1, pose: 'sit', act: r === 2 ? 'sleep' : 'window' });
    }
    void zone;
  };
  b.room('delantera', 'Pasajeros delantera', P, R(818, 66, 682, 468), 'carpet', 'warm', '#a66cff', 'z_del');
  seatBlock(850, 9, 'z_del', 'n_f');
  b.vwall(P, 1500, 66, 534, VW, { kind: 'partition', openings: [{ at: 205, w: 90 }, { at: 395, w: 90 }] });
  b.room('cocina', 'Cocina central', P, R(1518, 66, 302, 468), 'tile', 'warm', '#ff9f43', 'z_cocina');
  b.prop(P, 'galleyUnit', 1530, 66, 120, 50, 60, { anim: 'steam' });
  b.st('cooking_galley', P, 1590, 140, 'task', 'Hornos de la cocina');
  b.prop(P, 'coffeeMachine', 1660, 66, 70, 40, 54, { anim: 'steam' });
  b.st('drink_galley', P, 1695, 130, 'task', 'Cafetera');
  b.prop(P, 'sink', 1740, 66, 70, 40, 40, { anim: 'liquid' });
  b.st('dishes_galley', P, 1775, 130, 'task', 'Fregadero de la cocina');
  b.prop(P, 'galleyUnit', 1530, 494, 140, 40, 60);
  b.prop(P, 'trayRack', 1690, 494, 90, 40, 56);
  b.st('orders_pick', P, 1735, 470, 'task', 'Bandejas de comida');
  b.prop(P, 'cartBay', 1530, 300, 110, 70, 40, { anim: 'blink' });
  b.st('carts_galley', P, 1585, 390, 'task', 'Anclajes de carros');
  b.prop(P, 'barBox', 1700, 290, 70, 50, 40);
  b.st('k4_galley', P, 1735, 370, 'knife', 'Caja de bar precintada');
  b.prop(P, 'vent', 1660, 240, 36, 26, 2, { solid: false, flat: true });
  // Aseos (norte y sur) con paso central
  b.vwall(P, 1820, 66, 534, VW, { kind: 'partition', openings: [{ at: 300, w: 120 }] });
  b.vwall(P, 1980, 66, 534, VW, { kind: 'partition', openings: [{ at: 300, w: 120 }] });
  b.hwall(P, 1838, 1980, 200, 30, { kind: 'partition', openings: [{ at: 1909, w: 64, door: { id: 'd_lavN', name: 'Aseo norte' } }] });
  b.hwall(P, 1838, 1980, 380, 24, { kind: 'partition', openings: [{ at: 1909, w: 64, door: { id: 'd_lavS', name: 'Aseo sur' } }] });
  b.room('paso', 'Paso de aseos', P, R(1838, 230, 142, 150), 'lino', 'neutral', '#cdb4db', 'z_cocina');
  b.room('aseoN', 'Aseo norte', P, R(1838, 66, 142, 134), 'tile', 'cold', '#7bdff2', 'z_cocina');
  b.room('aseoS', 'Aseo sur', P, R(1838, 404, 142, 130), 'tile', 'cold', '#7bdff2', 'z_cocina');
  b.prop(P, 'toilet', 1860, 66, 36, 32, 30);
  b.prop(P, 'washbasin', 1930, 66, 40, 26, 30);
  b.st('toilet_lavN', P, 1909, 140, 'task', 'Aseo norte');
  b.prop(P, 'toilet', 1860, 500, 36, 32, 30);
  b.prop(P, 'washbasin', 1930, 504, 40, 26, 30);
  b.st('toilet_lavS', P, 1909, 456, 'task', 'Aseo sur');
  b.room('trasera', 'Pasajeros trasera', P, R(1998, 66, 702, 468), 'carpet', 'warm', '#4dd599', 'z_tras');
  seatBlock(2030, 10, 'z_tras', 'n_r');
  b.vwall(P, 2700, 66, 534, VW, { kind: 'partition', openings: [{ at: 205, w: 90 }, { at: 395, w: 90 }] });
  b.prop(P, 'overheadBins', 1100, 66, 120, 10, 30, { solid: false });
  b.st('luggage_binsF', P, 1170, 205, 'task', 'Compartimentos superiores (delantera)');
  b.st('luggage_binsR', P, 2350, 395, 'task', 'Compartimentos superiores (trasera)');
  b.st('k2_bolsillo', P, 1360, 395, 'knife', 'Bolsillo de asiento');
  b.st('k2_mantas', P, 2550, 205, 'knife', 'Cajón de mantas');
  const os = [
    { id: 'orders_s1', x: 1000, y: 205 }, { id: 'orders_s2', x: 1250, y: 395 },
    { id: 'orders_s3', x: 2200, y: 205 }, { id: 'orders_s4', x: 2480, y: 395 },
  ];
  os.forEach((o, k) => b.st(o.id, P, o.x, o.y, 'task', `Fila ${[4, 8, 18, 22][k]}`));
  // Sala de descanso / servicio
  b.room('descanso', 'Sala de descanso y servicio', P, R(2718, 66, 272, 468), 'parquet', 'warm', '#ff8a3d', 'z_desc');
  b.prop(P, 'meetingTable', 2780, 220, 140, 120, 34);
  b.prop(P, 'emergencyButton', 2820, 66, 44, 16, 40);
  b.st('btn2', P, 2842, 108, 'emergency', 'Botón de emergencia');
  b.prop(P, 'crewBunk', 2930, 70, 56, 120, 50);
  b.prop(P, 'locker', 2740, 494, 50, 40, 74);
  b.prop(P, 'locker', 2795, 494, 50, 40, 74);
  b.st('locker_crew1', P, 2765, 470, 'locker', 'Taquilla de tripulación 1');
  b.st('locker_crew2', P, 2820, 470, 'locker', 'Taquilla de tripulación 2');
  b.prop(P, 'crewLog', 2930, 390, 56, 40, 36);
  b.st('k1_registro', P, 2910, 360, 'knife', 'Registro de cabina');
  b.prop(P, 'serviceHatch', 2870, 470, 80, 56, 6, { solid: false, flat: true });
  b.prop(P, 'vent', 2740, 390, 36, 26, 2, { solid: false, flat: true });

  // =============== NIVEL TÉCNICO ===============
  b.hwall(T, 360, 2950, 64, HW, { kind: 'hull' });
  b.hwall(T, 360, 2950, 480, 22, { kind: 'hull', face: false });
  b.vwall(T, 360, 120, 480, 20, { kind: 'hull' });
  b.vwall(T, 2932, 120, 480, VW, { kind: 'hull' });
  b.room('ee', 'Equipos eléctricos', T, R(380, 120, 320, 360), 'grate', 'cold', '#ffd23f', 'z_ee');
  b.vwall(T, 700, 120, 480, VW, { kind: 'partition', openings: [{ at: 300, door: { id: 'd_ee', name: 'Equipos eléctricos', lockable: true } }] });
  b.prop(T, 'avionicsRack', 390, 120, 60, 40, 70, { anim: 'blink' });
  b.prop(T, 'avionicsRack', 460, 120, 60, 40, 70, { anim: 'blink' });
  b.prop(T, 'powerPanel', 540, 120, 120, 20, 56, { anim: 'blink' });
  b.st('crit_nav_power', T, 600, 170, 'repair', 'Distribución de navegación');
  b.prop(T, 'wiringPanel', 390, 300, 18, 100, 52);
  b.st('wiring_ee', T, 440, 350, 'task', 'Cuadro de cableado');
  b.prop(T, 'breakerPanel', 420, 440, 100, 40, 46, { anim: 'blink' });
  b.st('rep_lights', T, 470, 414, 'repair', 'Cuadro general de luces');
  b.prop(T, 'navComputer', 540, 440, 80, 40, 46, { anim: 'screen' });
  b.st('sab_nav', T, 580, 414, 'sabotage', 'Ordenador de navegación');
  b.prop(T, 'fuseBox', 460, 220, 18, 60, 46, { anim: 'blink' });
  b.st('fuses_ee', T, 500, 250, 'task', 'Caja de fusibles');
  b.prop(T, 'serviceLadder', 600, 440, 80, 40, 10, { solid: false, flat: true });
  b.prop(T, 'vent', 640, 270, 36, 26, 2, { solid: false, flat: true });

  b.room('bodegaD', 'Bodega delantera', T, R(718, 120, 582, 360), 'concrete', 'dim', '#f4a261', 'z_bodD');
  b.vwall(T, 1300, 120, 480, VW, { kind: 'partition', openings: [{ at: 300, w: 90 }] });
  for (let k = 0; k < 3; k++) b.prop(T, 'uld', 740 + k * 130, 130, 110, 80, 70, { variant: k });
  for (let k = 0; k < 2; k++) b.prop(T, 'uld', 740 + k * 130, 390, 110, 80, 70, { variant: k + 3 });
  b.prop(T, 'conveyor', 1050, 380, 220, 60, 30, { anim: 'fan' });
  b.st('sorting_bodega', T, 1160, 350, 'task', 'Cinta de clasificación');
  b.st('k3_contenedor', T, 1185, 230, 'knife', 'Contenedor de mantenimiento');
  b.prop(T, 'crate', 1150, 130, 80, 60, 46);
  b.st('k2_bodega', T, 870, 300, 'knife', 'Maleta sin etiqueta');
  b.prop(T, 'vent', 1240, 160, 36, 26, 2, { solid: false, flat: true });

  // Corredor central del nivel técnico
  b.room('corredorT', 'Corredor técnico', T, R(1318, 255, 1000, 90), 'grate', 'cold', '#8d99ae', 'z_centro');
  b.hwall(T, 1318, 2318, 225, 30, { kind: 'partition', openings: [{ at: 1460, w: 80, door: { id: 'd_comms', name: 'Comunicaciones' } }, { at: 1810, w: 80, door: { id: 'd_presion', name: 'Presión', lockable: true } }, { at: 2160, w: 80, door: { id: 'd_taller', name: 'Taller' } }] });
  b.hwall(T, 1318, 2318, 345, 30, { kind: 'partition', openings: [{ at: 1460, w: 80, door: { id: 'd_seg', name: 'Seguridad' } }, { at: 1960, w: 80, door: { id: 'd_vent', name: 'Ventilación', lockable: true } }] });
  b.vwall(T, 1600, 120, 225, VW, { kind: 'partition' });
  b.vwall(T, 2000, 120, 225, VW, { kind: 'partition' });
  b.vwall(T, 1600, 375, 480, VW, { kind: 'partition' });
  b.vwall(T, 2318, 120, 480, VW, { kind: 'partition', openings: [{ at: 300, w: 90 }] });
  b.room('commsT', 'Comunicaciones', T, R(1318, 120, 282, 105), 'lino', 'cold', '#5ce1e6', 'z_centro');
  b.prop(T, 'radioDesk', 1330, 120, 110, 36, 44, { anim: 'screen' });
  b.st('rep_comms', T, 1385, 186, 'repair', 'Equipo de radio');
  b.prop(T, 'cableRack', 1520, 120, 70, 30, 50, { anim: 'blink' });
  b.st('sab_comms', T, 1555, 186, 'sabotage', 'Bastidor de antena');
  b.room('segT', 'Seguridad', T, R(1318, 375, 282, 105), 'lino', 'cold', '#4d96ff', 'z_centro');
  b.prop(T, 'monitors', 1330, 440, 130, 40, 50, { anim: 'screen' });
  b.st('cams_seg', T, 1395, 414, 'cameras', 'Monitores de cámaras');
  b.prop(T, 'occupancyPanel', 1480, 455, 60, 25, 54, { anim: 'screen' });
  b.st('occ_seg', T, 1510, 422, 'occupancy', 'Panel de ocupación');
  b.prop(T, 'accessControl', 1560, 380, 30, 60, 48, { anim: 'blink' });
  b.st('sab_doors', T, 1540, 420, 'sabotage', 'Control de accesos');
  b.room('presion', 'Sistemas de presión', T, R(1618, 120, 382, 105), 'metal', 'cold', '#00b4d8', 'z_centro');
  b.prop(T, 'outflowValves', 1630, 120, 120, 30, 50, { anim: 'blink' });
  b.st('crit_pressure_valves', T, 1690, 190, 'repair', 'Válvulas de descarga');
  b.prop(T, 'pressurePanel', 1860, 120, 120, 30, 50, { anim: 'screen' });
  b.st('cabinPressure_panel', T, 1920, 190, 'task', 'Unidad de presurización');
  b.room('ventilacion', 'Ventilación', T, R(1618, 375, 700, 105), 'metal', 'cold', '#90e0ef', 'z_centro');
  b.prop(T, 'airPack', 1640, 420, 160, 60, 50, { anim: 'fan' });
  b.st('filter_vent', T, 1720, 400, 'task', 'Filtro del pack de aire');
  b.prop(T, 'valvePanel', 2050, 440, 90, 40, 46);
  b.st('pressure_hyd', T, 2095, 414, 'task', 'Válvulas hidráulicas');
  b.prop(T, 'outflowControl', 2200, 440, 90, 40, 46, { anim: 'blink' });
  b.st('sab_pressure', T, 2245, 414, 'sabotage', 'Control de descarga');
  b.room('tallerT', 'Taller técnico', T, R(2018, 120, 300, 105), 'concrete', 'neutral', '#adb5bd', 'z_centro');
  b.prop(T, 'workbench', 2030, 120, 130, 36, 40);
  b.st('k3_taller', T, 2095, 190, 'knife', 'Cajón de piezas');
  b.prop(T, 'junctionBox', 2200, 120, 80, 30, 44);
  b.st('sab_lights', T, 2240, 190, 'sabotage', 'Caja de derivación');
  b.prop(T, 'vent', 1860, 300, 36, 26, 2, { solid: false, flat: true });

  b.room('bodegaT', 'Bodega trasera', T, R(2336, 120, 596, 360), 'concrete', 'dim', '#e76f51', 'z_bodT');
  for (let k = 0; k < 3; k++) b.prop(T, 'uld', 2360 + k * 130, 130, 110, 80, 70, { variant: k + 1 });
  b.prop(T, 'luggage', 2380, 400, 120, 70, 40);
  b.st('k4_bodega', T, 2560, 420, 'knife', 'Contenedor precintado con código');
  b.prop(T, 'toolChest', 2520, 440, 80, 40, 40);
  b.prop(T, 'commsTerminal', 2720, 130, 80, 30, 46, { anim: 'screen' });
  b.st('term_trasera', T, 2760, 196, 'commsTerminal', 'Terminal de la bodega');
  b.prop(T, 'locker', 2870, 130, 50, 36, 74);
  b.st('locker_bodega', T, 2895, 196, 'locker', 'Taquilla de la bodega');
  b.prop(T, 'serviceLadder', 2830, 440, 80, 40, 10, { solid: false, flat: true });
  b.prop(T, 'vent', 2700, 330, 36, 26, 2, { solid: false, flat: true });

  // =============== ACCESOS DE SERVICIO (únicos entre niveles) ===============
  const ladders: LadderDef[] = [
    { id: 'acc1', name: 'Acceso de servicio delantero', kind: 'ladder', a: { level: P, x: 640, y: 450 }, b: { level: T, x: 640, y: 450 } },
    { id: 'acc2', name: 'Acceso de servicio trasero', kind: 'ladder', a: { level: P, x: 2870, y: 450 }, b: { level: T, x: 2870, y: 450 } },
  ];
  for (const l of ladders) {
    b.st(`${l.id}_a`, P, l.a.x, l.a.y, 'ladder', `${l.name} (bajar)`);
    b.st(`${l.id}_b`, T, l.b.x, l.b.y, 'ladder', `${l.name} (subir)`);
  }

  const vents = [
    { id: 'v_vest', name: 'Trampilla del vestíbulo', level: P, x: 738, y: 343, links: ['v_galley'] },
    { id: 'v_galley', name: 'Trampilla de la cocina', level: P, x: 1678, y: 253, links: ['v_vest', 'v_desc'] },
    { id: 'v_desc', name: 'Trampilla de descanso', level: P, x: 2758, y: 403, links: ['v_galley'] },
    { id: 'v_ee', name: 'Trampilla de equipos', level: T, x: 658, y: 283, links: ['v_bod'] },
    { id: 'v_bod', name: 'Trampilla de la bodega', level: T, x: 1258, y: 173, links: ['v_ee'] },
    { id: 'v_vent', name: 'Trampilla del corredor', level: T, x: 1878, y: 313, links: ['v_bodT'] },
    { id: 'v_bodT', name: 'Trampilla de la bodega trasera', level: T, x: 2718, y: 343, links: ['v_vent'] },
  ];
  for (const v of vents) b.st(v.id, v.level, v.x, v.y, 'vent', v.name, { range: 56 });

  return b.finish({
    id: 'plane',
    name: 'Avión · El Vuelo',
    levels: [
      { id: P, name: 'Pasajeros', index: 1, bounds: R(-200, -1500, 4000, 3600), outline: [PLANE.FUSELAGE] },
      { id: T, name: 'Técnico', index: 0, bounds: R(-200, -1500, 4000, 3600), outline: [PLANE.FUSELAGE] },
    ],
    ladders,
    vents,
    escapistLinks: [['v_vest', 'v_desc'], ['v_bod', 'v_vent']],
    cameras: [
      { id: 'cam1', name: 'Pasillos delanteros', level: P, x: 1160, y: 66, view: R(840, 40, 640, 360) },
      { id: 'cam2', name: 'Cocina central', level: P, x: 1680, y: 66, view: R(1360, 130, 640, 360) },
      { id: 'cam3', name: 'Pasillos traseros', level: P, x: 2360, y: 66, view: R(2040, 130, 640, 360) },
      { id: 'cam4', name: 'Bodega delantera', level: T, x: 1000, y: 120, view: R(690, 110, 640, 360) },
    ],
    zones: [
      { id: 'z_cockpit', name: 'Cabina de pilotos', level: P }, { id: 'z_vest', name: 'Vestíbulo', level: P },
      { id: 'z_del', name: 'Pasajeros delantera', level: P }, { id: 'z_cocina', name: 'Cocina y aseos', level: P },
      { id: 'z_tras', name: 'Pasajeros trasera', level: P }, { id: 'z_desc', name: 'Descanso', level: P },
      { id: 'z_ee', name: 'Equipos eléctricos', level: T }, { id: 'z_bodD', name: 'Bodega delantera', level: T },
      { id: 'z_centro', name: 'Sección central técnica', level: T }, { id: 'z_bodT', name: 'Bodega trasera', level: T },
    ],
    doorGroups: [
      { id: 'dg_cabina', name: 'Cabina de vuelo', doors: ['d_cockpit'] },
      { id: 'dg_tec', name: 'Nivel técnico', doors: ['d_ee', 'd_presion', 'd_vent'] },
    ],
    interference: [
      { station: 'term_trasera', name: 'Sección trasera', cameras: ['cam2', 'cam3'], zones: ['z_cocina', 'z_tras', 'z_desc', 'z_bodT', 'z_centro'], stations: ['cams_seg', 'occ_seg'] },
      { station: 'term_dummy_none', name: '—', cameras: [], zones: [], stations: [] },
    ].filter((z) => z.station !== 'term_dummy_none'),
    sabotages: [
      { id: 'lights', kind: 'lights', name: 'Apagón', activation: ['sab_lights'], repair: [{ stations: ['rep_lights'], minigame: 'rep_lights', label: 'Restablecer el cuadro (Equipos eléctricos, técnico)' }], alarm: 'lights' },
      { id: 'comms', kind: 'comms', name: 'Comunicaciones', activation: ['sab_comms'], repair: [{ stations: ['rep_comms'], minigame: 'rep_comms', label: 'Sintonizar la radio (Comunicaciones, técnico)' }], alarm: 'comms' },
      { id: 'doors', kind: 'doors', name: 'Puertas', activation: ['sab_doors'], repair: [], alarm: 'doors' },
      {
        id: 'pressure', kind: 'critical', name: 'Pérdida de presión', activation: ['sab_pressure'],
        repair: [
          { stations: ['crit_pressure_valves'], minigame: 'crit_valves', label: 'Restablecer las válvulas (Presión, técnico)' },
          { stations: ['crit_pressure_seal'], minigame: 'crit_seal', label: 'Confirmar el sellado (Vestíbulo, pasajeros)' },
        ],
        failTitle: 'Despresurización', failText: 'La cabina perdió la presión y El Vuelo descendió fuera de control hasta un amerizaje desastroso.', failScene: 'crash', alarm: 'critical',
      },
      {
        id: 'nav', kind: 'critical', name: 'Fallo eléctrico de navegación', activation: ['sab_nav'],
        repair: [
          { stations: ['crit_nav_power'], minigame: 'crit_power', label: 'Recomponer la distribución (Equipos eléctricos)' },
          { stations: ['crit_nav_confirm'], minigame: 'crit_navalign', label: 'Confirmar en cabina de pilotos' },
        ],
        failTitle: 'Vuelo a ciegas', failText: 'Sin navegación, El Vuelo se adentró en la tormenta y perdió el control.', failScene: 'crash', alarm: 'critical',
      },
    ],
    tasks: [
      { id: 'orders', type: 'orders', name: 'Servir comidas', length: 'long', stages: [{ stations: ['orders_pick'], label: 'Recoge la bandeja en la Cocina central' }, { stations: ['orders_s1', 'orders_s2', 'orders_s3', 'orders_s4'], label: 'Sirve al pasajero de la fila' }] },
      { id: 'cooking', type: 'cooking', name: 'Calentar menús', length: 'short', stages: [{ stations: ['cooking_galley'], label: 'Prepara los menús en los hornos' }] },
      { id: 'drink', type: 'drink', name: 'Servir café', length: 'short', stages: [{ stations: ['drink_galley'], label: 'Sirve café en la Cocina central' }] },
      { id: 'dishes', type: 'dishes', name: 'Fregar vajilla', length: 'short', stages: [{ stations: ['dishes_galley'], label: 'Friega en la Cocina central' }] },
      { id: 'toilet', type: 'toilet', name: 'Limpiar aseo', length: 'short', stages: [{ stations: ['toilet_lavN', 'toilet_lavS'], label: 'Limpia y repón el aseo' }] },
      { id: 'wiring', type: 'wiring', name: 'Reparar cableado', length: 'short', stages: [{ stations: ['wiring_ee'], label: 'Une los cables en Equipos eléctricos' }] },
      { id: 'fuses', type: 'fuses', name: 'Cambiar fusible', length: 'short', stages: [{ stations: ['fuses_ee'], label: 'Sustituye el fusible averiado' }] },
      { id: 'pressure', type: 'pressure', name: 'Ajustar hidráulica', length: 'short', stages: [{ stations: ['pressure_hyd'], label: 'Ajusta las válvulas hidráulicas' }] },
      { id: 'filter', type: 'filter', name: 'Limpiar filtro de aire', length: 'long', stages: [{ stations: ['filter_vent'], label: 'Extrae, limpia y reinstala el filtro' }] },
      { id: 'assist', type: 'assist', name: 'Asistir al piloto', length: 'short', stages: [{ stations: ['assist_cockpit'], label: 'Reproduce la secuencia del panel superior' }] },
      { id: 'luggage', type: 'luggage', name: 'Ordenar compartimentos', length: 'short', stages: [{ stations: ['luggage_binsF', 'luggage_binsR'], label: 'Coloca el equipaje de mano' }] },
      { id: 'carts', type: 'carts', name: 'Asegurar carros', length: 'short', exclusive: true, stages: [{ stations: ['carts_galley'], label: 'Bloquea los carros de servicio' }] },
      { id: 'sorting', type: 'sorting', name: 'Clasificar equipaje', length: 'short', exclusive: true, stages: [{ stations: ['sorting_bodega'], label: 'Clasifica maletas por destino en la bodega' }] },
      { id: 'cabinPressure', type: 'cabinPressure', name: 'Calibrar presurización', length: 'long', exclusive: true, stages: [{ stations: ['cabinPressure_panel'], label: 'Calibra la unidad de presión (técnico)' }, { stations: ['crit_pressure_seal'], label: 'Verifica el panel de la puerta L1' }] },
    ],
    knife: {
      docName: 'partes de vuelo manipulados',
      keyName: 'llave de precintos',
      compartmentName: 'contenedor de mantenimiento',
      containerName: 'contenedor con combinación',
      authName: 'autorización de la puerta de cabina',
      stages: [
        { stations: ['k1_partes', 'k1_registro'], label: 'Consulta los partes de vuelo manipulados' },
        { stations: ['k2_bolsillo', 'k2_mantas', 'k2_bodega'], label: 'Busca la llave de precintos' },
        { stations: ['k3_contenedor', 'k3_taller'], label: 'Abre el contenedor de mantenimiento' },
        { stations: ['k4_galley', 'k4_bodega'], label: 'Abre el contenedor y coge el cuchillo' },
        { stations: ['k5_cabina'], label: 'Manipula la autorización de la cabina' },
      ],
    },
    responsible: {
      title: 'Piloto', name: 'Piloto Okafor', level: P, room: 'cockpit',
      patrol: [{ x: 430, y: 300 }, { x: 470, y: 200 }, { x: 500, y: 300 }, { x: 460, y: 390 }],
    },
    npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: P, x: 2760 + (k % 3) * 60, y: 140 + Math.floor(k / 3) * 40 }, { level: P, x: 2760 + (k % 3) * 60, y: 380 + Math.floor(k / 3) * 30 }]),
    safePoints: [],
    meetingRoom: 'descanso',
    texts: {
      vehicle: 'El Vuelo',
      short: 'AVIÓN',
      description: 'Avión de fuselaje ancho con doble pasillo y un nivel técnico bajo la cabina.',
      routes: 'Doble pasillo, cocina central de paso y dos accesos de servicio al nivel técnico.',
      arrivalTitle: 'Aterrizaje perfecto',
      arrivalText: 'El Vuelo toma tierra con suavidad. Aplausos en la cabina.',
      murderTitle: 'Avión sin piloto',
      murderText: 'Sin nadie a los mandos, El Vuelo entra en barrena y se estrella de forma muy aparatosa.',
      accessGoal: 'Accede al piloto',
      approach: 'Aproximación final',
      ejectText: 'La compuerta del vestíbulo de servicio se abre y…',
    },
    critTimeScale: 0.95,
    theme: {
      scenery: 'sky', bg: '#8ec5ff', hull: '#e9eef5', hullDark: '#b8c3d3', trim: '#2f6fb3',
      wallTop: '#4a5568', wallFace: '#eef1f6', wallFaceDark: '#cdd5e1', accent: '#2f6fb3', metal: '#c0c8d4',
    },
  });
}
