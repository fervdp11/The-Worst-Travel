import { describe, expect, it } from 'vitest';
import { getMap, getRuntime, migrateMapId } from '../src/shared/maps';
import { propCollider, propOccluder, propVisualRect } from '../src/shared/maps/objects';
import { ALL_OPEN, PLAYER_RADIUS } from '../src/shared/maps/runtime';
import { DISHES, DISH_BY_ID, PRODUCTS } from '../src/shared/market';
import { stepMove } from '../src/shared/movement';
import { defaultSettings, taskTotals, validateSettings } from '../src/shared/settings';
import { pointInPolygon } from '../src/shared/geometry';
import { Room } from '../src/server/room/Room';
import { makeGame, startExploration, teleportTo, Harness } from './helpers';

const imp = (h: Harness) => [...h.game.players.values()].find((p) => p.team === 'impostor')!;
const workers = (h: Harness) => [...h.game.players.values()].filter((p) => p.team === 'worker');

/** Coloca a un jugador junto a una estantería que contenga el producto y lo coge. */
function pick(h: Harness, pid: string, product: string) {
  const sh = h.game.map.market!.shelves.find((s) => s.products.includes(product))!;
  teleportTo(h, pid, sh.station);
  return h.act(pid, { k: 'pick', st: sh.station, product });
}
function deliver(h: Harness, pid: string) {
  teleportTo(h, pid, 'checkout');
  return h.act(pid, { k: 'deliver', st: 'checkout' });
}
function untilPhase(h: Harness, phase: string, maxMs = 400_000) {
  for (let t = 0; t < maxMs && h.game.phase !== phase && !h.game.ended; t += 100) h.advanceMs(100);
}

describe('objetos: una definición, cuatro sistemas', () => {
  it.each(['ship', 'plane', 'market', 'lobby'] as const)('%s: ninguna sombra genera colisión; los muebles sólidos tienen collider dentro de su caja visual', (id) => {
    const m = getMap(id);
    for (const p of m.props) {
      const c = propCollider(p);
      if (!p.solid || p.flat) { expect(c).toBeNull(); continue; }
      if (!c) continue;
      const v = propVisualRect(p);
      expect(c.x).toBeGreaterThanOrEqual(v.x - 0.01);
      expect(c.y).toBeGreaterThanOrEqual(v.y - 0.01);
      expect(c.x + c.w).toBeLessThanOrEqual(v.x + v.w + 0.01);
      expect(c.y + c.h).toBeLessThanOrEqual(v.y + v.h + 0.01);
    }
  });
  it('el jugador no se mete en una estantería desde ningún lado ni en diagonal', () => {
    const rt = getRuntime('market');
    const shelf = getMap('market').props.find((p) => p.kind === 'marketShelf')!;
    const col = propCollider(shelf)!;
    const cx = col.x + col.w / 2, cy = col.y + col.h / 2;
    const starts = [[cx, col.y - 60], [cx, col.y + col.h + 60], [col.x - 60, cy], [col.x + col.w + 60, cy], [col.x - 50, col.y - 50], [col.x + col.w + 50, col.y + col.h + 50]];
    for (const [sx, sy] of starts) {
      let x = sx, y = sy;
      const dx = Math.sign(cx - sx) * 100, dy = Math.sign(cy - sy) * 100;
      for (let i = 0; i < 120; i++) { const r = stepMove(rt, 'store', x, y, dx, dy, 300, ALL_OPEN, false); x = r.x; y = r.y; }
      const nx = Math.max(col.x, Math.min(x, col.x + col.w)), ny = Math.max(col.y, Math.min(y, col.y + col.h));
      expect(Math.hypot(x - nx, y - ny)).toBeGreaterThanOrEqual(PLAYER_RADIUS - 0.5);
    }
  });
  it('las estanterías altas bloquean la visión; las sombras y objetos bajos no', () => {
    const m = getMap('market');
    const shelf = m.props.find((p) => p.kind === 'marketShelf')!;
    expect(propOccluder(shelf)).toBeTruthy();
    const rt = getRuntime('market');
    const r = shelf.rect;
    expect(rt.los('store', r.x + r.w / 2, r.y - 100, r.x + r.w / 2, r.y + r.h + 100, ALL_OPEN)).toBe(false);
    const bench = getMap('lobby').props.find((p) => p.kind === 'bench')!;
    expect(propOccluder(bench)).toBeNull();
  });
});

