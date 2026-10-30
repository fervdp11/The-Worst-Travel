import { dist } from '../../shared/geometry';
import { DISH_BY_ID, PRODUCT_BY_ID, pickDish } from '../../shared/market';
import type { ClientAction, MarketEntry, MarketPrivate, MarketPublic } from '../../shared/protocol';
import type { Game } from './Game';
import type { GPlayer } from './types';

/**
 * Modo SUPERMERCADO (autoridad del servidor).
 *  - El plato secreto solo viaja en el estado privado de los trabajadores.
 *  - El producto que lleva cada persona solo lo conoce su propietario hasta el
 *    cierre de compras; los demás ven una bolsa cerrada.
 *  - Nada evalúa si un ingrediente es «correcto»: se discute y se vota.
 */
export interface MarketState {
  dish: string;
  round: number;
  /** Producto en la mano de cada persona (privado). */
  carrying: Map<string, string>;
  /** Entregas confirmadas de esta ronda, en orden de llegada. */
  deliveries: { pid: string; product: string; at: number }[];
  /** Productos aportados por cada persona en esta partida (no puede repetirlos). */
  used: Map<string, string[]>;
  /** Revelación en curso. */
  reveal: { order: { pid: string; product: string | null }[]; startedAt: number; perMs: number; shown: number } | null;
  history: MarketEntry[];
}

const WALK_MS = 900;

export function initMarket(g: Game, recentDishes: string[]): MarketState {
  const rnd = g.rng.fork('dish');
  const dish = pickDish(() => rnd.next(), g.gs.avoidRecentDishes ? recentDishes : [], g.gs.dishBreadth);
  return { dish: dish.id, round: 0, carrying: new Map(), deliveries: [], used: new Map(), reveal: null, history: [] };
}

/** Personas que deben aportar en esta ronda: vivas y sin abandono definitivo. */
export function expected(g: Game): GPlayer[] {
  return [...g.players.values()].filter((p) => p.alive && !p.left);
}

/** Comienza una ronda de compra (la misma comida y el mismo impostor). */
export function startRound(g: Game) {
  const m = g.market!;
  m.round++;
  m.carrying.clear();
  m.deliveries = [];
  m.reveal = null;
  const spawns = g.map.spawn;
  let i = 0;
  for (const p of g.players.values()) {
    p.carrying = false;
    p.panel = null;
    p.sysPanel = null;
    p.timed = null;
    p.inputs = [];
    p.state = p.alive ? 'free' : 'ghost';
    const sp = spawns[i++ % spawns.length];
    const f = g.rt.nearestFree(sp.level, sp.x, sp.y, g.doorState);
    p.x = f.x; p.y = f.y; p.level = sp.level;
    p.dirtyPriv = true;
    g.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
    g.host.send(p.id, 'panel', null);
  }
  g.setPhaseMs('COMPRA', g.gs.shopTime * 1000);
  for (const p of g.players.values()) g.toast(p.id, m.round === 1 ? 'Empieza la compra: coge un ingrediente y entrégalo en caja.' : `Ronda ${m.round}: nueva compra con la misma comida.`, 'info');
}

function nearStation(g: Game, p: GPlayer, sid: string): boolean {
  const s = g.rt.stations.get(sid);
  if (!s || s.level !== p.level) return false;
  if (dist(p.x, p.y, s.x, s.y) > (s.range ?? 90) + 14) return false;
  return g.rt.los(p.level, p.x, p.y - 4, s.x, s.y - 4, g.doorState);
}

/** Abre el panel de una estantería o de la caja. */
export function marketUse(g: Game, p: GPlayer, sid: string): string | null {
  if (g.phase !== 'COMPRA') return 'La compra está cerrada.';
  if (!p.alive) return 'Los expulsados no compran.';
  if (p.state !== 'free') return 'Ya has entregado tu compra.';
  const s = g.rt.stations.get(sid);
  if (!s) return 'silencio';
  if (!nearStation(g, p, sid)) return 'Acércate a la cara accesible de la estantería.';
  const m = g.market!;
  if (s.kind === 'shelf') {
    const sh = g.map.market!.shelves.find((x) => x.station === sid);
    if (!sh) return 'silencio';
    p.sysPanel = { kind: 'shelf', station: sid };
    g.openPanel(p, { kind: 'shelf', station: sid, section: sh.section, products: sh.products, carrying: m.carrying.get(p.id) ?? null, used: m.used.get(p.id) ?? [] });
    return null;
  }
  if (s.kind === 'checkout') {
    const c = m.carrying.get(p.id);
    if (!c) return 'Primero coge un ingrediente de las estanterías.';
    p.sysPanel = { kind: 'checkout', station: sid };
    g.openPanel(p, { kind: 'checkout', station: sid, carrying: c });
    return null;
  }
  return 'silencio';
}

