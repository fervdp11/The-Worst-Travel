export const SKIP = 'skip';

export interface TallyResult {
  counts: Record<string, number>;
  ejected: string | null;
  tie: boolean;
  skipped: boolean;
  max: number;
}

/**
 * Resolución de votos: gana la opción con más votos. Una persona solo es expulsada
 * si supera estrictamente a todas las demás opciones (incluido SALTAR).
 * Si SALTAR tiene el máximo o hay empate en el máximo, nadie es expulsado.
 * Agotar el tiempo sin votar no cuenta como voto.
 */
export function tallyVotes(votes: Record<string, string>, eligibleVoters: string[], validTargets: string[]): TallyResult {
  const counts: Record<string, number> = { [SKIP]: 0 };
  for (const t of validTargets) counts[t] = 0;
  const voters = new Set(eligibleVoters);
  for (const [voter, target] of Object.entries(votes)) {
    if (!voters.has(voter)) continue;
    if (target !== SKIP && !(target in counts)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let max = 0;
  for (const v of Object.values(counts)) max = Math.max(max, v);
  const top = Object.keys(counts).filter((k) => counts[k] === max);
  if (max === 0) return { counts, ejected: null, tie: false, skipped: false, max };
  if (top.length > 1) return { counts, ejected: null, tie: true, skipped: top.includes(SKIP), max };
  if (top[0] === SKIP) return { counts, ejected: null, tie: false, skipped: true, max };
  return { counts, ejected: top[0], tie: false, skipped: false, max };
}
