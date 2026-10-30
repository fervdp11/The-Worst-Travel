import { Rng } from './rng';

/**
 * Catálogo de minijuegos: generación de puzles (servidor) y validación de cada parte.
 * El cliente recibe solo el puzle visible; los secretos (p. ej. la combinación del
 * cuchillo) se comprueban con `secret`, que nunca sale del servidor.
 */
export interface MgCtx {
  complexity: number;
  memory?: Record<string, unknown>;
  mapId: string;
}

export interface MinigameDef {
  id: string;
  parts: number;
  /** Duración mínima plausible por parte (ms) desde que empezó esa parte. */
  minMs: number[];
  /** Partes de espera o esfuerzo (las acelera el Técnico en reparaciones no críticas). */
  waitParts?: number[];
  gen(rng: Rng, ctx: MgCtx): Record<string, unknown>;
  check(puz: any, part: number, ans: any, secret?: unknown): boolean;
  /** Memoria que pasa a la siguiente etapa de la tarea. */
  remember?(puz: any, ans: any): Record<string, unknown>;
}

export const FOODS = ['sopa', 'ensalada', 'bocadillo', 'tarta', 'cafe', 'zumo', 'fruta', 'pan', 'queso', 'pasta'];
export const COOK_STEPS = ['cortar', 'remover', 'sazonar', 'hornear', 'emplatar'];
export const DESTS = ['MAD', 'BCN', 'LIS', 'ROM', 'PAR'];

