import { HW, MapBuilder, R, VW } from './builder';
import type { LadderDef, MapDef, NpcSeat } from './types';

/**
 * BARCO — EL FERRY
 * Proa a la izquierda. Tres cubiertas en las mismas coordenadas:
 *  - inferior (técnica): huella x 600–3240, y 240–880
 *  - principal: casco completo x 60–3480, y 40–1060, interior x 700–3100
 *  - superior: x 750–3090, y 180–920 (superestructura + paseo)
 * Las escaleras usan exactamente la misma X/Y en ambas cubiertas.
 */
export const SHIP = {
  MAIN_HULL: [
    { x: 60, y: 550 }, { x: 200, y: 360 }, { x: 420, y: 190 }, { x: 700, y: 70 }, { x: 900, y: 44 },
    { x: 3300, y: 44 }, { x: 3440, y: 50 }, { x: 3480, y: 110 }, { x: 3480, y: 990 }, { x: 3440, y: 1050 },
    { x: 3300, y: 1056 }, { x: 900, y: 1056 }, { x: 700, y: 1030 }, { x: 420, y: 910 }, { x: 200, y: 740 }, { x: 60, y: 550 },
  ],
  LOWER_HULL: [
    { x: 420, y: 560 }, { x: 560, y: 330 }, { x: 610, y: 240 }, { x: 3200, y: 240 }, { x: 3330, y: 300 },
    { x: 3330, y: 820 }, { x: 3200, y: 880 }, { x: 610, y: 880 }, { x: 560, y: 790 }, { x: 420, y: 560 },
  ],
  UPPER_DECK: [
    { x: 740, y: 170 }, { x: 3100, y: 170 }, { x: 3100, y: 930 }, { x: 740, y: 930 }, { x: 740, y: 170 },
  ],
};

