import { PRODUCTS, SECTIONS, SectionId } from '../market';
import type { Rect } from '../geometry';
import { HW, MapBuilder, R, VW } from './builder';
import type { MapDef, MarketSection, NpcSeat } from './types';

/**
 * SUPERMERCADO — «El Carrito» (una sola planta, edificio propio)
 * Planta x 0–2400, y 0–1500.
 *  - Pared norte: mostradores refrigerados de carnicería, pescadería, lácteos y refrigerados.
 *  - Centro: tres filas de estanterías altas (opacas, bloquean la visión) con dos pasillos transversales.
 *  - Sur: zona de cajas con la caja abierta, la cola señalizada y la salida de seguridad.
 * Cada «bahía» de estantería es una estación con sus productos en la cara accesible.
 */
export const MARKET = {
  W: 2400,
  H: 1500,
  OUTLINE: [{ x: 0, y: 0 }, { x: 2400, y: 0 }, { x: 2400, y: 1500 }, { x: 0, y: 1500 }],
};

export function buildMarket(): MapDef {
  const b = new MapBuilder();
  const K = 'store';
  const npcs: NpcSeat[] = [];

  b.hwall(K, 0, 2400, 0, HW, { kind: 'hull' });
  b.hwall(K, 0, 2400, 1480, 20, { kind: 'hull', face: false });
  b.vwall(K, 0, 56, 1480, VW, { kind: 'hull' });
  b.vwall(K, 2382, 56, 1480, VW, { kind: 'hull' });

  b.room('frescos', 'Frescos', K, R(18, 56, 2364, 286), 'marketTile', 'cold', '#5cc8ff', 'z_frescos');
  b.room('pasillos', 'Pasillos', K, R(18, 342, 2364, 728), 'marketTile', 'neutral', '#ffd166', 'z_pasillos');
  b.room('cajas', 'Cajas', K, R(18, 1070, 2364, 410), 'terrazzo', 'warm', '#ff8a3d', 'z_cajas');

  const shelves: { station: string; section: string; products: string[] }[] = [];
  const bySection = (s: SectionId) => PRODUCTS.filter((p) => p.section === s).map((p) => p.id);
  const secRects = new Map<string, Rect[]>();
  const addRect = (sec: string, r: Rect) => { const a = secRects.get(sec) ?? []; a.push(r); secRects.set(sec, a); };

  // ---------------- Mostradores refrigerados (pared norte) ----------------
  const fresh: { sec: SectionId; x: number; w: number; part: [number, number] }[] = [
    { sec: 'carne', x: 60, w: 300, part: [0, 7] }, { sec: 'carne', x: 380, w: 300, part: [7, 14] },
    { sec: 'pescado', x: 760, w: 300, part: [0, 7] }, { sec: 'pescado', x: 1080, w: 300, part: [7, 14] },
    { sec: 'lacteos', x: 1460, w: 300, part: [0, 6] }, { sec: 'lacteos', x: 1780, w: 300, part: [6, 11] },
    { sec: 'refrigerados', x: 2100, w: 250, part: [0, 7] },
  ];
  fresh.forEach((f, i) => {
    const id = `sh_f${i + 1}`;
    b.prop(K, 'marketFridge', f.x, 80, f.w, 54, 80, { variant: i, label: f.sec });
    const prods = bySection(f.sec).slice(f.part[0], f.part[1]);
    b.st(id, K, f.x + f.w / 2, 170, 'shelf', `${SECTIONS.find((s) => s.id === f.sec)!.name} (${i % 2 ? 'derecha' : 'izquierda'})`, { range: 96 });
    shelves.push({ station: id, section: f.sec, products: prods });
    addRect(f.sec, R(f.x, 56, f.w, 150));
  });

  // ---------------- Estanterías altas: 3 filas × 3 módulos, dos caras, dos bahías por cara ----------------
  const units = [120, 800, 1480];
  const rows = [400, 680, 960];
  const UW = 540, UD = 50, UH = 84;
  const order: SectionId[] = ['fruta', 'verdura', 'panaderia', 'pasta', 'conservas', 'especias', 'reposteria'];
  const pools = order.map((s) => ({ s, ids: bySection(s) }));
  const totalProducts = pools.reduce((a, p) => a + p.ids.length, 0);
  const bays: { x: number; y: number; face: 'n' | 's'; unit: number }[] = [];
  rows.forEach((ry, ri) => units.forEach((ux, ui) => {
    b.prop(K, 'marketShelf', ux, ry, UW, UD, UH, { variant: ri * 3 + ui });
    for (const face of ['n', 's'] as const) for (const k of [0, 1]) {
      bays.push({ x: ux + UW * (k ? 0.75 : 0.25), y: face === 'n' ? ry - 58 - 30 : ry + UD + 30, face, unit: ri * 3 + ui });
    }
  }));
  // Reparto proporcional de bahías por sección, en orden de recorrido.
  let bi = 0;
  pools.forEach((pool, pi) => {
    const left = bays.length - bi;
    const remainingProducts = pools.slice(pi).reduce((a, p) => a + p.ids.length, 0);
    const nb = pi === pools.length - 1 ? left : Math.max(1, Math.round((pool.ids.length / remainingProducts) * left));
    const per = Math.ceil(pool.ids.length / nb);
    for (let k = 0; k < nb; k++) {
      const bay = bays[bi++];
      const ids = pool.ids.slice(k * per, (k + 1) * per);
      if (!ids.length) continue;
      const id = `sh_${bay.unit + 1}${bay.face}${bi}`;
      const secName = SECTIONS.find((s) => s.id === pool.s)!.name;
      b.st(id, K, Math.round(bay.x), bay.y, 'shelf', `${secName} · estante ${bay.face === 'n' ? 'norte' : 'sur'}`, { range: 96 });
      shelves.push({ station: id, section: pool.s, products: ids });
      addRect(pool.s, R(bay.x - UW / 4, bay.face === 'n' ? bay.y - 40 : bay.y - 60, UW / 2, 100));
    }
  });
  void totalProducts;
  // Cada lineal muestra en su sprite los productos de sus caras accesibles.
  const shelfProps = b.props.filter((p) => p.kind === 'marketShelf');
  for (const sp of shelfProps) {
    const faces: { n: string[]; s: string[] } = { n: [], s: [] };
    for (const sh of shelves) {
      const st = b.stations.find((x) => x.id === sh.station)!;
      if (st.x < sp.rect.x || st.x > sp.rect.x + sp.rect.w) continue;
      if (Math.abs(st.y - (sp.rect.y - 88)) < 4) faces.n.push(...sh.products);
      if (Math.abs(st.y - (sp.rect.y + sp.rect.h + 30)) < 4) faces.s.push(...sh.products);
    }
    sp.label = JSON.stringify(faces);
  }

  // Carteles de sección colgados (planos, sin colisión)
  for (const [sec, rects] of secRects) {
    const r0 = rects[0];
    b.prop(K, 'sectionSign', r0.x + 20, r0.y + (sec === 'carne' || sec === 'pescado' || sec === 'lacteos' || sec === 'refrigerados' ? 0 : 10), 120, 4, 0, { solid: false, flat: true, label: sec });
  }

  // ---------------- Zona de cajas ----------------
  b.prop(K, 'cashDesk', 1100, 1210, 260, 60, 44, { anim: 'screen', label: 'abierta' });
  b.st('checkout', K, 1230, 1176, 'checkout', 'Caja: entregar la compra', { range: 90 });
  b.prop(K, 'cashDesk', 420, 1330, 220, 56, 44, { label: 'cerrada' });
  b.prop(K, 'cashDesk', 1760, 1330, 220, 56, 44, { label: 'cerrada' });
  b.prop(K, 'queueLine', 470, 1130, 600, 40, 0, { solid: false, flat: true });
  b.prop(K, 'cartStack', 60, 1360, 120, 70, 46);
  b.prop(K, 'basketStack', 200, 1390, 60, 40, 40);
  b.prop(K, 'plant', 2330, 1100, 34, 34, 56);
  b.prop(K, 'plant', 30, 1100, 34, 34, 56);
  b.prop(K, 'exitDoor', 2382, 1250, 18, 110, 0, { solid: false, flat: true, label: 'salida' });
  b.prop(K, 'entranceDoor', 1100, 1480, 260, 20, 0, { solid: false, flat: true });
  b.prop(K, 'promoStand', 2120, 1150, 120, 70, 40);
  npcs.push({ id: 'n_cajera', level: K, x: 1230, y: 1300, facing: -1, pose: 'stand', act: 'talk' });

  const queue = Array.from({ length: 12 }, (_, i) => ({ x: 1040 - i * 50, y: 1150 }));
  const sections: MarketSection[] = [...secRects].map(([sec, rects]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    const meta = SECTIONS.find((s) => s.id === sec)!;
    return { id: sec, name: meta.name, rect: R(x0, y0, x1 - x0, y1 - y0), icon: meta.icon };
  });
  sections.push({ id: 'cajas', name: 'Cajas', rect: R(400, 1100, 1000, 280), icon: 'cart' });

  return b.finish({
    id: 'market',
    name: 'Supermercado · El Carrito',
    levels: [{ id: K, name: 'Planta', index: 0, bounds: R(-200, -200, 2800, 1900), outline: [MARKET.OUTLINE] }],
    vents: [],
    escapistLinks: [],
    cameras: [],
    zones: [{ id: 'z_frescos', name: 'Frescos', level: K }, { id: 'z_pasillos', name: 'Pasillos', level: K }, { id: 'z_cajas', name: 'Cajas', level: K }],
    doorGroups: [], interference: [], sabotages: [], tasks: [], npcs,
    spawn: [0, 1, 2, 3, 4, 5].flatMap((k) => [{ level: K, x: 760 + k * 80, y: 1410 }, { level: K, x: 800 + k * 80, y: 1452 }]),
    safePoints: [],
    meetingRoom: 'cajas',
    texts: {
      vehicle: 'El Carrito', short: 'SÚPER', description: 'Supermercado de una planta con frescos, tres filas de estanterías y zona de cajas.',
      routes: 'Pasillo de frescos, dos pasillos transversales y la zona de cajas.',
      arrivalTitle: '', arrivalText: '', murderTitle: '', murderText: '', accessGoal: '', approach: '',
      ejectText: 'La salida de seguridad se abre y…',
    },
    critTimeScale: 1,
    theme: {
      scenery: 'city', bg: '#3a4a5e', hull: '#e8e2d6', hullDark: '#b8ad9a', trim: '#e63946',
      wallTop: '#3d405b', wallFace: '#f4efe6', wallFaceDark: '#d8cfbf', accent: '#e63946', metal: '#b8c0cc',
    },
    market: { checkout: 'checkout', queue, scanPoint: { x: 1230, y: 1176 }, exitDoor: { x: 2360, y: 1305 }, sections, shelves },
  });
}
