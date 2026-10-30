import { pointInPolygon, rectsOverlap } from '../geometry';
import { PRODUCT_BY_ID, PRODUCTS } from '../market';
import { propCollider, propMount, propVisualRect } from './objects';
import { ALL_OPEN, MapRuntime, PLAYER_RADIUS } from './runtime';
import type { MapDef } from './types';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  reachableCells: number;
}

const CELL = 8;

/**
 * Valida el plano maestro con TODOS los objetos colocados: una sola planta,
 * accesibilidad a pie de estaciones, salas, trampillas y apariciones con las
 * colisiones reales, puertas despejadas, objetos dentro de su sala y que
 * ninguna celda transitable quede fuera del contorno.
 */
export function validateMap(def: MapDef): ValidationReport {
  const rt = new MapRuntime(def);
  const errors: string[] = [];
  if (def.levels.length !== 1) errors.push(`El mapa debe tener exactamente una planta (tiene ${def.levels.length})`);
  const grids = new Map<string, { x0: number; y0: number; w: number; h: number; walk: Uint8Array; seen: Uint8Array }>();
  for (const lv of def.levels) {
    const hb = rt.level(lv.id).hullBox;
    const x0 = Math.floor((hb.x - 40) / CELL) * CELL, y0 = Math.floor((hb.y - 40) / CELL) * CELL;
    const w = Math.ceil((hb.w + 80) / CELL), h = Math.ceil((hb.h + 80) / CELL);
    const walk = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = x0 + i * CELL + CELL / 2, y = y0 + j * CELL + CELL / 2;
      walk[j * w + i] = rt.collides(lv.id, x, y, PLAYER_RADIUS, ALL_OPEN) ? 0 : 1;
    }
    grids.set(lv.id, { x0, y0, w, h, walk, seen: new Uint8Array(w * h) });
  }
  const cellOf = (level: string, x: number, y: number) => {
    const g = grids.get(level)!;
    const i = Math.floor((x - g.x0) / CELL), j = Math.floor((y - g.y0) / CELL);
    return { g, i, j, k: j * g.w + i };
  };
  const queue: [string, number][] = [];
  const seed = (level: string, x: number, y: number) => {
    const { g, i, j } = cellOf(level, x, y);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= g.w || jj >= g.h) continue;
      const k = jj * g.w + ii;
      if (g.walk[k] && !g.seen[k]) { g.seen[k] = 1; queue.push([level, k]); }
    }
  };
  const reached = (level: string, x: number, y: number, rad = 24) => {
    const { g, i, j } = cellOf(level, x, y);
    const rc = Math.ceil(rad / CELL);
    for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= g.w || jj >= g.h) continue;
      const k = jj * g.w + ii;
      if (!g.seen[k]) continue;
      const cx = g.x0 + ii * CELL + CELL / 2, cy = g.y0 + jj * CELL + CELL / 2;
      if (Math.hypot(cx - x, cy - y) <= rad && rt.los(level, cx, cy, x, y, ALL_OPEN)) return true;
    }
    return false;
  };
  for (const s of def.spawn) {
    if (rt.collides(s.level, s.x, s.y, PLAYER_RADIUS, ALL_OPEN)) errors.push(`Aparición bloqueada en ${s.level} (${s.x},${s.y})`);
    seed(s.level, s.x, s.y);
  }
  let changed = true;
  let count = 0;
  while (changed) {
    changed = false;
    while (queue.length) {
      const [level, k] = queue.pop()!;
      count++;
      const g = grids.get(level)!;
      const i = k % g.w, j = Math.floor(k / g.w);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= g.w || jj >= g.h) continue;
        const kk = jj * g.w + ii;
        if (g.walk[kk] && !g.seen[kk]) { g.seen[kk] = 1; queue.push([level, kk]); }
      }
    }
  }
  for (const s of def.stations) {
    const range = (s.range ?? 78) - 10;
    if (!reached(s.level, s.x, s.y, range)) errors.push(`Estación inaccesible: ${s.id} (${s.name}) en ${s.level} (${s.x},${s.y})`);
  }
  for (const s of def.stations) {
    if (rt.collides(s.level, s.x, s.y, PLAYER_RADIUS * 0.5, ALL_OPEN)) errors.push(`Punto de uso dentro de un sólido: ${s.id} (${s.x},${s.y})`);
  }
  // Puertas despejadas: ningún mueble ocupa el paso a ambos lados del hueco.
  for (const d of def.doors) {
    const clear = d.orient === 'h'
      ? { x: d.rect.x + 4, y: d.rect.y - 34, w: d.rect.w - 8, h: d.rect.h + 68 }
      : { x: d.rect.x - 34, y: d.rect.y + 4, w: d.rect.w + 68, h: d.rect.h - 8 };
    for (const p of def.props) {
      const c = propCollider(p);
      if (p.level === d.level && c && rectsOverlap(c, clear)) errors.push(`El objeto ${p.kind} (${p.id}) bloquea la puerta ${d.id}`);
    }
  }
  // Objetos enteros dentro de su sala (incluida la cara elevada, que puede apoyarse en el muro de detrás).
  for (const p of def.props) {
    if (p.kind === 'railLine' || p.flat) continue;
    const room = def.rooms.find((r) => r.level === p.level && [r.rect, ...(r.extra ?? [])].some((rc) => p.rect.x >= rc.x - 1 && p.rect.x + p.rect.w <= rc.x + rc.w + 1 && p.rect.y >= rc.y - 1 && p.rect.y + p.rect.h <= rc.y + rc.h + 1));
    if (!room) {
      if (propMount(p) !== 'wall') errors.push(`Objeto fuera de cualquier sala: ${p.kind} (${p.id}) en ${p.rect.x},${p.rect.y}`);
      continue;
    }
    const vis = propVisualRect(p);
    const above = def.walls.filter((w) => w.level === p.level && !w.seg && Math.abs(w.rect.y + w.rect.h - room.rect.y) < 2 && w.rect.x < vis.x + vis.w && w.rect.x + w.rect.w > vis.x);
    const roomTop = [room.rect, ...(room.extra ?? [])].reduce((m, rc) => Math.min(m, rc.y), Infinity);
    if (above.length) {
      const top = roomTop - Math.min(...above.map((w) => w.rect.h));
      if (vis.y < top - 1) errors.push(`El objeto ${p.kind} (${p.id}) sobresale ${Math.round(top - vis.y)} px por encima de su sala ${room.id}`);
    } else if (vis.y < roomTop - 1) {
      // Sala abierta (sin muro detrás): la cara elevada no puede invadir ningún muro.
      const upper = { x: vis.x + 1, y: vis.y, w: vis.w - 2, h: roomTop - vis.y };
      if (def.walls.some((w) => w.level === p.level && !w.seg && rectsOverlap(w.rect, upper))) errors.push(`El objeto ${p.kind} (${p.id}) invade un muro por encima de ${room.id}`);
    }
  }
  for (const v of def.vents) {
    if (rt.collides(v.level, v.x, v.y, PLAYER_RADIUS, ALL_OPEN)) errors.push(`Salida de trampilla bloqueada: ${v.id}`);
    for (const lk of v.links) if (!def.vents.find((o) => o.id === lk)) errors.push(`Trampilla ${v.id} enlaza con ${lk} inexistente`);
  }
  for (const [a, bId] of def.escapistLinks) {
    const va = def.vents.find((v) => v.id === a), vb = def.vents.find((v) => v.id === bId);
    if (!va || !vb) errors.push(`Enlace de Escapista inválido ${a}-${bId}`);
    else if (va.level !== vb.level) errors.push(`Enlace de Escapista entre niveles ${a}-${bId}`);
  }
  if (def.responsible) {
    for (const p of def.responsible.patrol) if (!reached(def.responsible.level, p.x, p.y, 60)) errors.push(`Punto de patrulla del responsable inaccesible (${p.x},${p.y})`);
  }
  for (const r of def.rooms) {
    const g = grids.get(r.level)!;
    let any = false;
    for (let k = 0; k < g.seen.length && !any; k++) {
      if (!g.seen[k]) continue;
      const x = g.x0 + (k % g.w) * CELL + CELL / 2, y = g.y0 + Math.floor(k / g.w) * CELL + CELL / 2;
      if (x > r.rect.x && x < r.rect.x + r.rect.w && y > r.rect.y && y < r.rect.y + r.rect.h) any = true;
    }
    if (!any) errors.push(`Sala inaccesible: ${r.id} (${r.name})`);
  }
  // Ninguna celda transitable alcanzada fuera del contorno del vehículo.
  for (const lv of def.levels) {
    const g = grids.get(lv.id)!;
    let outside = 0;
    let firstOut = '';
    for (let k = 0; k < g.seen.length; k++) {
      if (!g.seen[k]) continue;
      const x = g.x0 + (k % g.w) * CELL + CELL / 2, y = g.y0 + Math.floor(k / g.w) * CELL + CELL / 2;
      if (!lv.outline.some((poly) => pointInPolygon(x, y, poly))) { if (!outside) firstOut = `${x},${y}`; outside++; }
    }
    if (outside > 0) errors.push(`${outside} celdas transitables fuera del contorno en ${lv.id} (p.ej. ${firstOut})`);
  }
  // Coherencia de referencias
  const sid = new Set(def.stations.map((s) => s.id));
  for (const t of def.tasks) for (const st of t.stages) for (const s of st.stations) if (!sid.has(s)) errors.push(`Tarea ${t.id} usa estación inexistente ${s}`);
  for (const sb of def.sabotages) {
    for (const s of sb.activation) if (!sid.has(s)) errors.push(`Sabotaje ${sb.id} activa en ${s} inexistente`);
    for (const st of sb.repair) for (const s of st.stations) if (!sid.has(s)) errors.push(`Sabotaje ${sb.id} repara en ${s} inexistente`);
  }
  for (const z of def.interference) if (!sid.has(z.station)) errors.push(`Interferencia usa ${z.station} inexistente`);
  for (const dg of def.doorGroups) for (const d of dg.doors) if (!def.doors.find((x) => x.id === d)) errors.push(`Grupo ${dg.id} usa puerta ${d} inexistente`);
  for (const r of def.rooms) if (!def.zones.find((z) => z.id === r.zone)) errors.push(`Sala ${r.id} con zona ${r.zone} inexistente`);
  if (def.knife) {
    for (const [kind, pool] of Object.entries(def.knife.pools)) {
      if (!pool.length) errors.push(`Cuchillo sin estaciones para la etapa ${kind}`);
      for (const s of pool) if (!sid.has(s)) errors.push(`Cuchillo (${kind}) usa ${s} inexistente`);
    }
  }
  if (def.market) {
    const mk = def.market;
    if (!sid.has(mk.checkout)) errors.push('Supermercado sin caja');
    const placed = new Set<string>();
    for (const sh of mk.shelves) {
      if (!sid.has(sh.station)) errors.push(`Estantería ${sh.station} inexistente`);
      for (const pid of sh.products) { if (!PRODUCT_BY_ID[pid]) errors.push(`Producto ${pid} desconocido`); placed.add(pid); }
    }
    for (const p of PRODUCTS) if (!placed.has(p.id)) errors.push(`Producto sin estantería: ${p.id}`);
    for (const q of mk.queue) if (rt.collides(def.levels[0].id, q.x, q.y, PLAYER_RADIUS, ALL_OPEN)) errors.push(`Punto de cola bloqueado (${q.x},${q.y})`);
    if (rt.collides(def.levels[0].id, mk.scanPoint.x, mk.scanPoint.y, PLAYER_RADIUS, ALL_OPEN)) errors.push('Punto de escaneo bloqueado');
  }
  return { ok: errors.length === 0, errors, reachableCells: count };
}
