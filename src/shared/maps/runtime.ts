import { Rect, RectGrid, dist2, rectContains, segmentRectT, segmentRectTT, clamp } from '../geometry';
import type { DoorDef, MapDef, RoomDef, StationDef, ZoneDef } from './types';

export const PLAYER_RADIUS = 12;

export interface Solid {
  rect: Rect;
  kind: 'wall' | 'prop' | 'door';
  door?: string;
  occludes: boolean;
}

/** Estado de puertas cerradas consultado por colisión y visión. */
export interface DoorState {
  isClosed(id: string): boolean;
}
export const ALL_OPEN: DoorState = { isClosed: () => false };

export class LevelRuntime {
  solids: Solid[] = [];
  occluders: Solid[] = [];
  solidGrid = new RectGrid<Solid>(128);
  occGrid = new RectGrid<Solid>(128);
  rooms: RoomDef[] = [];
  bounds: Rect;
  /** Caja que envuelve el contorno del vehículo en este nivel (límite para fantasmas). */
  hullBox: Rect;
  constructor(public id: string, def: MapDef) {
    const lv = def.levels.find((l) => l.id === id)!;
    this.bounds = lv.bounds;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of lv.outline) for (const p of poly) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    this.hullBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    for (const w of def.walls) if (w.level === id) this.addSolid({ rect: w.rect, kind: 'wall', occludes: w.occludes });
    for (const p of def.props) if (p.level === id && p.solid) this.addSolid({ rect: p.rect, kind: 'prop', occludes: false });
    for (const d of def.doors) if (d.level === id) this.addSolid({ rect: d.rect, kind: 'door', door: d.id, occludes: true });
    this.rooms = def.rooms.filter((r) => r.level === id);
  }
  private addSolid(s: Solid) {
    this.solids.push(s);
    this.solidGrid.add(s);
    if (s.occludes) {
      this.occluders.push(s);
      this.occGrid.add(s);
    }
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

  /** ¿Choca un círculo con algún sólido? */
  collides(level: string, x: number, y: number, r: number, doors: DoorState): boolean {
    const lv = this.level(level);
    tmpArr.length = 0;
    lv.solidGrid.query({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, tmpArr);
    for (const s of tmpArr) {
      if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
      const cx = clamp(x, s.rect.x, s.rect.x + s.rect.w), cy = clamp(y, s.rect.y, s.rect.y + s.rect.h);
      if (dist2(x, y, cx, cy) < r * r - 0.01) return true;
    }
    return false;
  }

  /**
   * Movimiento con colisión de un círculo pequeño a la altura de los pies.
   * Subdivide para evitar atravesar paredes y desliza por las superficies.
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
          const rc = s.rect;
          const cx = clamp(x, rc.x, rc.x + rc.w), cy = clamp(y, rc.y, rc.y + rc.h);
          const ddx = x - cx, ddy = y - cy;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            x = cx + (ddx / d) * r;
            y = cy + (ddy / d) * r;
          } else {
            // Centro dentro del rectángulo: sal por el lado más cercano.
            const left = x - rc.x, right = rc.x + rc.w - x, top = y - rc.y, bottom = rc.y + rc.h - y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) x = rc.x - r;
            else if (m === right) x = rc.x + rc.w + r;
            else if (m === top) y = rc.y - r;
            else y = rc.y + rc.h + r;
          }
          pushed = true;
        }
        if (!pushed) break;
      }
    }
    const b = lv.bounds;
    return { x: clamp(x, b.x, b.x + b.w), y: clamp(y, b.y, b.y + b.h) };
  }

  /** Línea de visión entre dos puntos del mismo nivel (paredes y puertas cerradas). */
  los(level: string, x0: number, y0: number, x1: number, y1: number, doors: DoorState): boolean {
    const lv = this.level(level);
    tmpArr.length = 0;
    lv.occGrid.query({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }, tmpArr);
    for (const s of tmpArr) {
      if (s.kind === 'door' && !doors.isClosed(s.door!)) continue;
      // Si el origen está dentro del propio muro (cámaras montadas en pared) no cuenta.
      if (rectContains(s.rect, x0, y0)) continue;
      const t = segmentRectT(x0, y0, x1, y1, s.rect);
      if (t >= 0 && t < 1) return false;
    }
    return true;
  }

  /**
   * Polígono de visibilidad desde (ox, oy). Los rayos atraviesan el primer muro
   * que tocan hasta su cara opuesta para que las caras frontales se vean iluminadas,
   * pero nunca revelan el espacio del otro lado.
   */
  visibility(level: string, ox: number, oy: number, radius: number, doors: DoorState, out: number[] = [], baseRays = 72): number[] {
    const lv = this.level(level);
    const area = { x: ox - radius, y: oy - radius, w: radius * 2, h: radius * 2 };
    const occ: Solid[] = [];
    lv.occGrid.query(area, occ);
    const active = occ.filter((s) => !(s.kind === 'door' && !doors.isClosed(s.door!)));
    const angles: number[] = [];
    for (let i = 0; i < baseRays; i++) angles.push((i / baseRays) * Math.PI * 2 - Math.PI);
    for (const s of active) {
      const r = s.rect;
      const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
      for (const [cx, cy] of corners) {
        if (dist2(cx, cy, ox, oy) > radius * radius * 1.1) continue;
        const a = Math.atan2(cy - oy, cx - ox);
        angles.push(a - 0.002, a + 0.002);
      }
    }
    angles.sort((a, b) => a - b);
    out.length = 0;
    const tt: [number, number] = [0, 0];
    let lastA = -10;
    for (const a of angles) {
      if (a - lastA < 0.0005) continue;
      lastA = a;
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = radius;
      let bestExit = radius;
      for (const s of active) {
        if (rectContains(s.rect, ox, oy)) continue;
        if (!segmentRectTT(ox, oy, dx, dy, s.rect, tt)) continue;
        const tin = Math.max(0, tt[0]);
        if (tin < best) {
          best = tin;
          bestExit = tt[1];
        }
      }
      let t = best;
      if (best < radius) {
        // Atraviesa el muro alcanzado hasta su salida (sin pasar por otros muros).
        let exit = Math.min(bestExit, radius);
        for (const s of active) {
          if (!segmentRectTT(ox, oy, dx, dy, s.rect, tt)) continue;
          if (tt[0] > best + 0.5 && tt[0] < exit) exit = tt[0];
        }
        t = exit;
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
    if (!this.collides(level, x, y, PLAYER_RADIUS + 1, doors)) return { x, y };
    for (let rad = 8; rad < 400; rad += 8) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (!this.collides(level, px, py, PLAYER_RADIUS + 1, doors) && this.insideRooms(level, px, py)) return { x: px, y: py };
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