export function marketAction(g: Game, p: GPlayer, a: ClientAction): string | null {
  const m = g.market!;
  if (g.phase !== 'COMPRA') return 'La compra está cerrada.';
  if (!p.alive || p.left) return 'silencio';
  if (p.state !== 'free') return 'Ya has entregado tu compra.';
  if (a.k === 'pick') {
    const sid = String(a.st ?? ''), pid = String(a.product ?? '');
    const sh = g.map.market!.shelves.find((x) => x.station === sid);
    if (!sh || !nearStation(g, p, sid)) return 'Acércate a la estantería.';
    if (!sh.products.includes(pid) || !PRODUCT_BY_ID[pid]) return 'Ese producto no está en esta estantería.';
    if (m.carrying.has(p.id)) return 'Ya llevas un ingrediente: devuélvelo a su estantería para coger otro.';
    if ((m.used.get(p.id) ?? []).includes(pid)) return 'Ya aportaste ese ingrediente en una ronda anterior. Elige otro.';
    m.carrying.set(p.id, pid);
    p.carrying = true;
    p.dirtyPriv = true;
    p.anim = 'pick';
    p.pickUntil = g.now() + 500;
    p.sysPanel = null;
    g.host.send(p.id, 'panel', null);
    return null;
  }
  if (a.k === 'putback') {
    const sid = String(a.st ?? '');
    const c = m.carrying.get(p.id);
    if (!c) return 'No llevas nada.';
    const sh = g.map.market!.shelves.find((x) => x.station === sid);
    if (!sh || !nearStation(g, p, sid)) return 'Acércate a la estantería.';
    if (!sh.products.includes(c)) return `Devuélvelo a su sitio: ${PRODUCT_BY_ID[c]?.name ?? ''} no va en esta estantería.`;
    m.carrying.delete(p.id);
    p.carrying = false;
    p.dirtyPriv = true;
    p.pickUntil = g.now() + 500;
    p.sysPanel = null;
    g.host.send(p.id, 'panel', null);
    return null;
  }
  if (a.k === 'deliver') {
    const c = m.carrying.get(p.id);
    if (!c) return 'No llevas nada que entregar.';
    const sid = g.map.market!.checkout;
    if (!nearStation(g, p, sid)) return 'Tienes que estar en la zona de entrega de la caja.';
    if (g.phaseEnds !== null && g.now() > g.phaseEnds) return 'La caja ya ha cerrado.';
    m.deliveries.push({ pid: p.id, product: c, at: g.now() });
    m.carrying.delete(p.id);
    p.carrying = false;
    p.state = 'queue';
    p.sysPanel = null;
    g.host.send(p.id, 'panel', null);
    placeInQueue(g);
    p.dirtyPriv = true;
    g.dirtyPub = true;
    g.toast(p.id, 'Compra entregada en una bolsa sellada. Espera tu turno en la cola.', 'ok');
    return null;
  }
  return 'silencio';
}

/** Coloca a quienes ya entregaron en la cola, en orden de llegada. */
function placeInQueue(g: Game) {
  const q = g.map.market!.queue;
  g.market!.deliveries.forEach((d, i) => {
    const p = g.players.get(d.pid);
    if (!p) return;
    const pt = q[Math.min(i, q.length - 1)];
    p.x = pt.x; p.y = pt.y; p.facing = 1;
    g.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
  });
}

/** Cierra las elecciones y empieza la revelación uno a uno. */
function closeShopping(g: Game) {
  const m = g.market!;
  const exp = expected(g);
  const order: { pid: string; product: string | null }[] = m.deliveries.filter((d) => g.players.get(d.pid)?.alive).map((d) => ({ pid: d.pid, product: d.product }));
  for (const p of exp) if (!order.some((o) => o.pid === p.id)) order.push({ pid: p.id, product: null });
  // Lo que no se entregó vuelve a su estantería: nadie revela ni conserva un producto sin entregar.
  m.carrying.clear();
  const q = g.map.market!.queue;
  order.forEach((o, i) => {
    const p = g.players.get(o.pid)!;
    p.carrying = false;
    p.panel = null; p.sysPanel = null; p.timed = null; p.inputs = [];
    p.state = 'queue';
    const pt = q[Math.min(i, q.length - 1)];
    p.x = pt.x; p.y = pt.y; p.facing = 1;
    p.dirtyPriv = true;
    g.host.send(p.id, 'panel', null);
    g.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
  });
  const perMs = g.gs.revealTime * 1000;
  m.reveal = { order, startedAt: g.now(), perMs, shown: 0 };
  g.setPhaseMs('CAJA', order.length * perMs + 1200);
}

