import { dist2, rectContains } from '../../shared/geometry';
import type { CameraDef } from '../../shared/maps/types';
import type { AnimCode, EntSnap, OccupancyData, Snapshot } from '../../shared/protocol';
import type { Game } from './Game';
import type { GPlayer } from './types';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** ¿Está oculto a los demás (dentro de trampilla, taquilla o invisible)? */
export function hiddenFromOthers(p: GPlayer): boolean {
  if (p.invisible) return true;
  if (p.state === 'vent') return !(p.timed && (p.timed.kind === 'ventIn' || p.timed.kind === 'ventOut'));
  if (p.state === 'locker') return !(p.timed && (p.timed.kind === 'lockerIn' || p.timed.kind === 'lockerOut'));
  return false;
}

export function animOf(p: GPlayer, now = 0): AnimCode {
  if (!p.connected) return 'stopped';
  if (p.pickUntil > now) return 'pick';
  const t = p.timed;
  if (t) {
    switch (t.kind) {
      case 'ventIn': return 'ventIn';
      case 'ventOut': return 'ventOut';
      case 'lockerIn': return 'lockerIn';
      case 'lockerOut': return 'lockerOut';
      case 'sabotage': case 'doorOpen': return 'repair';
      case 'attack': return 'attack';
      case 'cast': return 'cast';
      default: break;
    }
  }
  if (p.panel) {
    if (p.panel.ctx === 'repair') return 'repair';
    if (p.panel.mg === 'k_search') return 'search';
    return 'task';
  }
  if (p.sysPanel?.kind === 'cameras' || p.observing) return 'cams';
  if (p.sysPanel?.kind === 'occupancy') return 'task';
  return p.moving ? 'walk' : 'idle';
}

export function camJammed(g: Game, camId: string): boolean {
  if (g.commsDown()) return true;
  return g.interference.some((i) => i.endsGt > g.gt && i.cams.includes(camId));
}

export function activeCamera(g: Game, v: GPlayer): CameraDef | null {
  let id: string | undefined;
  if (v.sysPanel?.kind === 'cameras') id = v.sysPanel.cam;
  else if (v.observing) id = v.observing.cam;
  if (!id || camJammed(g, id)) return null;
  return g.map.cameras.find((c) => c.id === id) ?? null;
}

function seesPoint(g: Game, v: GPlayer, level: string, x: number, y: number, radius: number): boolean {
  if (level !== v.level) return false;
  if (dist2(v.x, v.y, x, y) > radius * radius) return false;
  return g.rt.los(level, v.x, v.y - 8, x, y - 8, g.doorState);
}

function camSees(g: Game, cam: CameraDef | null, level: string, x: number, y: number): boolean {
  if (!cam || cam.level !== level) return false;
  if (!rectContains(cam.view, x, y)) return false;
  return g.rt.los(level, cam.x, cam.y, x, y - 8, g.doorState);
}