describe('visión exacta', () => {
  it('el polígono no revela lo que hay detrás de un muro y sus aristas siguen al muro', () => {
    const rt = getRuntime('ship');
    // Desde el pasillo central, la sala de máquinas (detrás del muro sur) no es visible salvo por su puerta.
    const poly = rt.visibility('deck', 1500, 561, 600, ALL_OPEN);
    const pts = []; for (let i = 0; i < poly.length; i += 2) pts.push({ x: poly[i], y: poly[i + 1] });
    expect(pointInPolygon(1300, 800, pts)).toBe(false); // baños, tras el muro
    expect(pointInPolygon(1600, 561, pts)).toBe(true);
    // A través del hueco de la puerta de los baños sí se ve el interior alineado con la puerta.
    const poly2 = rt.visibility('deck', 1294, 561, 600, ALL_OPEN);
    const pts2 = []; for (let i = 0; i < poly2.length; i += 2) pts2.push({ x: poly2[i], y: poly2[i + 1] });
    expect(pointInPolygon(1294, 800, pts2)).toBe(true);
    expect(pointInPolygon(1700, 800, pts2)).toBe(false); // seguridad, tras el muro
  });
});

describe('Supermercado: catálogos', () => {
  it('100 comidas únicas, generales y sin rellenos impuestos', () => {
    expect(DISHES).toHaveLength(100);
    expect(new Set(DISHES.map((d) => d.name)).size).toBe(100);
    expect(new Set(DISHES.map((d) => d.id)).size).toBe(100);
    const names = DISHES.map((d) => d.name);
    for (const n of ['Macarrones', 'Pizza', 'Croquetas', 'Lasaña', 'Kebab', 'Crepes', 'Bocadillo']) expect(names).toContain(n);
    for (const bad of ['Macarrones con queso', 'Pizza margarita', 'Croquetas de jamón', 'Lasaña boloñesa', 'Kebab de pollo', 'Crepes de chocolate']) expect(names).not.toContain(bad);
    expect(DISH_BY_ID.d001.name).toBe('Macarrones');
  });
  it('al menos 100 productos distintos, todos colocados en una estantería', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    expect(new Set(PRODUCTS.map((p) => p.name)).size).toBe(PRODUCTS.length);
    const placed = new Set(getMap('market').market!.shelves.flatMap((s) => s.products));
    for (const p of PRODUCTS) expect(placed.has(p.id), p.id).toBe(true);
  });
});

