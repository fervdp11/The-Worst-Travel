import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef } from './types';

/** Sala de espera: terminal de viajes con vestuarios de personal. Plano propio y fijo. */
export function buildLobby(): MapDef {
  const b = new MapBuilder();
  const H = 'hall';
  b.hwall(H, 0, 1600, 0, HW, { kind: 'hull', windows: [120, 260, 400, 540, 680, 820] });
  b.hwall(H, 0, 1600, 880, 24, { kind: 'hull', face: false });
  b.vwall(H, 0, 56, 880, 24, { kind: 'hull' });
  b.vwall(H, 1576, 56, 880, 24, { kind: 'hull' });
  b.vwall(H, 1100, 56, 520, VW, { kind: 'partition', openings: [{ at: 300, door: { id: 'd_vest', name: 'Vestuarios' } }] });
  b.hwall(H, 1100, 1576, 520, 36, { kind: 'partition', openings: [{ at: 1340, door: { id: 'd_vestS', name: 'Vestuarios (sur)' } }] });
  b.room('vestibulo', 'Vestíbulo de salidas', H, R(24, 56, 1076, 824), 'checker', 'warm', '#ffb347', 'z_hall', [R(1100, 556, 476, 324)]);
  b.room('vestuarios', 'Vestuarios del personal', H, R(1118, 56, 458, 464), 'parquet', 'warm', '#ff8a3d', 'z_vest');
  b.prop(H, 'departureBoard', 380, 0, 360, 56, 0, { solid: false, flat: true, anim: 'screen' });
  b.st('kiosk', H, 560, 120, 'kiosk', 'Panel de salidas');
  for (let k = 0; k < 3; k++) {
    b.prop(H, 'gateSign', 120 + k * 330, 300, 200, 40, 70, { variant: k });
  }
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) b.prop(H, 'bench', 120 + k * 330, 520 + r * 160, 200, 40, 30);
  b.prop(H, 'plant', 50, 90, 34, 34, 56);
  b.prop(H, 'plant', 1040, 90, 34, 34, 56);
  b.prop(H, 'plant', 50, 800, 34, 34, 56);
  b.prop(H, 'cafeKiosk', 1200, 640, 200, 70, 50, { anim: 'steam' });
  for (let k = 0; k < 5; k++) b.prop(H, 'locker', 1140 + k * 56, 56, 50, 30, 74, { variant: k });
  b.prop(H, 'mirror', 1450, 56, 90, 14, 70, { solid: false });
  b.prop(H, 'wardrobe', 1460, 300, 90, 60, 70);
  b.st('wardrobe', H, 1500, 400, 'wardrobe', 'Vestuario: personalizar uniforme');
  b.st('wardrobe2', H, 1300, 140, 'wardrobe', 'Taquillas del personal');
  b.prop(H, 'bench', 1200, 300, 34, 140, 30);
  return b.finish({
    id: 'lobby',
    name: 'Terminal de salidas',
    levels: [{ id: H, name: 'Terminal', index: 0, bounds: R(-300, -300, 2200, 1500), outline: [[{ x: 0, y: 0 }, { x: 1600, y: 0 }, { x: 1600, y: 904 }, { x: 0, y: 904 }]] }],
    ladders: [], vents: [], escapistLinks: [], cameras: [], zones: [{ id: 'z_hall', name: 'Vestíbulo', level: H }, { id: 'z_vest', name: 'Vestuarios', level: H }],
    doorGroups: [], interference: [], sabotages: [], tasks: [], npcs: [],
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: H, x: 300 + k * 90, y: 430 }, { level: H, x: 340 + k * 90, y: 470 }]),
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
