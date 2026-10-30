import { describe, expect, it } from 'vitest';
import { MINIGAMES } from '../src/shared/minigames';
import type { MapId } from '../src/shared/maps/types';
import { makeGame, startExploration, teleportTo, Harness } from './helpers';
import { solve } from './solver';

const MAPS: MapId[] = ['ship', 'plane'];

function openAndSolve(h: Harness, pid: string, station: string) {
  teleportTo(h, pid, station);
  const r = h.act(pid, { k: 'use', st: station });
  expect(r.ok, `${station}: ${r.msg}`).toBe(true);
  const pan = h.panels.get(pid);
  if (!pan || pan.kind !== 'minigame') throw new Error(`Sin minijuego en ${station}: ${JSON.stringify(pan)}`);
  const def = MINIGAMES[pan.mg];
  for (let part = pan.part; part < def.parts; part++) {
    h.advanceMs(def.minMs[part] + 200);
    const secret = pan.mg === 'k_keypad' ? h.game.knife!.code : undefined;
    const ans = solve(pan.mg, pan.puzzle, part, secret);
    h.act(pid, { k: 'step', ref: pan.ref, part, ans });
  }
  return pan;
}

function worker(h: Harness) {
  return [...h.game.players.values()].find((p) => p.team === 'worker')!;
}
function impostor(h: Harness) {
  return [...h.game.players.values()].find((p) => p.team === 'impostor')!;
}

