import type { MapDef } from '../../shared/maps/types';
import type { TaskPrivate } from '../../shared/protocol';
import { Rng } from '../../shared/rng';
import type { GameSettings } from '../../shared/settings';
import type { Game } from './Game';
import type { TaskInst } from './types';

let taskSeq = 0;

/**
 * Lista FINITA de tareas obligatorias por trabajador. El impostor recibe una
 * lista aparente equivalente marcada como falsa (nunca suma progreso).
 */
export function assignTasks(rng: Rng, map: MapDef, gs: GameSettings, fake: boolean): TaskInst[] {
  const shorts = rng.shuffle(map.tasks.filter((t) => t.length === 'short'));
  const longs = rng.shuffle(map.tasks.filter((t) => t.length === 'long'));
  const chosen = [...shorts.slice(0, gs.shortTasks), ...longs.slice(0, gs.longTasks)];
  return chosen.map((slot) => {
    const stations = slot.stages.map((st) => rng.pick(st.stations));
    const memory: Record<string, unknown> = {};
    if (slot.type === 'orders') {
      const k = slot.stages[1].stations.indexOf(stations[1]);
      memory.table = k + 1;
    }
    return {
      id: `t${++taskSeq}`, slot, stations, stage: 0, part: 0, done: false, fake, memory,
      puzzles: slot.stages.map(() => null),
    };
  });
}

export function taskPrivate(g: Game, t: TaskInst): TaskPrivate {
  const st = t.done ? null : t.stations[t.stage];
  const s = st ? g.rt.stations.get(st) : undefined;
  let label = t.slot.stages[Math.min(t.stage, t.slot.stages.length - 1)].label;
  if (t.slot.type === 'orders' && t.stage === 1 && s) label = `Sirve al pasajero: ${s.name}`;
  return {
    id: t.id, type: t.slot.type, name: t.slot.name, length: t.slot.length, stage: t.stage, stages: t.slot.stages.length,
    done: t.done, station: st, stationName: s?.name ?? '', level: s?.level ?? '', label, fake: t.fake,
  };
}