describe('Supermercado: privacidad y reglas', () => {
  it('todos los trabajadores reciben el mismo nombre; el impostor nunca recibe la comida', () => {
    const h = makeGame('market', 6);
    startExploration(h);
    expect(h.game.phase).toBe('COMPRA');
    const dish = DISH_BY_ID[h.game.market!.dish].name;
    const names = new Set(workers(h).map((w) => h.priv.get(w.id)!.market!.dish));
    expect([...names]).toEqual([dish]);
    const i = imp(h);
    expect(h.priv.get(i.id)!.market!.dish).toBeNull();
    // Ningún mensaje enviado al impostor contiene el nombre ni el ID del plato.
    const toImp = JSON.stringify(h.sent.filter((s) => s.pid === i.id).map((s) => s.data));
    expect(toImp.includes(dish)).toBe(false);
    expect(toImp.includes(h.game.market!.dish)).toBe(false);
    // En el supermercado nadie tiene especialidades.
    for (const p of h.game.players.values()) expect(p.role).toBeNull();
  });

  it('coger, devolver y entregar con autoridad del servidor; los demás solo ven una bolsa', () => {
    const h = makeGame('market', 4);
    startExploration(h);
    const [a, b] = workers(h);
    expect(pick(h, a.id, 'tomate').ok).toBe(true);
    expect(pick(h, a.id, 'pimienta').ok).toBe(false); // solo uno a la vez
    // Devolver en una estantería que no es la suya falla
    const wrong = h.game.map.market!.shelves.find((s) => !s.products.includes('tomate'))!;
    teleportTo(h, a.id, wrong.station);
    expect(h.act(a.id, { k: 'putback', st: wrong.station }).ok).toBe(false);
    const right = h.game.map.market!.shelves.find((s) => s.products.includes('tomate'))!;
    teleportTo(h, a.id, right.station);
    expect(h.act(a.id, { k: 'putback', st: right.station }).ok).toBe(true);
    expect(pick(h, a.id, 'pimienta').ok).toBe(true);
    // Recoger desde lejos o entregar lejos de la caja no se acepta
    teleportTo(h, b.id, 'checkout');
    expect(h.act(b.id, { k: 'pick', st: right.station, product: 'tomate' }).ok).toBe(false);
    teleportTo(h, a.id, right.station);
    expect(h.act(a.id, { k: 'deliver', st: 'checkout' }).ok).toBe(false);
    // Snapshot ajeno: bolsa cerrada, nunca el producto
    h.advanceMs(200);
    const snapsB = h.sent.filter((s) => s.pid === b.id && s.ev === 'snap').map((s) => JSON.stringify(s.data));
    expect(snapsB.some((x) => x.includes('pimienta'))).toBe(false);
    expect(deliver(h, a.id).ok).toBe(true);
    expect(a.state).toBe('queue');
    expect(pick(h, a.id, 'sal').ok).toBe(false); // elección bloqueada
    // Antes del cierre nadie recibe el producto entregado
    const pubs = h.sent.filter((s) => s.ev === 'pub').map((s) => JSON.stringify(s.data));
    expect(pubs.some((x) => x.includes('pimienta'))).toBe(false);
  });

  it('cierre por tiempo: SIN APORTE sin expulsión automática, revelación uno a uno con historial', () => {
    const h = makeGame('market', 4, (s) => { s.game.shopTime = 30; s.game.revealTime = 2; });
    startExploration(h);
    const [a, b] = workers(h);
    pick(h, a.id, 'arroz'); deliver(h, a.id);
    pick(h, b.id, 'pollo'); deliver(h, b.id);
    h.advanceMs(30_500);
    expect(h.game.phase).toBe('CAJA');
    untilPhase(h, 'DISCUSION', 30_000);
    const hist = h.game.market!.history;
    expect(hist).toHaveLength(4);
    expect(hist[0].pid).toBe(a.id);
    expect(hist[0].product).toBe('arroz');
    expect(hist.filter((e) => e.product === null)).toHaveLength(2);
    for (const p of h.game.players.values()) expect(p.alive).toBe(true);
  });

  it('expulsar a un inocente mantiene la comida y el impostor; no se repite el propio aporte', () => {
    const h = makeGame('market', 5, (s) => { s.game.discussionTime = 0; });
    startExploration(h);
    const dish = h.game.market!.dish;
    const i = imp(h);
    const ws = workers(h);
    for (const p of h.game.players.values()) { pick(h, p.id, p === i ? 'leche' : 'tomate'); deliver(h, p.id); }
    h.advanceMs(200);
    expect(h.game.phase).toBe('CAJA');
    untilPhase(h, 'VOTACION', 60_000);
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: ws[0].id });
    untilPhase(h, 'EXPULSION', 20_000);
    expect(h.game.meeting?.results?.ejected).toBe(ws[0].id);
    untilPhase(h, 'COMPRA', 20_000);
    expect(h.game.market!.round).toBe(2);
    expect(h.game.market!.dish).toBe(dish);
    expect(imp(h).id).toBe(i.id);
    // No puede repetir su propio ingrediente; otra persona sí puede coger el mismo tipo
    expect(pick(h, ws[1].id, 'tomate').ok).toBe(false);
    expect(pick(h, i.id, 'tomate').ok).toBe(true);
    // El expulsado no compra ni se le espera
    expect(pick(h, ws[0].id, 'sal').ok).toBe(false);
    expect(h.pub!.market!.expected).not.toContain(ws[0].id);
  });

  it('empate o salto: nueva compra con el mismo plato; expulsar al impostor termina', () => {
    const h = makeGame('market', 4, (s) => { s.game.discussionTime = 0; });
    startExploration(h);
    for (const p of h.game.players.values()) { pick(h, p.id, 'sal'); deliver(h, p.id); }
    untilPhase(h, 'VOTACION', 60_000);
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: 'skip' });
    untilPhase(h, 'EXPULSION', 20_000);
    expect(h.game.meeting?.results?.cause).toBe('skip');
    expect(h.game.meeting?.results?.ejected).toBeNull();
    untilPhase(h, 'COMPRA', 20_000);
    expect(h.game.market!.round).toBe(2);
    for (const p of h.game.players.values()) { pick(h, p.id, 'azucar'); deliver(h, p.id); }
    untilPhase(h, 'VOTACION', 60_000);
    const i = imp(h);
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: i.id });
    untilPhase(h, 'FINAL', 30_000);
    expect(h.game.result?.winner).toBe('workers');
    expect(h.game.result?.cause).toBe('ejected');
  });

  it('cierre exclusivo del súper: si solo quedan el impostor y una persona, gana el impostor', () => {
    const h = makeGame('market', 4, (s) => { s.game.discussionTime = 0; });
    startExploration(h);
    const ws = workers(h);
    ws[1].alive = false; ws[1].state = 'ghost';
    for (const p of h.game.alive()) { pick(h, p.id, 'pan_barra'); deliver(h, p.id); }
    untilPhase(h, 'VOTACION', 60_000);
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: ws[0].id });
    untilPhase(h, 'FINAL', 30_000);
    expect(h.game.result?.winner).toBe('impostor');
    expect(h.game.result?.cause).toBe('pair');
  });

  it('el abandono definitivo del impostor da la victoria a los trabajadores', () => {
    const h = makeGame('market', 4);
    startExploration(h);
    h.game.onLeave(imp(h).id);
    expect(h.game.result?.cause).toBe('abandon');
  });
});