describe.each(MAPS)('partida completa en %s', (mapId) => {
  it('asigna un único impostor y tareas finitas', () => {
    const h = makeGame(mapId, 8);
    const imps = [...h.game.players.values()].filter((p) => p.team === 'impostor');
    expect(imps).toHaveLength(1);
    for (const p of h.game.players.values()) {
      expect(p.tasks.length).toBe(h.game.gs.shortTasks + h.game.gs.longTasks);
      expect(p.tasks.every((t) => t.fake === (p.team === 'impostor'))).toBe(true);
    }
  });

  it('los trabajadores ganan completando tareas y llegando a destino', () => {
    const h = makeGame(mapId, 4);
    startExploration(h);
    expect(h.game.phase).toBe('EXPLORACION');
    for (const p of [...h.game.players.values()].filter((x) => x.team === 'worker')) {
      for (const t of p.tasks) {
        while (!t.done) openAndSolve(h, p.id, t.stations[t.stage]);
      }
    }
    const tot = h.game.taskTotals();
    expect(tot.done).toBe(tot.total);
    h.advanceMs(h.game.gs.arrivalTime * 1000 + 500);
    expect(h.game.result?.winner).toBe('workers');
    expect(h.game.result?.cause).toBe('tasks');
  });

  it('el impostor aparenta tareas sin sumar progreso', () => {
    const h = makeGame(mapId, 4);
    startExploration(h);
    const imp = impostor(h);
    const t = imp.tasks[0];
    while (!t.done) openAndSolve(h, imp.id, t.stations[t.stage]);
    expect(h.game.taskTotals().done).toBe(0);
  });

  it('una tarea cuenta una sola vez aunque se repitan mensajes', () => {
    const h = makeGame(mapId, 4);
    startExploration(h);
    const w = worker(h);
    const t = w.tasks.find((x) => x.slot.stages.length === 1 && MINIGAMES[x.slot.type]?.parts === 1)!;
    teleportTo(h, w.id, t.stations[0]);
    h.act(w.id, { k: 'use', st: t.stations[0] });
    const pan = h.panels.get(w.id)!;
    if (pan.kind !== 'minigame') throw new Error('sin panel');
    h.advanceMs(4000);
    const ans = solve(pan.mg, pan.puzzle, 0);
    h.game.onAction(w.id, { k: 'step', ref: pan.ref, part: 0, ans, id: 'dup1' });
    h.game.onAction(w.id, { k: 'step', ref: pan.ref, part: 0, ans, id: 'dup1' });
    h.game.onAction(w.id, { k: 'step', ref: pan.ref, part: 0, ans, id: 'dup2' });
    expect(h.game.taskTotals().done).toBe(1);
  });

  it('un crítico se repara con un solo trabajador y no permite reuniones', () => {
    const h = makeGame(mapId, 4);
    startExploration(h);
    h.advanceMs(h.game.gs.sabotageGrace * 1000 + 100);
    const imp = impostor(h);
    const crit = h.game.map.sabotages.find((s) => s.kind === 'critical')!;
    teleportTo(h, imp.id, crit.activation[0]);
    const r = h.act(imp.id, { k: 'sabotage', st: crit.activation[0] });
    expect(r.ok, r.msg).toBe(true);
    h.advanceMs(h.game.gs.sabotagePrep * 1000 + 100);
    expect(h.game.sabotage?.id).toBe(crit.id);
    const w = worker(h);
    const btn = h.game.map.stations.find((s) => s.kind === 'emergency')!;
    teleportTo(h, w.id, btn.id);
    expect(h.act(w.id, { k: 'use', st: btn.id }).ok).toBe(false);
    for (const step of crit.repair) openAndSolve(h, w.id, step.stations[0]);
    expect(h.game.sabotage).toBeNull();
    expect(h.game.ended).toBe(false);
  });

  it('el impostor gana si se agota el plazo del crítico', () => {
    const h = makeGame(mapId, 4);
    startExploration(h);
    h.advanceMs(h.game.gs.sabotageGrace * 1000 + 100);
    const imp = impostor(h);
    const crit = h.game.map.sabotages.filter((s) => s.kind === 'critical')[1];
    teleportTo(h, imp.id, crit.activation[0]);
    expect(h.act(imp.id, { k: 'sabotage', st: crit.activation[0] }).ok).toBe(true);
    h.advanceMs(h.game.gs.sabotagePrep * 1000 + h.game.critTimeMs() + 500);
    expect(h.game.result?.winner).toBe('impostor');
    expect(h.game.result?.cause).toBe('critical');
    expect(h.game.result?.title).toBe(crit.failTitle);
  });

  it('cadena del cuchillo protegida por prerrequisitos y ataque final', () => {
    const h = makeGame(mapId, 4, (s) => { s.game.knifeDifficulty = 'personalizada'; s.game.knifeStages = 5; s.game.knifeHelp = 1; });
    startExploration(h);
    const imp = impostor(h);
    const chain = h.game.knife!;
    expect(chain.kinds).toHaveLength(5);
    // No se puede atacar sin arma.
    expect(h.act(imp.id, { k: 'attack' }).ok).toBe(false);
    // Saltarse etapas: la estación del contenedor no responde antes de tiempo.
    teleportTo(h, imp.id, chain.stations[3]);
    expect(h.act(imp.id, { k: 'use', st: chain.stations[3] }).ok).toBe(false);
    for (let k = 0; k < chain.kinds.length; k++) openAndSolve(h, imp.id, chain.stations[k]);
    expect(imp.knife!.hasKnife).toBe(true);
    expect(imp.knife!.authorized).toBe(true);
    const r = h.game.responsible;
    imp.level = r.level;
    const f = h.game.rt.nearestFree(r.level, r.x + 30, r.y);
    imp.x = f.x; imp.y = f.y;
    h.game.responsible.waitUntil = Infinity;
    const res = h.act(imp.id, { k: 'attack' });
    expect(res.ok, res.msg).toBe(true);
    h.advanceMs(h.game.gs.attackDuration * 1000 + 200);
    expect(h.game.result?.cause).toBe('murder');
    expect(h.game.result?.winner).toBe('impostor');
  });
});