/** Avance del modo: cierre por tiempo o por entregas completas y caja uno a uno. */
export function marketTick(g: Game, now: number) {
  const m = g.market!;
  if (g.phase === 'COMPRA') {
    const exp = expected(g);
    const all = exp.length > 0 && exp.every((p) => m.deliveries.some((d) => d.pid === p.id));
    if (all || (g.phaseEnds !== null && now >= g.phaseEnds)) closeShopping(g);
    return;
  }
  if (g.phase === 'CAJA' && m.reveal) {
    const r = m.reveal;
    const t = now - r.startedAt;
    const idx = Math.floor(t / r.perMs);
    const scan = g.map.market!.scanPoint;
    const q = g.map.market!.queue;
    r.order.forEach((o, i) => {
      const p = g.players.get(o.pid);
      if (!p) return;
      let tx: number, ty: number;
      if (i < idx) { tx = scan.x + 200 + (i % 4) * 46; ty = scan.y + 130 + Math.floor(i / 4) * 40; }
      else if (i === idx) { tx = scan.x; ty = scan.y; }
      else { const pt = q[Math.min(i - idx - 1, q.length - 1)]; tx = pt.x; ty = pt.y; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const step = (230 / 30);
      if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; p.moving = true; p.facing = dx >= 0 ? 1 : -1; }
      else { p.x = tx; p.y = ty; p.moving = false; }
    });
    // Escaneo del aporte actual tras el paseo hasta la caja.
    while (r.shown < r.order.length && (r.shown < idx || (r.shown === idx && t - idx * r.perMs >= Math.min(WALK_MS, r.perMs * 0.5)))) {
      const o = r.order[r.shown];
      const p = g.players.get(o.pid)!;
      const entry: MarketEntry = { round: m.round, pid: o.pid, name: p.name, color: p.color, acc: p.acc, product: o.product, order: r.shown + 1 };
      m.history.push(entry);
      if (o.product) m.used.set(o.pid, [...(m.used.get(o.pid) ?? []), o.product]);
      r.shown++;
      p.dirtyPriv = true;
      g.dirtyPub = true;
      for (const v of g.players.values()) if (!v.left) g.event(v.id, { e: 'scan', entry });
    }
  }
}

/** Tras la caja: discusión y votación con temporizadores separados. */
export function afterReveal(g: Game) {
  const m = g.market!;
  m.reveal = null;
  for (const p of g.players.values()) { p.state = p.alive ? 'meeting' : 'ghost'; p.moving = false; p.saved = { x: p.x, y: p.y, level: p.level }; }
  g.meeting = { stage: 'discuss', caller: '', button: 'caja', votes: {}, stageEnds: 0 };
  g.setPhaseMs('DISCUSION', g.gs.discussionTime * 1000);
}

export function marketPublic(g: Game): MarketPublic {
  const m = g.market!;
  const r = m.reveal;
  const roundEntries = m.history.filter((h) => h.round === m.round);
  return {
    round: m.round,
    delivered: m.deliveries.map((d) => d.pid),
    expected: expected(g).map((p) => p.id),
    reveal: r ? { entries: roundEntries, current: Math.min(r.shown, r.order.length), startedAt: r.startedAt, perMs: r.perMs, total: r.order.length } : null,
    history: m.history,
  };
}

export function marketPrivate(g: Game, p: GPlayer): MarketPrivate {
  const m = g.market!;
  const isImp = p.team === 'impostor';
  const delivered = m.deliveries.some((d) => d.pid === p.id);
  let objective: string;
  if (!p.alive) objective = 'Estás fuera: observa y comenta en el chat de espectadores.';
  else if (isImp) objective = 'Deduce la comida observando las compras y disimula con tu ingrediente.';
  else objective = 'Elige un ingrediente que pegue con la comida, sin ponérselo fácil al impostor.';
  return {
    // El nombre del plato NUNCA se envía al impostor.
    dish: isImp ? null : DISH_BY_ID[m.dish]?.name ?? null,
    carrying: m.carrying.get(p.id) ?? null,
    delivered,
    used: m.used.get(p.id) ?? [],
    objective,
  };
}