describe('trampillas con flechas', () => {
  it('flechas solo hacia las conexiones reales, sin nombres; una petición por transición', () => {
    const h = makeGame('ship', 4);
    startExploration(h);
    h.advanceMs(31_000);
    const i = imp(h);
    teleportTo(h, i.id, 'v_salon');
    expect(h.act(i.id, { k: 'use', st: 'v_salon' }).ok).toBe(true);
    h.advanceMs(600);
    const pan = h.panels.get(i.id)!;
    if (pan.kind !== 'vent') throw new Error('sin panel de trampilla');
    const links = getMap('ship').vents.find((v) => v.id === 'v_salon')!.links;
    expect(pan.arrows).toHaveLength(links.length);
    expect(JSON.stringify(pan)).not.toMatch(/Trampilla|v_radio|v_cocina/);
    expect(h.act(i.id, { k: 'vent', to: pan.arrows[0].id }).ok).toBe(true);
    // Repetición mientras viaja: se descarta
    expect(h.act(i.id, { k: 'vent', to: pan.arrows[0].id }).ok).toBe(false);
    h.advanceMs(700);
    expect(i.state).toBe('vent');
    expect(['v_radio', 'v_cocina']).toContain(i.vent!.id);
    // No sale sola: sigue dentro hasta pulsar SALIR
    h.advanceMs(1000);
    expect(i.state).toBe('vent');
    expect(h.act(i.id, { k: 'vent', exit: true }).ok).toBe(true);
    h.advanceMs(600);
    expect(i.state).toBe('free');
    expect(h.game.rt.collides(i.level, i.x, i.y, PLAYER_RADIUS, h.game.doorState)).toBe(false);
  });
});

