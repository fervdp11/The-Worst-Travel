import type { Rect } from '../../shared/geometry';
import type { MapDef } from '../../shared/maps/types';
import { makeCanvas } from '../art/draw';
import { INK, rgba } from '../art/palette';
import { PLANE } from '../../shared/maps/plane';

export interface MapXform {
  s: number;
  ox: number;
  oy: number;
  box: Rect;
}

/** Caja de encuadre común a todos los niveles (mismas proporciones al cambiar de planta). */
export function mapBox(def: MapDef): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const lv of def.levels) for (const poly of lv.outline) for (const p of poly) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  if (def.id === 'plane') { y0 = -380; y1 = 980; }
  return { x: x0 - 40, y: y0 - 40, w: x1 - x0 + 80, h: y1 - y0 + 80 };
}

export function xformFor(def: MapDef, w: number, h: number): MapXform {
  const box = mapBox(def);
  const s = Math.min(w / box.w, h / box.h);
  return { s, ox: (w - box.w * s) / 2 - box.x * s, oy: (h - box.h * s) / 2 - box.y * s, box };
}

const cache = new Map<string, HTMLCanvasElement>();

/** Base estática de un nivel (cacheada): contorno, salas coloreadas, puertas y rótulos. */
export function levelBase(def: MapDef, level: string, w: number, h: number, labels = true): HTMLCanvasElement {
  const key = `${def.id}|${level}|${w}|${h}|${labels}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const X = xformFor(def, w, h);
  ctx.save();
  ctx.translate(X.ox, X.oy);
  ctx.scale(X.s, X.s);
  const lw = 1 / X.s;
  const lv = def.levels.find((l) => l.id === level)!;
  if (def.id === 'plane') {
    ctx.fillStyle = 'rgba(200,215,235,0.18)';
    for (const wing of [PLANE.WING_N, PLANE.WING_S, PLANE.STAB_N, PLANE.STAB_S]) {
      ctx.beginPath(); wing.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
    }
    for (const e of PLANE.ENGINES) { ctx.beginPath(); ctx.ellipse(e.x, e.y, 130, 52, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // Otros niveles en tenue para orientación
  for (const other of def.levels) {
    if (other.id === level) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2 * lw; ctx.setLineDash([8 * lw, 6 * lw]);
    for (const poly of other.outline) { ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  for (const poly of lv.outline) {
    ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = '#26304d'; ctx.fill();
    ctx.strokeStyle = '#9fb3d9'; ctx.lineWidth = 3 * lw; ctx.stroke();
  }
  for (const r of def.rooms) {
    if (r.level !== level) continue;
    for (const rc of [r.rect, ...(r.extra ?? [])]) {
      ctx.fillStyle = rgba(r.accent, r.exterior ? 0.22 : 0.42);
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
    }
  }
  for (const wl of def.walls) {
    if (wl.level !== level || wl.invisible || wl.kind === 'edge') continue;
    ctx.fillStyle = wl.kind === 'rail' ? 'rgba(255,255,255,0.4)' : '#0d1222';
    ctx.fillRect(wl.rect.x, wl.rect.y, wl.rect.w, wl.rect.h);
  }
  for (const d of def.doors) {
    if (d.level !== level) continue;
    ctx.fillStyle = d.lockable ? '#ffd23f' : '#8fa3c7';
    const r = d.rect;
    if (d.orient === 'h') ctx.fillRect(r.x, r.y + r.h - 6 * lw * 3, r.w, 6 * lw * 3); else ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  for (const l of def.ladders) for (const end of [l.a, l.b]) {
    if (end.level !== level) continue;
    ctx.fillStyle = '#5cc8ff'; ctx.beginPath(); ctx.arc(end.x, end.y, 9 * lw * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2 * lw; ctx.stroke();
  }
  for (const s of def.stations) {
    if (s.level !== level || s.kind !== 'emergency') continue;
    ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(s.x, s.y, 9 * lw * 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (labels) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = Math.max(9, Math.min(15, X.s * 60));
    ctx.font = `800 ${fs}px "Nunito", sans-serif`;
    const seen = new Set<string>();
    for (const r of def.rooms) {
      if (r.level !== level || seen.has(r.name)) continue;
      if (r.rect.w * X.s < 34 || r.rect.h * X.s < 12) continue;
      seen.add(r.name);
      const cx = X.ox + (r.rect.x + r.rect.w / 2) * X.s, cy = X.oy + (r.rect.y + r.rect.h / 2) * X.s;
      const txt = r.name.replace('Techo · ', '');
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,14,28,0.9)'; ctx.strokeText(txt, cx, cy);
      ctx.fillStyle = '#eef2ff'; ctx.fillText(txt, cx, cy);
    }
  }
  cache.set(key, c);
  return c;
}

export function toScreen(X: MapXform, x: number, y: number) {
  return { x: X.ox + x * X.s, y: X.oy + y * X.s };
}

export function toWorld(X: MapXform, sx: number, sy: number) {
  return { x: (sx - X.ox) / X.s, y: (sy - X.oy) / X.s };
}
