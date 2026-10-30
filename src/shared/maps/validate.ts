import { pointInPolygon } from '../geometry';
import { ALL_OPEN, MapRuntime, PLAYER_RADIUS } from './runtime';
import type { MapDef } from './types';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  reachableCells: number;
}

const CELL = 8;

/**
 * Valida el plano maestro: accesibilidad a pie de todas las estaciones,
 * extremos de escalera, trampillas, puntos de aparición y que ninguna celda
 * transitable quede fuera del contorno del vehículo.
 */
export function validateMap(def: MapDef): ValidationReport {
  const rt = new MapRuntime(def);
  const errors: string[] = [];
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
    for (const l of def.ladders) {
      const ra = reached(l.a.level, l.a.x, l.a.y), rb = reached(l.b.level, l.b.x, l.b.y);
      if (ra && !rb) { seed(l.b.level, l.b.x, l.b.y); changed = true; }
      if (rb && !ra) { seed(l.a.level, l.a.x, l.a.y); changed = true; }
    }
  }
  for (const s of def.stations) {
    const range = (s.range ?? 78) - 10;
    if (!reached(s.level, s.x, s.y, range)) errors.push(`Estación inaccesible: ${s.id} (${s.name}) en ${s.level} (${s.x},${s.y})`);
  }
  for (const l of def.ladders) {
    for (const end of [l.a, l.b]) {
      if (rt.collides(end.level, end.x, end.y, PLAYER_RADIUS, ALL_OPEN)) errors.push(`Extremo de escalera bloqueado: ${l.id} en ${end.level}`);
      if (!reached(end.level, end.x, end.y, 20)) errors.push(`Extremo de escalera inaccesible: ${l.id} ${end.level}`);
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
    const cx = r.rect.x + r.rect.w / 2, cy = r.rect.y + r.rect.h / 2;
    if (!reached(r.level, cx, cy, Math.max(r.rect.w, r.rect.h) / 2)) errors.push(`Sala inaccesible: ${r.id} (${r.name})`);
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
  for (const st of def.knife?.stages ?? []) for (const s of st.stations) if (!sid.has(s)) errors.push(`Cuchillo usa ${s} inexistente`);
  for (const z of def.interference) if (!sid.has(z.station)) errors.push(`Interferencia usa ${z.station} inexistente`);
  for (const dg of def.doorGroups) for (const d of dg.doors) if (!def.doors.find((x) => x.id === d)) errors.push(`Grupo ${dg.id} usa puerta ${d} inexistente`);
  for (const r of def.rooms) if (!def.zones.find((z) => z.id === r.zone)) errors.push(`Sala ${r.id} con zona ${r.zone} inexistente`);
  return { ok: errors.length === 0, errors, reachableCells: count };
}
