import { buildLobby } from './lobby';
import { buildPlane } from './plane';
import { MapRuntime } from './runtime';
import { buildMarket } from './market';
import { buildShip } from './ship';
import type { AnyMapId, GameMode, MapDef, MapId, TravelMapId } from './types';

const builders: Record<AnyMapId, () => MapDef> = {
  ship: buildShip,
  plane: buildPlane,
  market: buildMarket,
  lobby: buildLobby,
};

const cache = new Map<AnyMapId, MapDef>();
const rtCache = new Map<AnyMapId, MapRuntime>();

/** Plano maestro único por mapa (determinista, compartido cliente/servidor). */
export function getMap(id: AnyMapId): MapDef {
  let m = cache.get(id);
  if (!m) {
    m = builders[id]();
    finalize(m);
    cache.set(id, m);
  }
  return m;
}

export function getRuntime(id: AnyMapId): MapRuntime {
  let r = rtCache.get(id);
  if (!r) {
    r = new MapRuntime(getMap(id));
    rtCache.set(id, r);
  }
  return r;
}

export const MAP_IDS: MapId[] = ['ship', 'plane', 'market'];
export const TRAVEL_MAPS: TravelMapId[] = ['ship', 'plane'];

export function isMapId(v: unknown): v is MapId {
  return typeof v === 'string' && (MAP_IDS as string[]).includes(v);
}

/** Modo de juego al que pertenece cada mapa. */
export function modeOf(id: MapId): GameMode {
  return id === 'market' ? 'market' : 'travel';
}

/** Migra un mapa guardado o recibido (p. ej. el antiguo tren) a uno válido. */
export function migrateMapId(v: unknown, mode?: GameMode): MapId {
  if (isMapId(v) && (!mode || modeOf(v) === mode)) return v;
  return mode === 'market' ? 'market' : 'ship';
}

/** Completa datos derivados: puntos seguros por sala. */
function finalize(m: MapDef) {
  const rt = new MapRuntime(m);
  if (m.safePoints.length === 0) {
    for (const r of m.rooms) {
      const c = { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 };
      const p = rt.nearestFree(r.level, c.x, c.y);
      if (rt.insideRooms(r.level, p.x, p.y)) m.safePoints.push({ level: r.level, x: Math.round(p.x), y: Math.round(p.y) });
    }
  }
}

export * from './types';
export { MapRuntime } from './runtime';
