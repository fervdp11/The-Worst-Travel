import { SIM_DT } from './constants';
import { clamp } from './geometry';
import { DoorState, MapRuntime, PLAYER_RADIUS } from './maps/runtime';

/** Cuantiza una dirección analógica a enteros −100..100 (lo que viaja por la red). */
export function quantizeDir(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  if (len < 0.15) return [0, 0];
  const s = len > 1 ? 1 / len : 1;
  return [Math.round(dx * s * 100), Math.round(dy * s * 100)];
}

/**
 * Un paso fijo de simulación. Las diagonales se normalizan: nunca se corre más.
 * La velocidad depende del paso de simulación, no de los FPS.
 */
export function stepMove(
  rt: MapRuntime, level: string, x: number, y: number, qdx: number, qdy: number,
  speed: number, doors: DoorState, ghost: boolean,
): { x: number; y: number } {
  let dx = qdx / 100, dy = qdy / 100;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { x, y };
  if (len > 1) { dx /= len; dy /= len; }
  const d = speed * SIM_DT;
  if (ghost) {
    const hb = rt.level(level).hullBox;
    return { x: clamp(x + dx * d, hb.x + 10, hb.x + hb.w - 10), y: clamp(y + dy * d, hb.y + 10, hb.y + hb.h - 10) };
  }
  return rt.move(level, x, y, dx * d, dy * d, PLAYER_RADIUS, doors);
}
