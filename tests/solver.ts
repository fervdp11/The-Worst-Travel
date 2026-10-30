/** Resuelve cualquier minijuego a partir de su puzle (para pruebas de lógica). */
export function solve(mg: string, p: any, part: number, secret?: string): Record<string, unknown> {
  switch (mg) {
    case 'orders_pick': return { items: p.want };
    case 'orders_serve': return { diner: p.diners.findIndex((d: string[]) => [...d].sort().join() === [...p.want].sort().join()) };
    case 'cooking': return part === 0 ? { items: p.ingredients } : { steps: p.steps };
    case 'drink': return { level: (p.lo + p.hi) / 2, placed: true };
    case 'dishes': return { plates: p.plates.length };
    case 'toilet': return part === 0 ? { clean: p.spots.length } : { paper: true };
    case 'wiring': return { map: [0, 1, 2, 3].map((i) => p.right.indexOf(i)) };
    case 'fuses': return part === 0 ? { fuse: p.broken } : { inserted: true };
    case 'pressure': {
      const mid = (p.lo + p.hi) / 2;
      return { v: [mid, mid, mid] };
    }
    case 'filter': return part === 1 ? { clean: true } : { screws: 4 };
    case 'assist': return { seq: p.seq };
    case 'luggage': {
      const used = new Set<number>();
      return { map: p.bags.map((b: string) => { const i = p.slots.findIndex((s: string, k: number) => s === b && !used.has(k)); used.add(i); return i; }) };
    }
    case 'bilge': return part === 0 ? { strokes: p.strokes } : { valve: true };
    case 'seal': return { order: p.order };
    case 'ballast': return { a: 0.5, b: 0.5 };
    case 'ballast_trim': return { confirm: true };
    case 'carts': return part === 0 ? { placed: 3 } : { latched: 3 };
    case 'sorting': return { bins: p.bags.map((b: string) => p.bins.indexOf(b)) };
    case 'cabinPressure': return { a: p.target, b: p.target };
    case 'cabinPressure_door': return { hold: true };
    case 'rep_lights': return part === 0 ? { states: [true, true, true, true, true] } : { hold: true };
    case 'rep_comms': return part === 0 ? { freq: p.target } : { synced: true };
    case 'crit_patch': return part === 0 ? { patched: true } : { bolts: 4 };
    case 'crit_pumps': return { order: p.order, lever: true };
    case 'crit_stabilize': return { v: p.bands.map((b: number[]) => (b[0] + b[1]) / 2) };
    case 'crit_telegraph': return { notch: p.notch, confirm: true };
    case 'crit_valves': return { open: [false, false, false, false] };
    case 'crit_seal': return part === 0 ? { checked: p.bad } : { locked: true };
    case 'crit_power': return { states: p.need };
    case 'crit_navalign': return { heading: p.target };
    case 'k_docs': return { page: p.page, line: p.line };
    case 'k_search': return { done: true };
    case 'k_compartment': return part === 0 ? { key: true } : { open: true };
    case 'k_keypad': return { code: secret };
    case 'k_auth': return { map: p.pattern };
  }
  throw new Error(`Sin solucionador para ${mg}`);
}
