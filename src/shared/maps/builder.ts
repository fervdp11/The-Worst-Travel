import type { Rect, Vec } from '../geometry';
import type {
  DoorDef, FloorKind, LightKind, MapDef, PropDef, RoomDef, StationDef, StationKind, WallDef, WallKind,
} from './types';

/** Grosor de muros horizontales con cara visible (tapa + cara frontal). */
export const HW = 56;
/** Altura de la tapa superior dentro del grosor. */
export const WALL_CAP = 14;
/** Muro horizontal interior más fino. */
export const HW_IN = 40;
/** Grosor de muros verticales. */
export const VW = 18;
/** Ancho de hueco de puerta. */
export const DOOR = 92;
export const USE_RANGE = 78;

export interface DoorSpec {
  id: string;
  name: string;
  lockable?: boolean;
  sensor?: boolean;
}
export interface Opening {
  at: number;
  w?: number;
  door?: DoorSpec;
}
export interface WallOpts {
  kind?: WallKind;
  openings?: Opening[];
  face?: boolean;
  occludes?: boolean;
  invisible?: boolean;
  windows?: number[];
}

/**
 * Constructor del plano maestro. Todas las piezas comparten origen y escala;
 * de este plano se derivan colisiones, visión, render, minimapa y validación.
 */
export class MapBuilder {
  rooms: RoomDef[] = [];
  walls: WallDef[] = [];
  doors: DoorDef[] = [];
  props: PropDef[] = [];
  stations: StationDef[] = [];
  private propSeq = 0;

  room(id: string, name: string, level: string, rect: Rect, floor: FloorKind, light: LightKind, accent: string, zone?: string, extra?: Rect[], exterior?: boolean) {
    this.rooms.push({ id, name, level, rect, floor, light, accent, zone: zone ?? id, extra, exterior });
  }

  /** Muro horizontal desde x1 a x2 con borde superior en y. */
  hwall(level: string, x1: number, x2: number, y: number, t: number, o: WallOpts = {}) {
    const segs = splitOpenings(x1, x2, o.openings ?? []);
    for (const [a, b] of segs.solid) {
      if (b - a < 1) continue;
      this.walls.push({
        level, rect: { x: a, y, w: b - a, h: t }, kind: o.kind ?? 'wall',
        occludes: o.occludes ?? !(o.kind === 'rail' || o.kind === 'edge'),
        face: o.face ?? t >= 30, invisible: o.invisible,
        windows: o.windows?.filter((wx) => wx > a + 30 && wx < b - 30),
      });
    }
    for (const op of segs.doors) {
      this.doors.push({
        id: op.door.id, name: op.door.name, level, orient: 'h',
        rect: { x: op.a, y, w: op.b - op.a, h: t },
        lockable: op.door.lockable ?? false, sensor: op.door.sensor ?? true,
      });
    }
  }

  /** Muro vertical desde y1 a y2 con borde izquierdo en x. */
  vwall(level: string, x: number, y1: number, y2: number, t: number = VW, o: WallOpts = {}) {
    const segs = splitOpenings(y1, y2, o.openings ?? []);
    for (const [a, b] of segs.solid) {
      if (b - a < 1) continue;
      this.walls.push({
        level, rect: { x, y: a, w: t, h: b - a }, kind: o.kind ?? 'wall',
        occludes: o.occludes ?? !(o.kind === 'rail' || o.kind === 'edge'),
        face: false, invisible: o.invisible,
      });
    }
    for (const op of segs.doors) {
      this.doors.push({
        id: op.door.id, name: op.door.name, level, orient: 'v',
        rect: { x, y: op.a, w: t, h: op.b - op.a },
        lockable: op.door.lockable ?? false, sensor: op.door.sensor ?? true,
      });
    }
  }

  /** Muro invisible arbitrario (colisión de casco, bordes). */
  block(level: string, rect: Rect, kind: WallKind = 'hull', occludes = true, invisible = true) {
    this.walls.push({ level, rect, kind, occludes, face: false, invisible });
  }

  /** Barandilla poligonal: segmentos exactos que no bloquean la visión. */
  rail(level: string, pts: Vec[], t = 14, kind: WallKind = 'rail', invisible = false) {
    this.segs(level, pts, t, kind, false);
    // Representación visual continua de la barandilla.
    if (!invisible) this.props.push({ id: `rail${this.propSeq++}`, level, kind: 'railLine', rect: bboxOf(pts), h: 18, solid: false, flat: false, label: JSON.stringify(pts) });
  }

  /** Muro sólido poligonal que bloquea la visión (casco curvo, morro). */
  hullPoly(level: string, pts: Vec[], t = 18) {
    this.segs(level, pts, t, 'hull', true);
  }

  private segs(level: string, pts: Vec[], t: number, kind: WallKind, occludes: boolean) {
    const half = t / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      this.walls.push({
        level, kind, occludes, face: false, invisible: true,
        rect: { x: Math.min(a.x, b.x) - half, y: Math.min(a.y, b.y) - half, w: Math.abs(b.x - a.x) + t, h: Math.abs(b.y - a.y) + t },
        seg: { ax: a.x, ay: a.y, bx: b.x, by: b.y, half },
      });
    }
  }

  prop(level: string, kind: string, x: number, y: number, w: number, d: number, h: number, o: Partial<PropDef> = {}): string {
    const id = o.id ?? `p${this.propSeq++}`;
    this.props.push({ ...o, id, level, kind, h, solid: o.solid ?? true, rect: { x, y, w, h: d } } as PropDef);
    return id;
  }

  /** Estación interactiva. */
  st(id: string, level: string, x: number, y: number, kind: StationKind, name: string, o: Partial<StationDef> = {}) {
    if (this.stations.some((s) => s.id === id)) throw new Error(`Estación duplicada ${id}`);
    this.stations.push({ id, level, x, y, kind, name, ...o });
  }

  finish(rest: Omit<MapDef, 'rooms' | 'walls' | 'doors' | 'props' | 'stations'>): MapDef {
    return { ...rest, rooms: this.rooms, walls: this.walls, doors: this.doors, props: this.props, stations: this.stations };
  }
}

function splitOpenings(a: number, b: number, ops: Opening[]) {
  const sorted = [...ops].sort((p, q) => p.at - q.at);
  const solid: [number, number][] = [];
  const doors: { a: number; b: number; door: DoorSpec }[] = [];
  let cur = a;
  for (const op of sorted) {
    const w = op.w ?? DOOR;
    const oa = op.at - w / 2, ob = op.at + w / 2;
    solid.push([cur, oa]);
    if (op.door) doors.push({ a: oa, b: ob, door: op.door });
    cur = ob;
  }
  solid.push([cur, b]);
  return { solid, doors };
}

export function bboxOf(pts: Vec[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