/** Instantánea filtrada para un observador concreto: solo lo que puede ver. */
export function buildSnapshot(g: Game, v: GPlayer, now: number): Snapshot {
  const ghostView = !v.alive;
  // Durante la caja y las reuniones del supermercado todos ven la escena común.
  const shared = g.mode === 'market' && g.phase !== 'COMPRA';
  const vr = g.visionOf(v) + 50;
  const cam = ghostView || g.mode === 'market' ? null : activeCamera(g, v);
  const ents: EntSnap[] = [];
  for (const p of g.players.values()) {
    if (p === v || p.left) continue;
    if (!p.alive) {
      if (ghostView && p.level === v.level) {
        ents.push({ h: g.handleFor(v, `g:${p.id}`), k: 'g', x: r1(p.x), y: r1(p.y), l: p.level, f: p.facing, a: p.moving ? 'walk' : 'idle', n: p.name, c: p.color, ac: p.acc });
      }
      continue;
    }
    if (hiddenFromOthers(p) && !ghostView) continue;
    if (hiddenFromOthers(p) && ghostView && p.state !== 'locker' && !p.invisible) continue;
    let seen = false;
    let viaCam: string | undefined;
    if (ghostView || shared) seen = p.level === v.level;
    else seen = seesPoint(g, v, p.level, p.x, p.y, vr);
    if (!seen && camSees(g, cam, p.level, p.x, p.y)) { seen = true; viaCam = cam!.id; }
    if (!seen) continue;
    let key = `p:${p.id}`, name = p.name, color = p.color, acc = p.acc;
    if (p.disguise) {
      const t = g.players.get(p.disguise.as);
      key = `dis:${p.id}:${p.disguise.seq}`;
      if (t) { name = t.name; color = t.color; acc = t.acc; }
    }
    const e: EntSnap = { h: g.handleFor(v, key), k: 'p', x: r1(p.x), y: r1(p.y), l: p.level, f: p.facing, a: animOf(p, now), n: name, c: color, ac: acc };
    // En el súper la bolsa es cerrada: nunca se envía el producto a los demás.
    if (p.carrying) { if (g.mode === 'market') e.bg = 1; else e.tr = 1; }
    if (p.timed && (p.timed.kind === 'ventIn' || p.timed.kind === 'ventOut' || p.timed.kind === 'lockerIn' || p.timed.kind === 'lockerOut')) {
      e.hs = p.timed.kind;
      e.hst = p.timed.kind.startsWith('vent') ? (p.vent?.id ?? p.timed.data.vent) : p.locker?.id;
    }
    if (!p.connected) e.dc = 1;
    if (viaCam) e.cam = viaCam;
    if (p.speedBoostEndsGt > g.gt && p.moving) e.sp = 1;
    ents.push(e);
  }
  const r = g.responsible;
  if (r.alive) {
    let seen = ghostView ? r.level === v.level : seesPoint(g, v, r.level, r.x, r.y, vr);
    let viaCam: string | undefined;
    if (!seen && camSees(g, cam, r.level, r.x, r.y)) { seen = true; viaCam = cam!.id; }
    if (seen) {
      const rd = g.map.responsible!;
      const moving = g.gt >= r.waitUntil && !r.struggling;
      ents.push({ h: g.handleFor(v, 'resp'), k: 'r', x: r1(r.x), y: r1(r.y), l: r.level, f: r.facing, a: r.struggling ? 'attack' : moving ? 'walk' : 'task', n: `${rd.title} · ${rd.name.split(' ').slice(-1)[0]}`, c: -1, ac: 0, cam: viaCam });
    }
  }
  for (const d of g.decoys) {
    if (d.owner === v.id && !ghostView) {
      // El propietario también ve su señuelo si está en su visión.
    }
    let seen = ghostView ? d.level === v.level : seesPoint(g, v, d.level, d.x, d.y, vr);
    let viaCam: string | undefined;
    if (!seen && camSees(g, cam, d.level, d.x, d.y)) { seen = true; viaCam = cam!.id; }
    if (!seen) continue;
    const e: EntSnap = { h: g.handleFor(v, `d:${d.id}`), k: 'p', x: r1(d.x), y: r1(d.y), l: d.level, f: d.facing, a: 'task', n: d.name, c: d.color, ac: d.acc };
    if (viaCam) e.cam = viaCam;
    if (v.level === d.level && dist2(v.x, v.y, d.x, d.y) < 70 * 70) e.dz = 1;
    ents.push(e);
  }
  return {
    t: now,
    gt: g.gt,
    me: {
      x: r1(v.x), y: r1(v.y), l: v.level, ack: v.ack, st: v.state, f: v.facing, vis: Math.round(g.visionOf(v)), speed: g.speedOf(v),
      ...(v.timed && (v.timed.kind === 'ventIn' || v.timed.kind === 'ventOut' || v.timed.kind === 'ventMove' || v.timed.kind === 'lockerIn' || v.timed.kind === 'lockerOut')
        ? { hs: v.timed.kind, hst: v.timed.kind.startsWith('vent') ? (v.vent?.id ?? v.timed.data.vent) : v.locker?.id } : {}),
    },
    e: ents,
  };
}

/**
 * Ocupación aproximada por zona: empleados vivos en el nivel elegido.
 * Incluye ocultos en taquillas e invisibles (siguen siendo cuerpos reales);
 * excluye pasajeros, señuelos, expulsados y quien está en trampillas o escaleras.
 */
export function occupancy(g: Game, level: string): OccupancyData {
  const zones = g.map.zones.filter((z) => z.level === level);
  const counts: Record<string, number> = {};
  for (const z of zones) counts[z.id] = 0;
  for (const p of g.players.values()) {
    if (!p.alive || p.left || p.level !== level) continue;
    if (p.state === 'vent') continue;
    const room = g.rt.roomAt(p.level, p.x, p.y);
    if (room && room.zone in counts) counts[room.zone]++;
  }
  const noSignal = g.commsDown();
  const jammed = new Set(g.interference.filter((i) => i.endsGt > g.gt).flatMap((i) => i.zones));
  return {
    level,
    t: g.gt,
    noSignal,
    zones: zones.map((z) => ({ id: z.id, name: z.name, count: noSignal || jammed.has(z.id) ? null : counts[z.id], noise: jammed.has(z.id) })),
  };
}