describe('reuniones y votos', () => {
  it('expulsar a un trabajador continúa; expulsar al impostor termina', () => {
    const h = makeGame('ship', 5);
    startExploration(h);
    h.advanceMs(31000);
    const w = worker(h);
    teleportTo(h, w.id, 'btn2');
    expect(h.act(w.id, { k: 'use', st: 'btn2' }).ok).toBe(true);
    expect(h.game.phase).toBe('DISCUSION');
    h.advanceMs(3000 + h.game.gs.discussionTime * 1000 + 100);
    expect(h.game.phase).toBe('VOTACION');
    const target = [...h.game.players.values()].find((p) => p.team === 'worker' && p !== w)!;
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: target.id });
    h.advanceMs(1500);
    expect(h.game.phase).toBe('RESULTADOS');
    h.advanceMs(6000);
    expect(h.game.phase).toBe('EXPULSION');
    h.advanceMs(7200);
    expect(h.game.phase).toBe('EXPLORACION');
    expect(target.alive).toBe(false);
    expect(w.meetingsLeft).toBe(0);
    // Límite de reuniones por persona
    h.advanceMs(31000);
    teleportTo(h, w.id, 'btn2');
    expect(h.act(w.id, { k: 'use', st: 'btn2' }).ok).toBe(false);
    // Otro convoca y se expulsa al impostor
    const other = h.game.alive().find((p) => p.team === 'worker' && p !== w)!;
    teleportTo(h, other.id, 'btn1');
    expect(h.act(other.id, { k: 'use', st: 'btn1' }).ok).toBe(true);
    h.advanceMs(3000 + h.game.gs.discussionTime * 1000 + 100);
    const imp = impostor(h);
    for (const p of h.game.alive()) h.act(p.id, { k: 'vote', target: imp.id });
    h.advanceMs(1500 + 6000 + 7200);
    expect(h.game.result?.winner).toBe('workers');
    expect(h.game.result?.cause).toBe('ejected');
  });

  it('los expulsados pueden terminar tareas pero no votar ni convocar', () => {
    const h = makeGame('ship', 4);
    startExploration(h);
    const w = worker(h);
    w.alive = false;
    w.state = 'ghost';
    const t = w.tasks.find((x) => x.slot.type !== 'orders')!;
    while (!t.done) openAndSolve(h, w.id, t.stations[t.stage]);
    expect(t.done).toBe(true);
    teleportTo(h, w.id, 'btn1');
    expect(h.act(w.id, { k: 'use', st: 'btn1' }).ok).toBe(false);
  });

  it('una reunión saca de taquillas y trampillas a posiciones válidas', () => {
    const h = makeGame('ship', 4);
    startExploration(h);
    h.advanceMs(31000);
    const imp = impostor(h);
    teleportTo(h, imp.id, 'v_salon');
    expect(h.act(imp.id, { k: 'use', st: 'v_salon' }).ok).toBe(true);
    h.advanceMs(600);
    expect(imp.state).toBe('vent');
    const w = worker(h);
    teleportTo(h, w.id, 'locker_pers');
    expect(h.act(w.id, { k: 'use', st: 'locker_pers' }).ok).toBe(true);
    h.advanceMs(600);
    expect(w.state).toBe('locker');
    const caller = h.game.alive().find((p) => p !== imp && p !== w)!;
    teleportTo(h, caller.id, 'btn2');
    expect(h.act(caller.id, { k: 'use', st: 'btn2' }).ok).toBe(true);
    expect(imp.vent).toBeNull();
    expect(w.locker).toBeNull();
    expect(h.game.rt.collides(imp.level, imp.x, imp.y, 11, h.game.doorState)).toBe(false);
    expect(h.game.rt.collides(w.level, w.x, w.y, 11, h.game.doorState)).toBe(false);
  });
});

describe('desconexiones', () => {
  it('el abandono del impostor da la victoria a los trabajadores', () => {
    const h = makeGame('plane', 4);
    startExploration(h);
    const imp = impostor(h);
    h.game.onDisconnect(imp.id);
    h.advanceMs(31000);
    expect(h.game.result?.cause).toBe('abandon');
  });

  it('las tareas de quien abandona se reasignan sin regalar la victoria', () => {
    const h = makeGame('plane', 5);
    startExploration(h);
    const w = worker(h);
    const before = h.game.taskTotals();
    h.game.onLeave(w.id);
    const after = h.game.taskTotals();
    expect(after.total).toBe(before.total);
    expect(after.done).toBe(0);
    expect(h.game.ended).toBe(false);
  });
});
