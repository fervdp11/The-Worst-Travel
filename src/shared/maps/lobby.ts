import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef, NpcSeat } from './types';

/**
 * Sala de espera: vestíbulo de salidas de The Worst Travel. Una sola sala
 * amplia con el centro despejado para conversar, bancos a los lados, panel de
 * salidas, mostrador de facturación y un rincón de vestuario para personalizar.
 */
export function buildLobby(): MapDef {
  const b = new MapBuilder();
  const H = 'hall';
  const npcs: NpcSeat[] = [];
  const win: number[] = [];
  for (let x = 120; x < 1700; x += 150) if (x < 640 || x > 1160) win.push(x);
  b.hwall(H, 0, 1800, 0, HW, { kind: 'hull', windows: win });
  b.hwall(H, 0, 1800, 980, 24, { kind: 'hull', face: false });
  b.vwall(H, 0, 56, 980, 24, { kind: 'hull' });
  b.vwall(H, 1776, 56, 980, 24, { kind: 'hull' });
  b.room('vestibulo', 'Vestíbulo de salidas', H, R(24, 56, 1752, 924), 'terrazzo', 'warm', '#ffb347', 'z_hall');

  // Panel de salidas y quiosco informativo (pared norte)
  b.prop(H, 'departureBoard', 680, 0, 440, 56, 0, { solid: false, flat: true, anim: 'screen' });
  b.st('kiosk', H, 900, 120, 'kiosk', 'Panel de salidas');
  b.prop(H, 'rug', 620, 360, 560, 300, 0, { solid: false, flat: true });

  // Mostrador de facturación (oeste)
  b.prop(H, 'receptionDesk', 80, 150, 300, 60, 42, { anim: 'screen' });
  npcs.push({ id: 'n_fact', level: H, x: 230, y: 120, facing: 1, pose: 'stand', act: 'talk' });
  b.prop(H, 'luggage', 400, 170, 50, 36, 34);

  // Bancos a los lados (el centro queda libre)
  for (const bx of [110, 1290]) for (const by of [560, 720]) b.prop(H, 'bench', bx, by, 380, 40, 30);
  npcs.push({ id: 'n_banco1', level: H, x: 200, y: 590, facing: 1, pose: 'sit', act: 'read' });
  npcs.push({ id: 'n_banco2', level: H, x: 1560, y: 750, facing: -1, pose: 'sit', act: 'phone' });
  for (const [px, py] of [[40, 80], [1720, 80], [40, 920], [1720, 920], [530, 640], [1234, 640]]) b.prop(H, 'plant', px, py, 34, 34, 54);

  // Vestuario del personal (este): personalización
  b.prop(H, 'wardrobe', 1520, 140, 130, 60, 70);
  b.prop(H, 'mirror', 1680, 46, 70, 10, 46, { solid: false, mount: 'wall' });
  b.st('wardrobe', H, 1585, 248, 'wardrobe', 'Vestuario: personalizar uniforme', { range: 90 });
  for (let k = 0; k < 3; k++) b.prop(H, 'locker', 1300 + k * 56, 82, 50, 30, 74, { variant: k });
  b.st('wardrobe2', H, 1356, 160, 'wardrobe', 'Taquillas del personal');

  // Cafetería (sureste) y señalética
  b.prop(H, 'cafeKiosk', 1380, 880, 220, 60, 46, { anim: 'steam' });
  b.prop(H, 'gateSign', 120, 880, 220, 40, 60, { variant: 0 });

  return b.finish({
    id: 'lobby',
    name: 'Vestíbulo de salidas',
    levels: [{ id: H, name: 'Vestíbulo', index: 0, bounds: R(-300, -300, 2400, 1600), outline: [[{ x: 0, y: 0 }, { x: 1800, y: 0 }, { x: 1800, y: 1004 }, { x: 0, y: 1004 }]] }],
    vents: [], escapistLinks: [], cameras: [], zones: [{ id: 'z_hall', name: 'Vestíbulo', level: H }],
    doorGroups: [], interference: [], sabotages: [], tasks: [], npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: H, x: 720 + k * 72, y: 470 }, { level: H, x: 756 + k * 72, y: 540 }]),
    safePoints: [], meetingRoom: 'vestibulo',
    texts: {
      vehicle: 'Terminal', short: 'ESPERA', description: '', routes: '', arrivalTitle: '', arrivalText: '', murderTitle: '', murderText: '',
      accessGoal: '', approach: '', ejectText: '',
    },
    critTimeScale: 1,
    theme: {
      scenery: 'terminal', bg: '#2b2d42', hull: '#3d405b', hullDark: '#24263a', trim: '#f2cc8f',
      wallTop: '#2b2d42', wallFace: '#e9dcc9', wallFaceDark: '#c8b8a2', accent: '#f2cc8f', metal: '#8d99ae',
    },
  });
}
