import { Rect, RectGrid, clamp, dist2, rectContains, segmentRectT, segmentRectTT } from '../geometry';
import { propCollider, propOccluder } from './objects';
import type { DoorDef, MapDef, RoomDef, StationDef, ZoneDef } from './types';

/** Radio del cuerpo jugable (cápsula vista desde arriba, no un punto en los pies). */
export const PLAYER_RADIUS = 14;
/** Profundidad máxima que la luz entra en un muro para iluminar su cara (nunca lo cruza). */
export const WALL_LIGHT_DEPTH = 64;

export interface Seg { ax: number; ay: number; bx: number; by: number; half: number }

export interface Solid {
  rect: Rect;
  kind: 'wall' | 'prop' | 'door';
  door?: string;
  /** Objeto de origen (para depuración). */
  prop?: string;
  occludes: boolean;
  /** Muro lineal diagonal: la colisión y la visión usan el segmento, no la caja. */
  seg?: Seg;
}

/** Estado de puertas cerradas consultado por colisión y visión. */
export interface DoorState {
  isClosed(id: string): boolean;
}
export const ALL_OPEN: DoorState = { isClosed: () => false };

/** Punto más cercano de un segmento (con su parámetro). */
function closestOnSeg(s: Seg, x: number, y: number): { x: number; y: number } {
  const vx = s.bx - s.ax, vy = s.by - s.ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((x - s.ax) * vx + (y - s.ay) * vy) / l2, 0, 1) : 0;
  return { x: s.ax + vx * t, y: s.ay + vy * t };
}

/** Intersección de un rayo (origen + t·dir) con un segmento; devuelve t o -1. */
function raySeg(ox: number, oy: number, dx: number, dy: number, s: Seg): number {
  const ex = s.bx - s.ax, ey = s.by - s.ay;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return -1;
  const wx = s.ax - ox, wy = s.ay - oy;
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * dy - wy * dx) / den;
  if (t < 0 || u < -1e-6 || u > 1 + 1e-6) return -1;
  return t;
}

export class LevelRuntime {
  solids: Solid[] = [];
  occluders: Solid[] = [];
  solidGrid = new RectGrid<Solid>(128);
  occGrid = new RectGrid<Solid>(128);
  rooms: RoomDef[] = [];
  bounds: Rect;
  /** Caja que envuelve el contorno del vehículo (límite para expulsados). */
  hullBox: Rect;
  constructor(public id: string, def: MapDef) {
    const lv = def.levels.find((l) => l.id === id)!;
    this.bounds = lv.bounds;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of lv.outline) for (const p of poly) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    this.hullBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    for (const w of def.walls) if (w.level === id) this.addSolid({ rect: w.rect, kind: 'wall', occludes: w.occludes, seg: w.seg });
    for (const p of def.props) {
      if (p.level !== id) continue;
      const col = propCollider(p);
      if (col) this.addSolid({ rect: col, kind: 'prop', prop: p.id, occludes: false });
      const occ = propOccluder(p);
      if (occ) this.addOccluder({ rect: occ, kind: 'prop', prop: p.id, occludes: true });
    }
    for (const d of def.doors) if (d.level === id) this.addSolid({ rect: d.rect, kind: 'door', door: d.id, occludes: true });
    this.rooms = def.rooms.filter((r) => r.level === id);
  }
  private addSolid(s: Solid) {
    this.solids.push(s);
    this.solidGrid.add(s);
    if (s.occludes) this.addOccluder(s);
  }
  private addOccluder(s: Solid) {
    this.occluders.push(s);
    this.occGrid.add(s);
  }
}

const tmpArr: Solid[] = [];

export class MapRuntime {
  levels = new Map<string, LevelRuntime>();
  stations = new Map<string, StationDef>();
  doors = new Map<string, DoorDef>();
  zones = new Map<string, ZoneDef>();
  constructor(public def: MapDef) {
    for (const l of def.levels) this.levels.set(l.id, new LevelRuntime(l.id, def));
    for (const s of def.stations) this.stations.set(s.id, s);
    for (const d of def.doors) this.doors.set(d.id, d);
    for (const z of def.zones) this.zones.set(z.id, z);
  }

  /** Nivel jugable único del mapa. */
  get mainLevel(): string { return this.def.levels[0].id; }

  level(id: string): LevelRuntime {
    const l = this.levels.get(id);
    if (!l) throw new Error(`Nivel desconocido ${id}`);
    return l;
  }