const sameSet = (a: unknown, b: unknown[]) => Array.isArray(a) && a.length === b.length && [...a].sort().join() === [...b].sort().join();
const sameSeq = (a: unknown, b: unknown[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const perm = (rng: Rng, n: number) => rng.shuffle([...Array(n).keys()]);
const trueish = (v: unknown) => v === true;

const defs: MinigameDef[] = [
  // ---------------- TAREAS ----------------
  {
    id: 'orders_pick', parts: 1, minMs: [1500],
    gen: (rng, ctx) => {
      const want = rng.shuffle([...FOODS]).slice(0, 3);
      const options = rng.shuffle([...want, ...rng.shuffle(FOODS.filter((f) => !want.includes(f))).slice(0, 3)]);
      return { want, options, table: (ctx.memory?.table as number) ?? 1 };
    },
    check: (p, _part, a) => sameSet(a?.items, p.want),
    remember: (p) => ({ want: p.want, table: p.table }),
  },
  {
    id: 'orders_serve', parts: 1, minMs: [1000],
    gen: (rng, ctx) => {
      const want = (ctx.memory?.want as string[]) ?? rng.shuffle([...FOODS]).slice(0, 3);
      const n = rng.int(2, 4);
      const diners: string[][] = [];
      const correct = rng.int(0, n - 1);
      for (let i = 0; i < n; i++) {
        if (i === correct) diners.push(rng.shuffle([...want]));
        else {
          const alt = [...want];
          alt[rng.int(0, 2)] = rng.pick(FOODS.filter((f) => !want.includes(f)));
          diners.push(rng.shuffle(alt));
        }
      }
      return { want, diners };
    },
    check: (p, _part, a) => {
      const i = num(a?.diner);
      return Number.isInteger(i) && i >= 0 && i < p.diners.length && sameSet(p.diners[i], p.want);
    },
  },
  {
    id: 'cooking', parts: 2, minMs: [1000, 2400],
    gen: (rng) => {
      const ingredients = rng.shuffle([...FOODS]).slice(0, 3);
      const options = rng.shuffle([...ingredients, ...rng.shuffle(FOODS.filter((f) => !ingredients.includes(f))).slice(0, 3)]);
      const steps = rng.shuffle([...COOK_STEPS]).slice(0, 3);
      return { ingredients, options, steps };
    },
    check: (p, part, a) => (part === 0 ? sameSet(a?.items, p.ingredients) : sameSeq(a?.steps, p.steps)),
  },
  {
    id: 'drink', parts: 1, minMs: [1300],
    gen: (rng) => {
      const lo = rng.range(0.55, 0.72);
      return { lo, hi: lo + 0.12, cup: rng.pick(['taza', 'vaso', 'jarra']) };
    },
    check: (p, _part, a) => num(a?.level) >= p.lo - 0.01 && num(a?.level) <= p.hi + 0.01 && trueish(a?.placed),
  },
  {
    id: 'dishes', parts: 1, minMs: [2400],
    gen: (rng) => ({ plates: Array.from({ length: 3 }, () => Array.from({ length: rng.int(3, 5) }, () => [rng.range(0.25, 0.75), rng.range(0.25, 0.75), rng.range(0.07, 0.12)])) }),
    check: (p, _part, a) => num(a?.plates) === p.plates.length,
  },
  {
    id: 'toilet', parts: 2, minMs: [1800, 700],
    gen: (rng) => ({ spots: Array.from({ length: rng.int(4, 6) }, () => [rng.range(0.15, 0.85), rng.range(0.3, 0.85)]) }),
    check: (p, part, a) => (part === 0 ? num(a?.clean) === p.spots.length : trueish(a?.paper)),
  },
  {
    id: 'wiring', parts: 1, minMs: [1800],
    gen: (rng) => ({ symbols: rng.shuffle(['circulo', 'cuadrado', 'triangulo', 'rombo', 'estrella', 'cruz']).slice(0, 4), right: perm(rng, 4) }),
    check: (p, _part, a) => Array.isArray(a?.map) && a.map.length === 4 && a.map.every((r: unknown, i: number) => p.right[r as number] === i),
  },
  {
    id: 'fuses', parts: 2, minMs: [900, 700],
    gen: (rng) => {
      const broken = rng.int(0, 5);
      const readings = Array.from({ length: 6 }, (_, i) => (i === broken ? 0 : rng.int(11, 13)));
      return { broken, readings };
    },
    check: (p, part, a) => (part === 0 ? num(a?.fuse) === p.broken : trueish(a?.inserted)),
  },
  {
    id: 'pressure', parts: 1, minMs: [1500],
    gen: (rng) => {
      const coef = [rng.range(0.25, 0.4), rng.range(0.25, 0.4), rng.range(0.25, 0.4)];
      const lo = rng.range(0.42, 0.6);
      return { coef, start: [rng.range(0, 0.2), rng.range(0.8, 1), rng.range(0, 1)], lo, hi: lo + 0.12 };
    },
    check: (p, _part, a) => {
      if (!Array.isArray(a?.v) || a.v.length !== 3) return false;
      const sum = p.coef.reduce((s: number, c: number, i: number) => s + c * Math.min(1, Math.max(0, num(a.v[i]))), 0) / p.coef.reduce((s: number, c: number) => s + c, 0);
      return sum >= p.lo - 0.01 && sum <= p.hi + 0.01;
    },
  },
  {
    id: 'filter', parts: 3, minMs: [1200, 2000, 1200],
    gen: (rng) => ({ dirt: Array.from({ length: 8 }, () => [rng.range(0.2, 0.8), rng.range(0.25, 0.75)]) }),
    check: (_p, part, a) => (part === 1 ? trueish(a?.clean) : num(a?.screws) === 4),
  },
  {
    id: 'assist', parts: 1, minMs: [2500],
    gen: (rng, ctx) => ({ seq: Array.from({ length: 3 + Math.min(2, ctx.complexity) }, () => rng.int(0, 5)) }),
    check: (p, _part, a) => sameSeq(a?.seq, p.seq),
  },
  {
    id: 'luggage', parts: 1, minMs: [1800],
    gen: (rng) => {
      const bags = rng.shuffle(['S', 'M', 'L', 'M']);
      return { bags, slots: rng.shuffle([...bags]) };
    },
    check: (p, _part, a) => Array.isArray(a?.map) && a.map.length === p.bags.length && new Set(a.map).size === p.bags.length && a.map.every((s: number, i: number) => p.slots[s] === p.bags[i]),
  },
  {
    id: 'roof', parts: 2, minMs: [1200, 900],
    gen: (rng) => ({ target: rng.range(0.15, 0.85), tol: 0.06 }),
    check: (p, part, a) => (part === 0 ? Math.abs(num(a?.angle) - p.target) <= p.tol : num(a?.anchors) === 3),
  },
  {
    id: 'signal', parts: 1, minMs: [1500],
    gen: (rng) => ({ route: rng.pick(['A', 'B', 'C']), levers: [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)] }),
    check: (p, _part, a) => sameSeq(a?.levers, p.levers) && a?.aspect === 'verde',
  },
  {
    id: 'brakes_read', parts: 1, minMs: [1500],
    gen: (rng) => {
      const lo = rng.range(0.35, 0.6);
      return { lo, hi: lo + 0.14 };
    },
    check: (p, _part, a) => num(a?.value) >= p.lo - 0.01 && num(a?.value) <= p.hi + 0.01,
    remember: (_p, a) => ({ value: Math.round(num(a?.value) * 100) / 100 }),
  },
  {
    id: 'brakes_set', parts: 1, minMs: [1500],
    gen: (_rng, ctx) => ({ target: (ctx.memory?.value as number) ?? 0.5, tol: 0.05 }),
    check: (p, _part, a) => Math.abs(num(a?.value) - p.target) <= p.tol,
  },
  {
    id: 'bilge', parts: 2, minMs: [2800, 400],
    gen: (rng) => ({ strokes: rng.int(6, 8) }),
    check: (p, part, a) => (part === 0 ? num(a?.strokes) >= p.strokes : trueish(a?.valve)),
  },
  {
    id: 'seal', parts: 1, minMs: [2000],
    gen: (rng) => {
      const star = [0, 3, 1, 4, 2, 5];
      const rot = rng.int(0, 5);
      return { order: star.map((s) => (s + rot) % 6) };
    },
    check: (p, _part, a) => sameSeq(a?.order, p.order),
  },
  {
    id: 'ballast', parts: 1, minMs: [1800],
    gen: (rng) => ({ a: rng.range(0.15, 0.4), b: rng.range(0.6, 0.85) }),
    check: (_p, _part, a) => Math.abs(num(a?.a) - num(a?.b)) <= 0.05 && num(a?.a) > 0.2 && num(a?.a) < 0.8,
  },
  {
    id: 'ballast_trim', parts: 1, minMs: [1200],
    gen: () => ({}),
    check: (_p, _part, a) => trueish(a?.confirm),
  },
  {
    id: 'carts', parts: 2, minMs: [1500, 800],
    gen: (rng) => ({ order: perm(rng, 3) }),
    check: (_p, part, a) => (part === 0 ? num(a?.placed) === 3 : num(a?.latched) === 3),
  },
  {
    id: 'sorting', parts: 1, minMs: [3000],
    gen: (rng) => {
      const bins = rng.shuffle([...DESTS]).slice(0, 3);
      return { bins, bags: Array.from({ length: 5 }, () => rng.pick(bins)) };
    },
    check: (p, _part, a) => Array.isArray(a?.bins) && a.bins.length === p.bags.length && a.bins.every((b: number, i: number) => p.bins[b] === p.bags[i]),
  },
  {
    id: 'cabinPressure', parts: 1, minMs: [1800],
    gen: (rng) => ({ target: rng.range(0.35, 0.75), ka: rng.range(0.4, 0.6) }),
    check: (p, _part, a) => Math.abs(p.ka * num(a?.a) + (1 - p.ka) * num(a?.b) - p.target) <= 0.04,
  },
  {
    id: 'cabinPressure_door', parts: 1, minMs: [1500],
    gen: () => ({}),
    check: (_p, _part, a) => trueish(a?.hold),
  },
  // ---------------- REPARACIONES ----------------
  {
    id: 'rep_lights', parts: 2, minMs: [700, 2000], waitParts: [1],
    gen: (rng) => {
      const s = Array.from({ length: 5 }, () => rng.chance(0.5));
      if (s.every(Boolean)) s[rng.int(0, 4)] = false;
      return { switches: s };
    },
    check: (_p, part, a) => (part === 0 ? Array.isArray(a?.states) && a.states.length === 5 && a.states.every(trueish) : trueish(a?.hold)),
  },
  {
    id: 'rep_comms', parts: 2, minMs: [1000, 2500], waitParts: [1],
    gen: (rng) => ({ target: rng.range(0.1, 0.9) }),
    check: (p, part, a) => (part === 0 ? Math.abs(num(a?.freq) - p.target) <= 0.035 : trueish(a?.synced)),
  },
  { id: 'crit_levers', parts: 1, minMs: [1300], gen: (rng) => ({ order: perm(rng, 4) }), check: (p, _part, a) => sameSeq(a?.order, p.order) },
  { id: 'crit_keyconfirm', parts: 2, minMs: [500, 1500], gen: () => ({}), check: (_p, part, a) => (part === 0 ? trueish(a?.key) : trueish(a?.hold)) },
  {
    id: 'crit_coolant', parts: 1, minMs: [1300],
    gen: (rng) => ({ valves: 5, open: rng.shuffle([0, 1, 2, 3, 4]).slice(0, 3).sort() }),
    check: (p, _part, a) => sameSet(a?.open, p.open),
  },
  { id: 'crit_relief', parts: 1, minMs: [1500], gen: (rng) => ({ target: rng.range(0.55, 0.85), tol: 0.06 }), check: (p, _part, a) => Math.abs(num(a?.angle) - p.target) <= p.tol },
  { id: 'crit_patch', parts: 2, minMs: [700, 1200], gen: (rng) => ({ leak: [rng.range(0.3, 0.7), rng.range(0.35, 0.65)] }), check: (_p, part, a) => (part === 0 ? trueish(a?.patched) : num(a?.bolts) === 4) },
  { id: 'crit_pumps', parts: 1, minMs: [1500], gen: (rng) => ({ order: perm(rng, 3) }), check: (p, _part, a) => sameSeq(a?.order, p.order) && trueish(a?.lever) },
  {
    id: 'crit_stabilize', parts: 1, minMs: [1500],
    gen: (rng) => ({ bands: Array.from({ length: 3 }, () => { const lo = rng.range(0.2, 0.68); return [lo, lo + 0.14]; }), start: [rng.range(0, 1), rng.range(0, 1), rng.range(0, 1)] }),
    check: (p, _part, a) => Array.isArray(a?.v) && a.v.length === 3 && a.v.every((v: number, i: number) => num(v) >= p.bands[i][0] - 0.01 && num(v) <= p.bands[i][1] + 0.01),
  },
  { id: 'crit_telegraph', parts: 1, minMs: [1000], gen: (rng) => ({ notch: rng.int(3, 4) }), check: (p, _part, a) => num(a?.notch) === p.notch && trueish(a?.confirm) },
  {
    id: 'crit_valves', parts: 1, minMs: [1200],
    gen: (rng) => { const o = [rng.chance(0.7), rng.chance(0.7), rng.chance(0.7), true]; return { open: rng.shuffle(o) }; },
    check: (_p, _part, a) => Array.isArray(a?.open) && a.open.length === 4 && a.open.every((v: unknown) => v === false),
  },
  {
    id: 'crit_seal', parts: 2, minMs: [1200, 600],
    gen: (rng) => ({ bad: rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, rng.int(2, 3)).sort() }),
    check: (p, part, a) => (part === 0 ? sameSet(a?.checked, p.bad) : trueish(a?.locked)),
  },
  {
    id: 'crit_power', parts: 1, minMs: [1200],
    gen: (rng) => { const need = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)]; need[rng.int(0, 3)] = true; return { need }; },
    check: (p, _part, a) => sameSeq(a?.states, p.need),
  },
  { id: 'crit_navalign', parts: 1, minMs: [1200], gen: (rng) => ({ target: rng.int(0, 359) }), check: (p, _part, a) => { const d = Math.abs(((num(a?.heading) - p.target + 540) % 360) - 180); return d <= 4; } },
  // ---------------- PREPARACIÓN DEL CUCHILLO ----------------
  {
    id: 'k_docs', parts: 1, minMs: [1500],
    gen: (rng) => {
      const page = rng.int(0, 2);
      return { pages: 3, page, line: rng.int(1, 4) };
    },
    check: (p, _part, a) => num(a?.page) === p.page && num(a?.line) === p.line,
  },
  { id: 'k_search', parts: 1, minMs: [2000], gen: (_rng, ctx) => ({ hold: 1500 + ctx.complexity * 700 }), check: (_p, _part, a) => trueish(a?.done) },
  { id: 'k_compartment', parts: 2, minMs: [800, 600], gen: () => ({}), check: (_p, part, a) => (part === 0 ? trueish(a?.key) : trueish(a?.open)) },
  { id: 'k_keypad', parts: 1, minMs: [1200], gen: () => ({ len: 4 }), check: (_p, _part, a, secret) => typeof a?.code === 'string' && a.code === secret },
  { id: 'k_auth', parts: 1, minMs: [1500], gen: (rng) => ({ pattern: perm(rng, 3) }), check: (p, _part, a) => Array.isArray(a?.map) && a.map.every((r: number, i: number) => p.pattern[i] === r) && a.map.length === 3 },
];

export const MINIGAMES: Record<string, MinigameDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

/** Minijuego de cada etapa de una tarea. */
export function taskMinigame(type: string, stage: number): string {
  const multi: Record<string, string[]> = {
    orders: ['orders_pick', 'orders_serve'],
    brakes: ['brakes_read', 'brakes_set'],
    ballast: ['ballast', 'ballast_trim'],
    cabinPressure: ['cabinPressure', 'cabinPressure_door'],
  };
  return multi[type]?.[stage] ?? type;
}
