import type { MapDef } from '../../shared/maps/types';
import { MapRuntime } from '../../shared/maps/runtime';
import { Rng } from '../../shared/rng';

export const KNIFE_MINIGAMES = ['k_docs', 'k_search', 'k_compartment', 'k_keypad', 'k_auth'] as const;

export interface KnifeChain {
  /** Estación correcta de cada una de las cinco etapas. */
  stations: string[];
  /** Lugares plausibles que se indican al impostor en cada etapa (incluye la correcta). */
  options: string[][];
  code: string;
  codeA: string;
  codeB: string;
}

/**
 * Genera la cadena secreta de cinco etapas a partir de la plantilla del mapa
 * y la semilla. El mapa no cambia: solo qué lugares, pistas y códigos se usan.
 */
export function generateKnifeChain(rng: Rng, map: MapDef, complexity: number): KnifeChain {
  const tpl = map.knife;
  if (!tpl) throw new Error('Mapa sin plantilla de cuchillo');
  const stations: string[] = [];
  const options: string[][] = [];
  const used = new Set<string>();
  tpl.stages.forEach((st) => {
    const pool = st.stations.filter((s) => !used.has(s));
    if (!pool.length) throw new Error('Plantilla de cuchillo sin candidatos libres');
    const pick = rng.pick(pool);
    stations.push(pick);
    used.add(pick);
    const opts = [pick];
    if (complexity >= 3) {
      const decoys = rng.shuffle(pool.filter((s) => s !== pick));
      if (decoys.length) opts.push(decoys[0]);
    }
    options.push(rng.shuffle(opts));
  });
  const codeA = String(rng.int(10, 99));
  const codeB = String(rng.int(10, 99));
  return { stations, options, code: codeA + codeB, codeA, codeB };
}

export function describePlace(map: MapDef, rt: MapRuntime, stationIds: string[], complexity: number): { text: string; hints: { id: string; name: string; level: string; x: number; y: number }[] } {
  const levelName = (id: string) => map.levels.find((l) => l.id === id)?.name ?? id;
  const parts: string[] = [];
  const hints: { id: string; name: string; level: string; x: number; y: number }[] = [];
  for (const sid of stationIds) {
    const s = rt.stations.get(sid)!;
    const room = rt.roomAt(s.level, s.x, s.y);
    if (complexity === 2) {
      parts.push(`algún lugar de ${room?.name ?? 'la zona'} (${levelName(s.level)})`);
      const c = room ? { x: room.rect.x + room.rect.w / 2, y: room.rect.y + room.rect.h / 2 } : { x: s.x, y: s.y };
      hints.push({ id: sid, name: room?.name ?? s.name, level: s.level, x: c.x, y: c.y });
    } else {
      parts.push(`${s.name} — ${room?.name ?? ''} (${levelName(s.level)})`);
      hints.push({ id: sid, name: s.name, level: s.level, x: s.x, y: s.y });
    }
  }
  return { text: parts.join(' o '), hints };
}