describe('temporizadores y resultados', () => {
  it('el plazo de fase es absoluto: una reconexión no lo reinicia', () => {
    const h = makeGame('market', 4);
    startExploration(h);
    const end = h.game.phaseEnds;
    h.advanceMs(5000);
    h.game.onDisconnect('p1');
    h.game.onReconnect('p1');
    expect(h.game.phaseEnds).toBe(end);
  });
  it('no se puede votar tras el cierre y siempre hay secuencia de resultados (también vacía)', () => {
    const h = makeGame('ship', 4);
    startExploration(h);
    h.advanceMs(31_000);
    const w = workers(h)[0];
    teleportTo(h, w.id, 'btn1');
    expect(h.act(w.id, { k: 'use', st: 'btn1' }).ok).toBe(true);
    untilPhase(h, 'VOTACION', 120_000);
    untilPhase(h, 'RESULTADOS', 200_000);
    expect(h.act(w.id, { k: 'vote', target: 'skip' }).ok).toBe(false);
    expect(h.game.meeting?.results?.cause).toBe('novotes');
    expect(h.game.meeting?.results?.rid).toBeTruthy();
    untilPhase(h, 'EXPULSION', 20_000);
    expect(h.game.phase).toBe('EXPULSION');
    untilPhase(h, 'EXPLORACION', 20_000);
    expect(h.game.phase).toBe('EXPLORACION');
  });
});

describe('ajustes por modo', () => {
  it('cantidad de tareas por trabajador y totales coherentes; cero tareas bloquea', () => {
    const s = defaultSettings();
    s.game.shortTasks = 3; s.game.longTasks = 1;
    expect(taskTotals(s.game, 6)).toEqual({ perWorker: 4, workers: 5, total: 20 });
    const h = makeGame('ship', 6, (x) => { x.game.shortTasks = 2; x.game.longTasks = 2; });
    for (const p of workers(h)) expect(p.tasks).toHaveLength(4);
    expect(h.game.taskTotals().total).toBe(20);
    s.game.shortTasks = 0; s.game.longTasks = 0;
    expect(validateSettings(s, 4, getMap('ship')).some((i) => i.field === 'game.shortTasks')).toBe(true);
  });
  it('cambiar de modo elige un mapa válido; mapas inexistentes o del tren se rechazan o migran', () => {
    const r = new Room('TEST1', false, { mapId: 'ship', maxPlayers: 8, preset: 'equilibrado' }, () => {});
    r.hostId = 'h';
    try {
      expect(r.onSettings('h', null, undefined, 'market')).toBeNull();
      expect(r.mapId).toBe('market');
      expect(r.settings.mode).toBe('market');
      expect(r.onSettings('h', null, 'ship' as never)).toBe('Ese mapa no pertenece al modo elegido.');
      expect(r.onSettings('h', null, 'train' as never)).toBe('Mapa desconocido.');
      expect(r.onSettings('h', null, undefined, 'travel')).toBeNull();
      expect(r.mapId).toBe('ship');
      expect(migrateMapId('train')).toBe('ship');
    } finally { r.destroy(); }
  });
  it('cambiar el tiempo de compra en la sala afecta al siguiente inicio real', () => {
    const h = makeGame('market', 4, (s) => { s.game.shopTime = 45; });
    startExploration(h);
    expect(Math.round((h.game.phaseEnds! - h.now.t) / 1000)).toBe(45);
  });
});