export function buildShip(): MapDef {
  const b = new MapBuilder();
  const L = 'lower', M = 'main', U = 'upper';
  const npcs: NpcSeat[] = [];

  // =============== CUBIERTA PRINCIPAL ===============
  // Bordas y barandillas exteriores
  b.rail(M, [{ x: 700, y: 73 }, { x: 440, y: 196 }, { x: 230, y: 360 }, { x: 116, y: 550 }, { x: 230, y: 740 }, { x: 440, y: 904 }, { x: 700, y: 1027 }]);
  b.hullPoly(M, [{ x: 700, y: 58 }, { x: 420, y: 178 }, { x: 196, y: 352 }, { x: 70, y: 550 }, { x: 196, y: 748 }, { x: 420, y: 922 }, { x: 700, y: 1042 }], 22);
  b.hwall(M, 700, 3460, 52, 18, { kind: 'rail', occludes: false, face: false });
  b.hwall(M, 700, 3460, 1030, 18, { kind: 'rail', occludes: false, face: false });
  b.vwall(M, 3442, 52, 1048, 18, { kind: 'rail', occludes: false });
  b.room('proa', 'Cubierta de proa', M, R(130, 200, 570, 700), 'deck', 'exterior', '#6ec1e4', 'z_ext', [R(330, 120, 370, 80), R(330, 900, 370, 80)], true);
  b.room('bandaN', 'Cubierta exterior babor', M, R(700, 70, 2400, 80), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);
  b.room('bandaS', 'Cubierta exterior estribor', M, R(700, 950, 2400, 80), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);
  b.room('popa', 'Cubierta de popa', M, R(3100, 70, 342, 960), 'deck', 'exterior', '#6ec1e4', 'z_ext', undefined, true);
  // Caja interior
  const winN: number[] = []; for (let x = 780; x < 3060; x += 110) winN.push(x);
  b.hwall(M, 700, 3100, 150, HW, { kind: 'hull', windows: winN, openings: [{ at: 1000, door: { id: 'd_recN', name: 'Puerta babor de recepción', lockable: true } }] });
  b.hwall(M, 700, 3100, 930, 20, { kind: 'hull', face: false, openings: [{ at: 1000, door: { id: 'd_recS', name: 'Puerta estribor de recepción', lockable: true } }] });
  b.vwall(M, 700, 206, 930, VW, { kind: 'hull', openings: [{ at: 568, door: { id: 'd_proa', name: 'Puerta de proa', lockable: true } }] });
  b.vwall(M, 3082, 206, 930, VW, { kind: 'hull', openings: [{ at: 380, door: { id: 'd_persE', name: 'Puerta del personal a popa', lockable: true } }, { at: 760, door: { id: 'd_popa', name: 'Puerta de popa', lockable: true } }] });

  // Recepción
  b.room('recepcion', 'Recepción', M, R(718, 206, 432, 724), 'checker', 'warm', '#ffb347', 'z_recep');
  b.vwall(M, 1150, 206, 930, VW, { kind: 'partition', openings: [{ at: 381, w: 90 }, { at: 566, w: 110 }, { at: 751, w: 90 }] });
  b.prop(M, 'receptionDesk', 790, 470, 200, 60, 40, { anim: 'screen' });
  b.st('k1_manifiesto', M, 890, 556, 'knife', 'Manifiesto de pasajeros');
  b.prop(M, 'stairsUp', 1075, 296, 70, 84, 40);
  b.prop(M, 'stairsDown', 860, 800, 80, 80, 10);
  b.prop(M, 'emergencyButton', 820, 206, 44, 16, 40);
  b.st('btn1', M, 842, 248, 'emergency', 'Botón de emergencia');
  b.prop(M, 'sofa', 740, 300, 50, 120, 36);
  b.prop(M, 'plant', 740, 860, 30, 30, 50);
  b.prop(M, 'plant', 1100, 860, 30, 30, 50);
  b.prop(M, 'vent', 980, 640, 40, 30, 2, { solid: false, flat: true });
  b.prop(M, 'board', 960, 206, 80, 14, 50, { anim: 'screen', solid: false });
  npcs.push({ id: 'n_rec1', level: M, x: 768, y: 340, facing: 1, pose: 'sit', act: 'phone' });
  npcs.push({ id: 'n_rec2', level: M, x: 768, y: 390, facing: 1, pose: 'sit', act: 'read' });

  // Camarotes norte (5) + pasillo norte
  b.hwall(M, 1168, 2550, 306, 30, { kind: 'partition', openings: [0, 1, 2, 3, 4].map((k) => ({ at: 1168 + 138 + 276 * k, w: 70, door: { id: `d_cabN${k + 1}`, name: `Camarote ${k + 1}` } })) });
  for (let k = 1; k < 5; k++) b.vwall(M, 1168 + 276 * k - 9, 206, 306, VW, { kind: 'partition' });
  for (let k = 0; k < 5; k++) {
    const cx = 1168 + 276 * k;
    b.room(`camN${k + 1}`, `Camarote ${k + 1}`, M, R(cx + (k ? 9 : 0), 206, 276 - (k ? 18 : 9), 100), 'cabin', 'warm', '#e8a87c', 'z_cab');
    b.prop(M, 'bed', cx + 20, 210, 90, 50, 26, { variant: k });
    b.prop(M, 'wardrobe', cx + 200, 206, 56, 26, 64, { variant: k });
    if (k === 1 || k === 4) npcs.push({ id: `n_cab${k}`, level: M, x: cx + 60, y: 236, facing: 1, pose: 'sit', act: 'sleep' });
  }
  b.st('locker_cab', M, 1168 + 276 + 228, 260, 'locker', 'Armario del camarote 2');
  b.st('k2_camarote', M, 1168 + 276 * 2 + 228, 262, 'knife', 'Armario del camarote 3');
  b.st('toilet_cab', M, 1168 + 276 * 3 + 160, 262, 'task', 'Baño del camarote 4');
  b.prop(M, 'washbasin', 1168 + 276 * 3 + 150, 206, 24, 22, 30);
  b.prop(M, 'vent', 1168 + 276 * 4 + 120, 262, 36, 26, 2, { solid: false, flat: true });
  b.room('pasilloN', 'Pasillo de camarotes norte', M, R(1168, 336, 1382, 90), 'carpet', 'warm', '#d4a373', 'z_cab');

  // Bloque central: restaurante | cocina | despensa
  b.hwall(M, 1168, 2550, 426, 30, { kind: 'partition', openings: [{ at: 1534, door: { id: 'd_restN', name: 'Restaurante (norte)', lockable: true } }] });
  b.hwall(M, 1168, 2550, 676, 30, { kind: 'partition', openings: [{ at: 1534, door: { id: 'd_restS', name: 'Restaurante (sur)', lockable: true } }, { at: 2109, w: 80, door: { id: 'd_cocS', name: 'Cocina (sur)' } }] });
  b.vwall(M, 1900, 456, 676, VW, { kind: 'partition', openings: [{ at: 566, w: 80, door: { id: 'd_rest_coc', name: 'Paso restaurante-cocina' } }] });
  b.vwall(M, 2300, 456, 676, VW, { kind: 'partition', openings: [{ at: 566, w: 70, door: { id: 'd_desp', name: 'Despensa' } }] });
  b.vwall(M, 2550, 206, 930, VW, { kind: 'partition', openings: [{ at: 381, w: 90 }, { at: 566, w: 70, door: { id: 'd_despE', name: 'Despensa (popa)' } }, { at: 751, w: 90 }] });
  b.room('restaurante', 'Restaurante', M, R(1168, 456, 732, 220), 'parquet', 'warm', '#ff6b6b', 'z_rest');
  b.room('cocina', 'Cocina', M, R(1918, 456, 382, 220), 'tile', 'warm', '#ff9f43', 'z_rest');
  b.room('despensa', 'Despensa', M, R(2318, 456, 232, 220), 'tile', 'dim', '#c08552', 'z_rest');
  const rt = [
    { x: 1220, y: 480 }, { x: 1400, y: 480 }, { x: 1220, y: 590 }, { x: 1400, y: 590 },
  ];
  rt.forEach((t, k) => {
    b.prop(M, 'roundTable', t.x, t.y, 70, 56, 32, { variant: k });
    b.st(`orders_t${k + 1}`, M, t.x + 35 + (k % 2 ? 90 : 90), t.y + 30, 'task', `Mesa ${k + 1}`);
    npcs.push({ id: `n_rt${k}a`, level: M, x: t.x - 12, y: t.y + 30, facing: 1, pose: 'sit', act: k % 2 ? 'talk' : 'order', station: `orders_t${k + 1}` });
    npcs.push({ id: `n_rt${k}b`, level: M, x: t.x + 82, y: t.y + 30, facing: -1, pose: 'sit', act: 'talk', station: `orders_t${k + 1}` });
  });
  b.prop(M, 'barCounter', 1640, 470, 40, 150, 44);
  b.prop(M, 'coffeeMachine', 1760, 456, 70, 26, 52, { anim: 'steam' });
  b.st('drink_rest', M, 1795, 512, 'task', 'Barra del restaurante');
  b.st('k2_barra', M, 1730, 640, 'knife', 'Caja de propinas');
  b.prop(M, 'vent', 1590, 640, 36, 26, 2, { solid: false, flat: true });
  b.prop(M, 'stove', 1940, 456, 80, 42, 42, { anim: 'steam' });
  b.st('cooking_coc', M, 1980, 526, 'task', 'Fogones');
  b.prop(M, 'sink', 2030, 456, 70, 42, 40, { anim: 'liquid' });
  b.st('dishes_coc', M, 2065, 526, 'task', 'Fregadero');
  b.prop(M, 'passWindow', 2110, 456, 80, 42, 44);
  b.st('orders_pick', M, 2150, 526, 'task', 'Pase de comandas');
  b.prop(M, 'fridge', 2220, 456, 60, 44, 66);
  b.prop(M, 'knifeDrawer', 1940, 640, 100, 36, 36);
  b.st('k4_cocina', M, 1990, 618, 'knife', 'Cajón de cuchillos cerrado');
  b.prop(M, 'shelf', 2330, 456, 200, 24, 64);
  b.prop(M, 'crate', 2470, 610, 60, 50, 40);
  b.st('k2_despensa', M, 2420, 510, 'knife', 'Latas de la despensa');

  // Fila sur: baños | enfermería | camarotes sur
  b.hwall(M, 1168, 2550, 796, 30, { kind: 'partition', openings: [{ at: 1334, w: 80, door: { id: 'd_banos', name: 'Baños' } }, { at: 1709, w: 80, door: { id: 'd_enf', name: 'Enfermería' } }, { at: 2076, w: 70, door: { id: 'd_cabS1', name: 'Camarote 6' } }, { at: 2401, w: 70, door: { id: 'd_cabS2', name: 'Camarote 7' } }] });
  b.vwall(M, 1500, 826, 930, VW, { kind: 'partition' });
  b.vwall(M, 1900, 826, 930, VW, { kind: 'partition' });
  b.vwall(M, 2234, 826, 930, VW, { kind: 'partition' });
  b.room('pasilloS', 'Pasillo de camarotes sur', M, R(1168, 706, 1382, 90), 'carpet', 'warm', '#d4a373', 'z_sur');
  b.room('banos', 'Baños', M, R(1168, 826, 332, 104), 'tile', 'cold', '#7bdff2', 'z_sur');
  b.room('enfermeria', 'Enfermería', M, R(1518, 826, 382, 104), 'lino', 'cold', '#9ef01a', 'z_sur');
  b.room('camS1', 'Camarote 6', M, R(1918, 826, 316, 104), 'cabin', 'warm', '#e8a87c', 'z_sur');
  b.room('camS2', 'Camarote 7', M, R(2252, 826, 298, 104), 'cabin', 'warm', '#e8a87c', 'z_sur');
  b.prop(M, 'toilet', 1190, 896, 36, 34, 30);
  b.prop(M, 'toilet', 1420, 896, 36, 34, 30);
  b.prop(M, 'washbasin', 1250, 906, 60, 24, 30);
  b.st('toilet_banos', M, 1300, 870, 'task', 'Baños públicos');
  b.prop(M, 'medBed', 1540, 870, 110, 50, 30);
  b.prop(M, 'medCabinet', 1800, 900, 80, 30, 60);
  b.st('k2_botiquin', M, 1840, 870, 'knife', 'Botiquín');
  b.prop(M, 'vent', 1690, 880, 36, 26, 2, { solid: false, flat: true });
  b.prop(M, 'bed', 1940, 870, 90, 50, 26, { variant: 2 });
  b.prop(M, 'bed', 2440, 870, 90, 50, 26, { variant: 3 });
  b.prop(M, 'suitcase', 2160, 890, 50, 30, 30);
  npcs.push({ id: 'n_cabS', level: M, x: 1980, y: 896, facing: 1, pose: 'sit', act: 'read' });

  // Popa: pasillo transversal, sala de personal y vestíbulo de popa
  b.room('transversal', 'Pasillo transversal de popa', M, R(2568, 206, 132, 724), 'carpet', 'neutral', '#d4a373', 'z_popa');
  b.vwall(M, 2700, 206, 930, VW, { kind: 'partition', openings: [{ at: 400, door: { id: 'd_personal', name: 'Sala de personal', lockable: true } }, { at: 750, door: { id: 'd_vest', name: 'Vestíbulo de popa', lockable: true } }] });
  b.hwall(M, 2718, 3082, 560, 30, { kind: 'partition' });
  b.room('personal', 'Sala de personal', M, R(2718, 206, 364, 354), 'parquet', 'warm', '#ff8a3d', 'z_popa');
  b.room('vestpopa', 'Vestíbulo de popa', M, R(2718, 590, 364, 340), 'checker', 'neutral', '#ffd166', 'z_popa');
  b.prop(M, 'meetingTable', 2820, 320, 160, 90, 34);
  b.prop(M, 'emergencyButton', 2880, 206, 44, 16, 40);
  b.st('btn2', M, 2902, 248, 'emergency', 'Botón de emergencia');
  b.prop(M, 'locker', 2740, 470, 50, 30, 74);
  b.prop(M, 'locker', 2795, 470, 50, 30, 74);
  b.st('locker_pers', M, 2765, 448, 'locker', 'Taquilla del personal');
  b.prop(M, 'noticeBoard', 3000, 206, 60, 14, 50, { solid: false });
  b.st('k1_tablon', M, 3030, 248, 'knife', 'Tablón de turnos');
  b.prop(M, 'vent', 3020, 500, 36, 26, 2, { solid: false, flat: true });
  b.prop(M, 'stairsDown', 2860, 800, 80, 80, 10);
  b.prop(M, 'stairsUp', 2990, 650, 80, 80, 40);
  b.prop(M, 'lifeVests', 2740, 600, 80, 24, 50);

  // Exterior: proa y popa
  b.prop(M, 'winch', 380, 500, 90, 100, 36);
  b.prop(M, 'bollard', 260, 520, 30, 30, 24);
  b.prop(M, 'bollard', 560, 260, 30, 30, 24);
  b.prop(M, 'bollard', 560, 830, 30, 30, 24);
  b.prop(M, 'lifering', 3410, 300, 20, 40, 30, { solid: false });
  b.prop(M, 'lifering', 3410, 760, 20, 40, 30, { solid: false });
  b.prop(M, 'bench', 3200, 200, 110, 34, 30);
  b.prop(M, 'bench', 3200, 860, 110, 34, 30);
  b.prop(M, 'flagPole', 3400, 520, 20, 20, 90, { anim: 'flag' });
  b.prop(M, 'deckBox', 3250, 500, 70, 50, 34);
  b.st('locker_popa', M, 3285, 580, 'locker', 'Arcón de cubierta');
  npcs.push({ id: 'n_popa1', level: M, x: 3255, y: 205, facing: 1, pose: 'sit', act: 'window' });
  npcs.push({ id: 'n_proa1', level: M, x: 520, y: 460, facing: -1, pose: 'stand', act: 'window', walk: [{ x: 520, y: 460 }, { x: 600, y: 380 }, { x: 600, y: 700 }, { x: 520, y: 640 }] });

  // =============== CUBIERTA INFERIOR ===============
  b.hullPoly(L, [{ x: 620, y: 300 }, { x: 440, y: 560 }, { x: 620, y: 820 }], 20);
  b.hwall(L, 600, 3240, 240, HW, { kind: 'hull' });
  b.hwall(L, 600, 3240, 860, 20, { kind: 'hull', face: false });
  b.vwall(L, 600, 296, 860, 20, { kind: 'hull' });
  b.vwall(L, 3222, 296, 860, VW, { kind: 'hull' });
  b.room('carga', 'Bodega de carga', L, R(620, 296, 780, 564), 'concrete', 'dim', '#f4a261', 'z_carga');
  b.vwall(L, 1400, 296, 860, VW, { kind: 'partition', openings: [{ at: 400, door: { id: 'd_cargaN', name: 'Carga ↔ distribución', lockable: true } }, { at: 578, w: 96 }, { at: 760, door: { id: 'd_cargaS', name: 'Carga ↔ generadores', lockable: true } }] });
  b.hwall(L, 1418, 2600, 494, 36, { kind: 'partition', openings: [{ at: 1609, w: 80, door: { id: 'd_dist', name: 'Distribución eléctrica' } }, { at: 2200, door: { id: 'd_maq', name: 'Máquinas', lockable: true } }] });
  b.hwall(L, 1418, 2600, 626, 30, { kind: 'partition', openings: [{ at: 1609, w: 80, door: { id: 'd_gen', name: 'Generadores' } }, { at: 2200, door: { id: 'd_bombas', name: 'Bombas de achique', lockable: true } }] });
  b.vwall(L, 1800, 296, 494, VW, { kind: 'partition' });
  b.vwall(L, 1800, 656, 860, VW, { kind: 'partition' });
  b.vwall(L, 2600, 296, 860, VW, { kind: 'partition', openings: [{ at: 400, door: { id: 'd_maqE', name: 'Máquinas ↔ taller', lockable: true } }, { at: 578, w: 96 }, { at: 760, door: { id: 'd_bombasE', name: 'Bombas ↔ taller', lockable: true } }] });
  b.room('corredorInf', 'Corredor de máquinas', L, R(1418, 530, 1182, 96), 'grate', 'cold', '#8d99ae', 'z_maq');
  b.room('distribucion', 'Distribución eléctrica', L, R(1418, 296, 382, 198), 'grate', 'cold', '#ffd23f', 'z_maq');
  b.room('generadores', 'Generadores', L, R(1418, 656, 382, 204), 'metal', 'cold', '#ffbe0b', 'z_maq');
  b.room('maquinasB', 'Sala de máquinas', L, R(1818, 296, 782, 198), 'metal', 'cold', '#ff7b54', 'z_maq');
  b.room('bombas', 'Bombas de achique', L, R(1818, 656, 782, 204), 'metal', 'cold', '#00b4d8', 'z_maq');
  b.room('taller', 'Taller', L, R(2618, 296, 604, 564), 'concrete', 'neutral', '#adb5bd', 'z_taller');
  // Carga
  for (let k = 0; k < 3; k++) b.prop(L, 'container', 700 + k * 200, 320, 150, 70, 70, { variant: k });
  b.prop(L, 'truck', 680, 560, 220, 100, 70);
  b.prop(L, 'crate', 1000, 600, 80, 70, 50);
  b.prop(L, 'crate', 1120, 640, 60, 60, 40);
  b.prop(L, 'cargoNet', 1150, 320, 160, 60, 36);
  b.st('luggage_carga', L, 1230, 410, 'task', 'Estiba de equipaje');
  b.prop(L, 'watertightDoor', 1000, 296, 80, 20, 60, { anim: 'blink' });
  b.st('seal_carga', L, 1040, 420, 'task', 'Junta estanca de la bodega');
  b.prop(L, 'hullPatch', 1240, 840, 100, 20, 30);
  b.st('crit_leak_patch', L, 1290, 812, 'repair', 'Vía de agua del casco');
  b.st('k3_carga', L, 960, 680, 'knife', 'Contenedor de mantenimiento');
  b.prop(L, 'stairsUp', 860, 800, 80, 80, 40);
  b.prop(L, 'vent', 700, 470, 40, 30, 2, { solid: false, flat: true });
  // Distribución eléctrica y generadores
  b.prop(L, 'wiringPanel', 1440, 296, 100, 18, 52);
  b.st('wiring_dist', L, 1490, 344, 'task', 'Cuadro de cableado');
  b.prop(L, 'breakerPanel', 1580, 296, 90, 18, 52, { anim: 'blink' });
  b.st('rep_lights', L, 1625, 344, 'repair', 'Cuadro general de luces');
  b.prop(L, 'junctionBox', 1700, 400, 80, 30, 44);
  b.st('sab_lights', L, 1700, 460, 'sabotage', 'Caja de derivación');
  b.prop(L, 'commsTerminal', 1440, 440, 70, 30, 48, { anim: 'screen' });
  b.st('term_dist', L, 1530, 456, 'commsTerminal', 'Terminal de distribución');
  b.prop(L, 'generator', 1440, 700, 140, 80, 60, { anim: 'fan' });
  b.prop(L, 'generator', 1620, 760, 140, 80, 60, { anim: 'fan' });
  b.prop(L, 'fuseBox', 1700, 656, 70, 18, 52, { anim: 'blink' });
  b.st('fuses_gen', L, 1735, 700, 'task', 'Caja de fusibles');
  // Máquinas
  b.prop(L, 'engine', 1900, 330, 280, 70, 70, { anim: 'fan' });
  b.prop(L, 'engine', 2240, 330, 280, 70, 70, { anim: 'fan' });
  b.prop(L, 'valvePanel', 1840, 296, 50, 30, 46);
  b.st('pressure_maq', L, 1865, 440, 'task', 'Válvulas de presión');
  b.st('filter_maq', L, 2190, 440, 'task', 'Filtro del motor');
  b.prop(L, 'controlStand', 2530, 296, 60, 50, 46, { anim: 'screen' });
  b.st('crit_prop_stab', L, 2530, 440, 'repair', 'Equipos de propulsión');
  b.st('sab_prop', L, 2050, 450, 'sabotage', 'Bomba de refrigeración');
  b.prop(L, 'steamPipe', 2560, 400, 18, 14, 60, { anim: 'steam', solid: false });
  b.prop(L, 'vent', 1840, 440, 36, 26, 2, { solid: false, flat: true });
  // Bombas de achique
  b.prop(L, 'bilgePump', 1860, 760, 120, 80, 50, { anim: 'fan' });
  b.st('bilge_bombas', L, 1920, 720, 'task', 'Bombas de achique');
  b.prop(L, 'pumpPanel', 2080, 820, 100, 40, 50, { anim: 'blink' });
  b.st('crit_leak_pumps', L, 2130, 790, 'repair', 'Arranque de las bombas');
  b.prop(L, 'seaValve', 2400, 820, 80, 40, 40);
  b.st('sab_leak', L, 2440, 790, 'sabotage', 'Válvula de toma de mar');
  b.prop(L, 'tank', 2250, 700, 90, 60, 60);
  // Taller
  b.prop(L, 'workbench', 2650, 296, 160, 44, 40);
  b.st('k3_taller', L, 2730, 366, 'knife', 'Cajón de piezas');
  b.prop(L, 'ballastPanel', 2900, 296, 110, 20, 54, { anim: 'blink' });
  b.st('ballast_taller', L, 2955, 344, 'task', 'Panel de lastre');
  b.prop(L, 'toolChest', 3100, 420, 80, 50, 40);
  b.st('k4_taller', L, 3080, 500, 'knife', 'Taquilla de herramientas con código');
  b.prop(L, 'locker', 3150, 600, 50, 30, 74);
  b.st('locker_taller', L, 3130, 660, 'locker', 'Taquilla del taller');
  b.prop(L, 'shelf', 2650, 680, 140, 24, 64);
  b.prop(L, 'stairsUp', 2860, 800, 80, 80, 40);
  b.prop(L, 'vent', 2700, 560, 36, 26, 2, { solid: false, flat: true });

  // =============== CUBIERTA SUPERIOR ===============
  b.hwall(U, 740, 3100, 166, 16, { kind: 'rail', occludes: false, face: false });
  b.hwall(U, 740, 3100, 920, 16, { kind: 'rail', occludes: false, face: false });
  b.vwall(U, 3084, 166, 936, 16, { kind: 'rail', occludes: false });
  b.vwall(U, 740, 166, 936, 16, { kind: 'rail', occludes: false });
  // Superestructura
  b.hwall(U, 770, 1750, 240, HW, { kind: 'hull', windows: [860, 960, 1300, 1420, 1540, 1660], openings: [{ at: 900, door: { id: 'd_aleta', name: 'Puente → alerón', lockable: true } }, { at: 1160, door: { id: 'd_vsupN', name: 'Vestíbulo superior (babor)' } }] });
  b.hwall(U, 770, 1750, 840, 20, { kind: 'hull', face: false, openings: [{ at: 1160, door: { id: 'd_vsupS', name: 'Vestíbulo superior (estribor)' } }] });
  b.vwall(U, 770, 296, 840, VW, { kind: 'hull' });
  b.vwall(U, 1732, 296, 840, VW, { kind: 'hull', openings: [{ at: 420, door: { id: 'd_radioE', name: 'Radio → paseo', lockable: true } }, { at: 720, door: { id: 'd_segE', name: 'Seguridad → paseo', lockable: true } }] });
  b.vwall(U, 1050, 296, 840, VW, { kind: 'partition', openings: [{ at: 568, door: { id: 'd_puente', name: 'Puerta del puente', lockable: true } }] });
  b.vwall(U, 1250, 296, 840, VW, { kind: 'partition', openings: [{ at: 420, door: { id: 'd_radio', name: 'Radio' } }, { at: 720, door: { id: 'd_seg', name: 'Seguridad' } }] });
  b.hwall(U, 1268, 1732, 550, 36, { kind: 'partition' });
  b.room('puente', 'Puente de mando', U, R(788, 296, 262, 544), 'rubber', 'cold', '#58b4ff', 'z_puente');
  b.room('vestsup', 'Vestíbulo superior', U, R(1068, 296, 182, 544), 'checker', 'neutral', '#ffd166', 'z_radio');
  b.room('radio', 'Comunicaciones', U, R(1268, 296, 464, 254), 'lino', 'cold', '#5ce1e6', 'z_radio');
  b.room('seguridad', 'Seguridad', U, R(1268, 586, 464, 254), 'lino', 'cold', '#4d96ff', 'z_radio');
  b.room('paseo', 'Paseo exterior', U, R(1750, 182, 1334, 738), 'deck', 'exterior', '#6ec1e4', 'z_paseo', [R(756, 182, 994, 58), R(756, 860, 994, 60)], true);
  // Puente
  b.prop(U, 'helm', 800, 520, 60, 96, 46, { anim: 'blink' });
  b.prop(U, 'radar', 800, 320, 90, 70, 46, { anim: 'screen' });
  b.st('assist_puente', U, 900, 360, 'task', 'Radar y cartas náuticas');
  b.prop(U, 'telegraph', 820, 720, 50, 50, 50);
  b.st('crit_prop_bridge', U, 900, 750, 'repair', 'Telégrafo de máquinas');
  b.prop(U, 'chartTable', 960, 300, 80, 50, 34);
  // Vestíbulo superior
  b.prop(U, 'stairsDownTop', 1075, 296, 70, 84, 10);
  b.prop(U, 'accessPanel', 1090, 520, 18, 60, 52, { anim: 'blink' });
  b.st('k5_puente', U, 1130, 600, 'knife', 'Autorización del puente');
  b.prop(U, 'vent', 1150, 760, 36, 26, 2, { solid: false, flat: true });
  // Radio
  b.prop(U, 'radioDesk', 1300, 296, 200, 44, 46, { anim: 'screen' });
  b.st('rep_comms', U, 1400, 372, 'repair', 'Equipo de radio');
  b.prop(U, 'cableRack', 1560, 296, 100, 30, 50, { anim: 'blink' });
  b.st('sab_comms', U, 1610, 360, 'sabotage', 'Bastidor de antena');
  b.prop(U, 'commsTerminal', 1560, 500, 100, 30, 46, { anim: 'screen' });
  b.st('term_radio', U, 1610, 474, 'commsTerminal', 'Terminal de radio');
  b.st('k1_diario', U, 1320, 500, 'knife', 'Diario de navegación');
  b.prop(U, 'bookShelf', 1290, 510, 60, 24, 50);
  // Seguridad
  b.prop(U, 'monitors', 1320, 586, 180, 44, 50, { anim: 'screen' });
  b.st('cams_seg', U, 1410, 662, 'cameras', 'Monitores de cámaras');
  b.prop(U, 'occupancyPanel', 1560, 586, 90, 18, 54, { anim: 'screen' });
  b.st('occ_seg', U, 1605, 640, 'occupancy', 'Panel de ocupación');
  b.prop(U, 'accessControl', 1300, 800, 100, 40, 48, { anim: 'blink' });
  b.st('sab_doors', U, 1350, 776, 'sabotage', 'Control de accesos');
  b.prop(U, 'deskDrawer', 1560, 790, 100, 50, 36);
  b.st('k2_mesa', U, 1610, 760, 'knife', 'Mesa del oficial de seguridad');
  // Paseo exterior
  b.prop(U, 'funnel', 2160, 440, 220, 220, 120);
  b.block(U, R(2170, 450, 200, 200), 'wall', true, true);
  for (let k = 0; k < 2; k++) {
    b.prop(U, 'lifeboat', 1880 + k * 560, 186, 300, 70, 50);
    b.prop(U, 'lifeboat', 1880 + k * 560, 846, 300, 70, 50);
  }
  b.st('k2_bote', U, 2030, 284, 'knife', 'Taquilla del bote salvavidas');
  for (let k = 0; k < 3; k++) {
    b.prop(U, 'deckChair', 2560 + k * 120, 470, 60, 80, 26, { variant: k });
    npcs.push({ id: `n_pas${k}`, level: U, x: 2590 + k * 120, y: 510, facing: -1, pose: 'sit', act: (['sleep', 'read', 'window'] as const)[k] });
  }
  b.prop(U, 'bench', 1880, 560, 34, 110, 30);
  npcs.push({ id: 'n_pas4', level: U, x: 1900, y: 600, facing: 1, pose: 'sit', act: 'talk' });
  b.prop(U, 'deckBox', 2900, 300, 80, 50, 34);
  b.st('k4_cofre', U, 2940, 380, 'knife', 'Cofre de cubierta con candado');
  b.prop(U, 'deckBox', 2900, 760, 80, 50, 34);
  b.st('locker_paseo', U, 2940, 740, 'locker', 'Arcón de chalecos');
  b.prop(U, 'lifering', 3070, 420, 14, 40, 30, { solid: false });
  b.prop(U, 'lifering', 3070, 640, 14, 40, 30, { solid: false });
  b.prop(U, 'stairsDownTop', 2990, 650, 80, 80, 10);
  b.prop(U, 'mast', 1900, 420, 30, 30, 140, { anim: 'beacon' });
  b.prop(U, 'vent', 2500, 700, 36, 26, 2, { solid: false, flat: true });
  npcs.push({ id: 'n_pas5', level: U, x: 2500, y: 900, facing: 1, pose: 'stand', act: 'window', walk: [{ x: 2500, y: 900 }, { x: 2800, y: 900 }, { x: 2800, y: 880 }] });

  // =============== ESCALERAS (misma X/Y en ambas cubiertas) ===============
  const ladders: LadderDef[] = [
    { id: 'esc1', name: 'Escalera de proa (inferior)', kind: 'stairs', a: { level: M, x: 900, y: 780 }, b: { level: L, x: 900, y: 780 } },
    { id: 'esc2', name: 'Escalera de popa (inferior)', kind: 'stairs', a: { level: M, x: 2900, y: 780 }, b: { level: L, x: 2900, y: 780 } },
    { id: 'esc3', name: 'Escalera de proa (superior)', kind: 'stairs', a: { level: M, x: 1110, y: 402 }, b: { level: U, x: 1110, y: 402 } },
    { id: 'esc4', name: 'Escalera de popa (superior)', kind: 'stairs', a: { level: M, x: 3030, y: 630 }, b: { level: U, x: 3030, y: 630 } },
  ];
  for (const l of ladders) {
    b.st(`${l.id}_a`, l.a.level, l.a.x, l.a.y, 'ladder', l.name);
    b.st(`${l.id}_b`, l.b.level, l.b.x, l.b.y, 'ladder', l.name);
  }

  const vents = [
    { id: 'v_recep', name: 'Trampilla de recepción', level: M, x: 1000, y: 655, links: ['v_rest'] },
    { id: 'v_rest', name: 'Trampilla del restaurante', level: M, x: 1608, y: 653, links: ['v_recep', 'v_pers'] },
    { id: 'v_pers', name: 'Trampilla del personal', level: M, x: 3038, y: 513, links: ['v_rest'] },
    { id: 'v_cabN', name: 'Trampilla del camarote 5', level: M, x: 2400, y: 275, links: ['v_enf'] },
    { id: 'v_enf', name: 'Trampilla de enfermería', level: M, x: 1708, y: 893, links: ['v_cabN'] },
    { id: 'v_carga', name: 'Trampilla de carga', level: L, x: 720, y: 485, links: ['v_maq'] },
    { id: 'v_maq', name: 'Trampilla de máquinas', level: L, x: 1858, y: 453, links: ['v_carga', 'v_taller'] },
    { id: 'v_taller', name: 'Trampilla del taller', level: L, x: 2718, y: 573, links: ['v_maq'] },
    { id: 'v_puente', name: 'Trampilla del vestíbulo superior', level: U, x: 1168, y: 773, links: ['v_paseo'] },
    { id: 'v_paseo', name: 'Trampilla del paseo', level: U, x: 2518, y: 713, links: ['v_puente'] },
  ];
  for (const v of vents) b.st(v.id, v.level, v.x, v.y, 'vent', v.name, { range: 56 });

  return b.finish({
    id: 'ship',
    name: 'Barco · El Ferry',
    levels: [
      { id: L, name: 'Inferior', index: 0, bounds: R(-300, -400, 4100, 1900), outline: [SHIP.LOWER_HULL] },
      { id: M, name: 'Principal', index: 1, bounds: R(-300, -400, 4100, 1900), outline: [SHIP.MAIN_HULL] },
      { id: U, name: 'Superior', index: 2, bounds: R(-300, -400, 4100, 1900), outline: [SHIP.UPPER_DECK] },
    ],
    ladders,
    vents,
    escapistLinks: [['v_cabN', 'v_pers'], ['v_carga', 'v_taller']],
    cameras: [
      { id: 'cam1', name: 'Pasillo norte', level: M, x: 1860, y: 336, view: R(1540, 210, 640, 360) },
      { id: 'cam2', name: 'Pasillo sur', level: M, x: 1860, y: 706, view: R(1540, 600, 640, 360) },
      { id: 'cam3', name: 'Corredor de máquinas', level: L, x: 2000, y: 530, view: R(1680, 400, 640, 360) },
      { id: 'cam4', name: 'Paseo exterior', level: U, x: 2440, y: 190, view: R(2120, 180, 640, 360) },
    ],
    zones: [
      { id: 'z_carga', name: 'Bodega de carga', level: L }, { id: 'z_maq', name: 'Máquinas y bombas', level: L }, { id: 'z_taller', name: 'Taller', level: L },
      { id: 'z_recep', name: 'Recepción', level: M }, { id: 'z_cab', name: 'Camarotes norte', level: M }, { id: 'z_rest', name: 'Restaurante y cocina', level: M },
      { id: 'z_sur', name: 'Ala sur', level: M }, { id: 'z_popa', name: 'Popa y personal', level: M }, { id: 'z_ext', name: 'Cubiertas exteriores', level: M },
      { id: 'z_puente', name: 'Puente', level: U }, { id: 'z_radio', name: 'Radio y seguridad', level: U }, { id: 'z_paseo', name: 'Paseo exterior', level: U },
    ],
    doorGroups: [
      { id: 'dg_proa', name: 'Recepción y proa', doors: ['d_proa', 'd_recN', 'd_recS', 'd_restN', 'd_restS'] },
      { id: 'dg_popa', name: 'Popa y personal', doors: ['d_personal', 'd_vest', 'd_persE', 'd_popa'] },
      { id: 'dg_inf', name: 'Cubierta inferior', doors: ['d_cargaN', 'd_cargaS', 'd_maq', 'd_bombas', 'd_maqE', 'd_bombasE'] },
      { id: 'dg_sup', name: 'Puente y superestructura', doors: ['d_puente', 'd_aleta', 'd_radioE', 'd_segE'] },
    ],
    interference: [
      { station: 'term_radio', name: 'Superestructura', cameras: ['cam4', 'cam1'], zones: ['z_puente', 'z_radio', 'z_paseo', 'z_cab', 'z_recep'], stations: ['cams_seg', 'occ_seg'] },
      { station: 'term_dist', name: 'Cubierta inferior', cameras: ['cam3', 'cam2'], zones: ['z_carga', 'z_maq', 'z_taller', 'z_sur', 'z_rest', 'z_popa', 'z_ext'], stations: ['cams_seg', 'occ_seg'] },
    ],
    sabotages: [
      { id: 'lights', kind: 'lights', name: 'Apagón', activation: ['sab_lights'], repair: [{ stations: ['rep_lights'], minigame: 'rep_lights', label: 'Restablecer el cuadro (Distribución eléctrica, inferior)' }], alarm: 'lights' },
      { id: 'comms', kind: 'comms', name: 'Comunicaciones', activation: ['sab_comms'], repair: [{ stations: ['rep_comms'], minigame: 'rep_comms', label: 'Sintonizar la radio (Comunicaciones, superior)' }], alarm: 'comms' },
      { id: 'doors', kind: 'doors', name: 'Puertas', activation: ['sab_doors'], repair: [], alarm: 'doors' },
      {
        id: 'leak', kind: 'critical', name: 'Entrada de agua', activation: ['sab_leak'],
        repair: [
          { stations: ['crit_leak_patch'], minigame: 'crit_patch', label: 'Sellar la vía de agua (Bodega de carga, inferior)' },
          { stations: ['crit_leak_pumps'], minigame: 'crit_pumps', label: 'Activar las bombas (Bombas de achique, inferior)' },
        ],
        failTitle: 'Naufragio', failText: 'El agua inundó las bodegas y El Ferry se fue a pique lentamente.', failScene: 'sink', alarm: 'critical',
      },
      {
        id: 'propulsion', kind: 'critical', name: 'Fallo de propulsión', activation: ['sab_prop'],
        repair: [
          { stations: ['crit_prop_stab'], minigame: 'crit_stabilize', label: 'Estabilizar los equipos (Máquinas, inferior)' },
          { stations: ['crit_prop_bridge'], minigame: 'crit_telegraph', label: 'Confirmar en el puente (superior)' },
        ],
        failTitle: 'Deriva contra las rocas', failText: 'Sin propulsión ni gobierno, El Ferry derivó hasta encallar contra el arrecife.', failScene: 'reef', alarm: 'critical',
      },
    ],
    tasks: [
      { id: 'orders', type: 'orders', name: 'Servir comandas', length: 'long', stages: [{ stations: ['orders_pick'], label: 'Recoge la comanda en la Cocina' }, { stations: ['orders_t1', 'orders_t2', 'orders_t3', 'orders_t4'], label: 'Sirve en el Restaurante' }] },
      { id: 'cooking', type: 'cooking', name: 'Preparar plato', length: 'short', stages: [{ stations: ['cooking_coc'], label: 'Cocina en los fogones' }] },
      { id: 'drink', type: 'drink', name: 'Servir bebida', length: 'short', stages: [{ stations: ['drink_rest'], label: 'Sirve en la barra del Restaurante' }] },
      { id: 'dishes', type: 'dishes', name: 'Fregar vajilla', length: 'short', stages: [{ stations: ['dishes_coc'], label: 'Friega en la Cocina' }] },
      { id: 'toilet', type: 'toilet', name: 'Limpiar baños', length: 'short', stages: [{ stations: ['toilet_banos', 'toilet_cab'], label: 'Limpia y repón los baños' }] },
      { id: 'wiring', type: 'wiring', name: 'Reparar cableado', length: 'short', stages: [{ stations: ['wiring_dist'], label: 'Une los cables (Distribución, inferior)' }] },
      { id: 'fuses', type: 'fuses', name: 'Cambiar fusible', length: 'short', stages: [{ stations: ['fuses_gen'], label: 'Sustituye el fusible (Generadores)' }] },
      { id: 'pressure', type: 'pressure', name: 'Ajustar presión', length: 'short', stages: [{ stations: ['pressure_maq'], label: 'Ajusta las válvulas (Máquinas)' }] },
      { id: 'filter', type: 'filter', name: 'Limpiar filtro del motor', length: 'long', stages: [{ stations: ['filter_maq'], label: 'Extrae, limpia y reinstala el filtro' }] },
      { id: 'assist', type: 'assist', name: 'Asistir al capitán', length: 'short', stages: [{ stations: ['assist_puente'], label: 'Calibra el radar del puente' }] },
      { id: 'luggage', type: 'luggage', name: 'Estibar equipaje', length: 'short', stages: [{ stations: ['luggage_carga'], label: 'Coloca las maletas en la bodega' }] },
      { id: 'bilge', type: 'bilge', name: 'Achicar sentina', length: 'short', exclusive: true, stages: [{ stations: ['bilge_bombas'], label: 'Achica con la bomba manual' }] },
      { id: 'seal', type: 'seal', name: 'Comprobar junta estanca', length: 'short', exclusive: true, stages: [{ stations: ['seal_carga'], label: 'Aprieta la junta de la puerta estanca' }] },
      { id: 'ballast', type: 'ballast', name: 'Equilibrar lastre', length: 'long', exclusive: true, stages: [{ stations: ['ballast_taller'], label: 'Equilibra los tanques de lastre' }, { stations: ['assist_puente'], label: 'Confirma el trimado en el puente' }] },
    ],
    knife: {
      docName: 'manifiesto manipulado',
      keyName: 'llave maestra de taquillas',
      compartmentName: 'compartimento de mantenimiento',
      containerName: 'cofre con combinación',
      authName: 'autorización de acceso al puente',
      stages: [
        { stations: ['k1_manifiesto', 'k1_tablon', 'k1_diario'], label: 'Consulta el manifiesto manipulado' },
        { stations: ['k2_camarote', 'k2_barra', 'k2_despensa', 'k2_botiquin', 'k2_mesa', 'k2_bote'], label: 'Busca la llave maestra de taquillas' },
        { stations: ['k3_carga', 'k3_taller'], label: 'Abre el compartimento de mantenimiento' },
        { stations: ['k4_cocina', 'k4_taller', 'k4_cofre'], label: 'Abre el cofre y coge el cuchillo' },
        { stations: ['k5_puente'], label: 'Manipula la autorización del puente' },
      ],
    },
    responsible: {
      title: 'Capitán', name: 'Capitana Arrieta', level: U, room: 'puente',
      patrol: [{ x: 900, y: 470 }, { x: 960, y: 560 }, { x: 900, y: 650 }, { x: 980, y: 420 }],
    },
    npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: M, x: 780 + k * 55, y: 640 }, { level: M, x: 790 + k * 55, y: 700 }]),
    safePoints: [],
    meetingRoom: 'personal',
    texts: {
      vehicle: 'El Ferry',
      short: 'BARCO',
      description: 'Ferry de tres cubiertas: máquinas abajo, pasaje en la principal y puente arriba.',
      routes: 'Anillo de pasillos, cubiertas exteriores y cuatro escaleras entre cubiertas.',
      arrivalTitle: 'Atraque en el puerto',
      arrivalText: 'El Ferry atraca suavemente en el muelle. Pasaje y carga, sanos y salvos.',
      murderTitle: 'Barco sin capitán',
      murderText: 'Sin nadie al timón, El Ferry gira sin rumbo hasta embestir el espigón.',
      accessGoal: 'Accede al capitán',
      approach: 'Maniobra de atraque',
      ejectText: 'La pasarela de cubierta se abre y…',
    },
    critTimeScale: 1.1,
    theme: {
      scenery: 'sea', bg: '#1f6f9f', hull: '#20375c', hullDark: '#13213a', trim: '#e63946',
      wallTop: '#2a3446', wallFace: '#f1ede4', wallFaceDark: '#cfc6b4', accent: '#e63946', metal: '#a8b2c1',
    },
  });
}