  roomAt(level: string, x: number, y: number): RoomDef | undefined {
    const lv = this.levels.get(level);
    if (!lv) return undefined;
    for (const r of lv.rooms) {
      if (rectContains(r.rect, x, y)) return r;
      if (r.extra) for (const e of r.extra) if (rectContains(e, x, y)) return r;
    }
    // Sala más cercana (por si está en un umbral de puerta)
    let best: RoomDef | undefined;
    let bd = 60 * 60;
    for (const r of lv.rooms) {
      const cx = clamp(x, r.rect.x, r.rect.x + r.rect.w), cy = clamp(y, r.rect.y, r.rect.y + r.rect.h);
      const d = dist2(x, y, cx, cy);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  /** Punto más cercano del sólido a (x, y). */
  private nearest(s: Solid, x: number, y: number): { x: number; y: number; pad: number } {
    if (s.seg) { const c = closestOnSeg(s.seg, x, y); return { x: c.x, y: c.y, pad: s.seg.half }; }
    const rc = s.rect;
    return { x: clamp(x, rc.x, rc.x + rc.w), y: clamp(y, rc.y, rc.y + rc.h), pad: 0 };
  }

  /** ¿Choca un círculo con algún sólido? */
  collides(level: string, x: number, y: number, r: number, doors: DoorState): boolean {
    const lv = this.level(level);
    tmpArr.length = 0;
    lv.solidGrid.query({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, tmpArr);
    for (const s of tmpArr) {
      if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
      const c = this.nearest(s, x, y);
      const rr = r + c.pad;
      if (dist2(x, y, c.x, c.y) < rr * rr - 0.01) return true;
    }
    return false;
  }

  /**
   * Movimiento con colisión del cuerpo (círculo). Subdivide el paso para no
   * atravesar esquinas a velocidad alta y desliza por las superficies.
   */
  move(level: string, x: number, y: number, dx: number, dy: number, r: number, doors: DoorState): { x: number; y: number } {
    const lv = this.level(level);
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      x += sx;
      y += sy;
      for (let it = 0; it < 4; it++) {
        tmpArr.length = 0;
        lv.solidGrid.query({ x: x - r - 1, y: y - r - 1, w: r * 2 + 2, h: r * 2 + 2 }, tmpArr);
        let pushed = false;
        for (const s of tmpArr) {
          if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
          const c = this.nearest(s, x, y);
          const rr = r + c.pad;
          const ddx = x - c.x, ddy = y - c.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= rr * rr) continue;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            x = c.x + (ddx / d) * rr;
            y = c.y + (ddy / d) * rr;
          } else if (!s.seg) {
            // Centro dentro del rectángulo: sal por el lado más cercano.
            const rc = s.rect;
            const left = x - rc.x, right = rc.x + rc.w - x, top = y - rc.y, bottom = rc.y + rc.h - y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) x = rc.x - r;
            else if (m === right) x = rc.x + rc.w + r;
            else if (m === top) y = rc.y - r;
            else y = rc.y + rc.h + r;
          } else {
            x -= sx; y -= sy;
          }
          pushed = true;
        }
        if (!pushed) break;
      }
    }
    const b = lv.bounds;
    return { x: clamp(x, b.x, b.x + b.w), y: clamp(y, b.y, b.y + b.h) };
  }

  /** Línea de visión entre dos puntos del mismo nivel (muros, oclusores altos y puertas cerradas). */
  los(level: string, x0: number, y0: number, x1: number, y1: number, doors: DoorState): boolean {
    const lv = this.level(level);
    tmpArr.length = 0;
    lv.occGrid.query({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }, tmpArr);
    const dx = x1 - x0, dy = y1 - y0;
    for (const s of tmpArr) {
      if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
      if (s.seg) {
        const t = raySeg(x0, y0, dx, dy, s.seg);
        if (t >= 0 && t < 1) return false;
        continue;
      }
      // Si el origen está dentro del propio sólido (cámaras montadas en pared) no cuenta.
      if (rectContains(s.rect, x0, y0)) continue;
      const t = segmentRectT(x0, y0, x1, y1, s.rect);
      if (t >= 0 && t < 1) return false;
    }
    return true;
  }

  /**
   * Polígono de visibilidad exacto desde (ox, oy).
   *
   * Cada rayo se corta en la primera arista de oclusor que toca (intersección
   * analítica, no una rejilla), así las aristas rectas producen bordes rectos.
   * Para que la cara visible de un muro no quede negra, el rayo entra en el
   * sólido alcanzado hasta su cara opuesta o como máximo `WALL_LIGHT_DEPTH`,
   * recorriendo la unión de sólidos solapados; nunca sale al otro lado.
   * Devuelve [x0, y0, x1, y1, ...] en orden angular.
   */
  visibility(level: string, ox: number, oy: number, radius: number, doors: DoorState, out: number[] = [], baseRays = 180): number[] {
    const lv = this.level(level);
    const area = { x: ox - radius, y: oy - radius, w: radius * 2, h: radius * 2 };
    const occ: Solid[] = [];
    lv.occGrid.query(area, occ);
    const rects: Rect[] = [];
    const segs: Seg[] = [];
    for (const s of occ) {
      if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
      if (s.seg) { segs.push(s.seg); continue; }
      if (rectContains(s.rect, ox, oy)) continue;
      rects.push(s.rect);
    }
    const angles: number[] = [];
    for (let i = 0; i < baseRays; i++) angles.push((i / baseRays) * Math.PI * 2 - Math.PI);
    const r2 = radius * radius * 1.05;
    const addCorner = (cx: number, cy: number) => {
      if (dist2(cx, cy, ox, oy) > r2) return;
      const a = Math.atan2(cy - oy, cx - ox);
      angles.push(a - 1e-4, a, a + 1e-4);
    };
    for (const r of rects) { addCorner(r.x, r.y); addCorner(r.x + r.w, r.y); addCorner(r.x, r.y + r.h); addCorner(r.x + r.w, r.y + r.h); }
    for (const s of segs) { addCorner(s.ax, s.ay); addCorner(s.bx, s.by); }
    angles.sort((a, b) => a - b);
    out.length = 0;
    const tt: [number, number] = [0, 0];
    let lastA = -10;
    for (const a of angles) {
      if (a - lastA < 2e-5) continue;
      lastA = a;
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = radius;
      let bestIsSeg = false;
      for (const r of rects) {
        if (!segmentRectTT(ox, oy, dx, dy, r, tt)) continue;
        const tin = Math.max(0, tt[0]);
        if (tin < best) { best = tin; bestIsSeg = false; }
      }
      for (const s of segs) {
        const t = raySeg(ox, oy, dx, dy, s);
        if (t >= 0 && t < best) { best = t; bestIsSeg = true; }
      }
      let t = best;
      if (best < radius && !bestIsSeg) {
        // Recorre la unión de rectángulos desde el impacto, sin pasar de su salida.
        const cap = Math.min(radius, best + WALL_LIGHT_DEPTH);
        let cur = best;
        for (let guard = 0; guard < 8; guard++) {
          let next = cur;
          for (const r of rects) {
            if (!segmentRectTT(ox, oy, dx, dy, r, tt)) continue;
            if (tt[0] <= cur + 0.01 && tt[1] > next) next = tt[1];
          }
          if (next <= cur + 0.01) break;
          cur = next;
          if (cur >= cap) break;
        }
        // Un casco diagonal dentro del muro también detiene la luz.
        for (const s of segs) {
          const ts = raySeg(ox, oy, dx, dy, s);
          if (ts > best && ts < cur) cur = ts;
        }
        t = Math.min(cur, cap);
      }
      out.push(ox + dx * t, oy + dy * t);
    }
    return out;
  }

  stationsNear(level: string, x: number, y: number, range = 90): StationDef[] {
    const res: StationDef[] = [];
    for (const s of this.def.stations) {
      if (s.level !== level) continue;
      const r = s.range ?? range;
      if (dist2(s.x, s.y, x, y) <= r * r) res.push(s);
    }
    res.sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y));
    return res;
  }

  /** Busca la posición libre más cercana (para restaurar tras transiciones). */
  nearestFree(level: string, x: number, y: number, doors: DoorState = ALL_OPEN): { x: number; y: number } {
    if (!this.collides(level, x, y, PLAYER_RADIUS + 1, doors) && this.insideRooms(level, x, y)) return { x, y };
    for (let rad = 8; rad < 400; rad += 8) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (!this.collides(level, px, py, PLAYER_RADIUS + 1, doors) && this.insideRooms(level, px, py) && this.los(level, x, y, px, py, doors)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  insideRooms(level: string, x: number, y: number): boolean {
    const lv = this.levels.get(level);
    if (!lv) return false;
    for (const r of lv.rooms) {
      if (rectContains(r.rect, x, y)) return true;
      if (r.extra) for (const e of r.extra) if (rectContains(e, x, y)) return true;
    }
    return false;
  }
}
