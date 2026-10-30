import { describe, expect, it } from 'vitest';
import { getMap, MAP_IDS } from '../src/shared/maps';
import { validateMap } from '../src/shared/maps/validate';
import { MINIGAMES, taskMinigame } from '../src/shared/minigames';
import { Rng } from '../src/shared/rng';
import { IMPOSTOR_ROLES, ROLES, WORKER_ROLES } from '../src/shared/roles';
import { assignRoles, defaultSettings, presetSettings, sanitizeSettings, validateSettings } from '../src/shared/settings';
import { SKIP, tallyVotes } from '../src/shared/votes';
import { generateKnifeChain } from '../src/server/game/knife';
import { TRAIN, xs, xe } from '../src/shared/maps/train';
import { makeGame, startExploration } from './helpers';

describe('votos', () => {
  const alive = ['a', 'b', 'c', 'd'];
  it('expulsa solo con mayoría estricta sobre todas las opciones', () => {
    expect(tallyVotes({ a: 'b', c: 'b', d: 'a' }, alive, alive).ejected).toBe('b');
  });
  it('SALTAR con el máximo no expulsa', () => {
    const r = tallyVotes({ a: SKIP, b: SKIP, c: 'd' }, alive, alive);
    expect(r.ejected).toBeNull();
    expect(r.skipped).toBe(true);
  });
  it('empate en el máximo no expulsa (también con SALTAR)', () => {
    expect(tallyVotes({ a: 'b', b: 'a' }, alive, alive).tie).toBe(true);
    expect(tallyVotes({ a: 'b', b: SKIP }, alive, alive).ejected).toBeNull();
  });
  it('abstenerse no crea votos', () => {
    const r = tallyVotes({}, alive, alive);
    expect(r.ejected).toBeNull();
    expect(r.max).toBe(0);
  });
  it('ignora votos de no elegibles y objetivos inválidos', () => {
    const r = tallyVotes({ x: 'b', a: 'zzz', c: 'b' }, alive, alive);
    expect(r.counts.b).toBe(1);
    expect(r.ejected).toBe('b');
  });
});

describe('asignación de roles', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  it('siempre hay un único impostor y como máximo una especialidad por jugador', () => {
    for (let seed = 1; seed < 200; seed++) {
      const a = assignRoles(new Rng(seed), players, defaultSettings());
      expect(Object.values(a.team).filter((t) => t === 'impostor')).toHaveLength(1);
      for (const [pid, role] of Object.entries(a.roles)) {
        if (!role) continue;
        expect(a.team[pid] === 'impostor' ? IMPOSTOR_ROLES : WORKER_ROLES).toContain(role);
      }
    }
  });
  it('0 % excluye y el preset clásico no asigna especialidades', () => {
    const s = presetSettings('clasico');
    for (let seed = 1; seed < 50; seed++) {
      const a = assignRoles(new Rng(seed), players, s);
      expect(Object.values(a.roles).every((r) => r === null)).toBe(true);
    }
  });
  it('100 % garantiza la plaza y existe posibilidad real de no tener rol', () => {
    const s = presetSettings('clasico');
    s.roles.analista = { ...s.roles.analista, enabled: true, chance: 100, max: 2 };
    s.roles.espectro = { ...s.roles.espectro, enabled: true, chance: 100, max: 1 };
    for (let seed = 1; seed < 60; seed++) {
      const a = assignRoles(new Rng(seed), players, s);
      expect(Object.values(a.roles).filter((r) => r === 'analista')).toHaveLength(2);
      expect(a.roles[a.impostor]).toBe('espectro');
      expect(Object.values(a.roles).filter((r) => r === null).length).toBeGreaterThan(0);
    }
  });
  it('garantías incompatibles invalidan la configuración con explicación', () => {
    const s = presetSettings('clasico');
    s.roles.camuflador = { ...s.roles.camuflador, enabled: true, chance: 100, max: 1 };
    s.roles.senuelo = { ...s.roles.senuelo, enabled: true, chance: 100, max: 1 };
    const issues = validateSettings(s, 6);
    expect(issues.some((i) => i.field === 'roles.impostor')).toBe(true);
    const s2 = presetSettings('clasico');
    s2.roles.tecnico = { ...s2.roles.tecnico, enabled: true, chance: 100, max: 4 };
    expect(validateSettings(s2, 4).some((i) => i.field === 'roles.worker')).toBe(true);
    expect(validateSettings(s2, 8).length).toBe(0);
  });
  it('el servidor acota y normaliza ajustes recibidos', () => {
    const s = sanitizeSettings({ game: { playerSpeed: 99, discussionTime: -5, anonymousVotes: 'x' }, roles: { analista: { chance: 37, max: 50, params: { battery: 1000 } } } }, defaultSettings());
    expect(s.game.playerSpeed).toBe(1.5);
    expect(s.game.discussionTime).toBe(0);
    expect(s.game.anonymousVotes).toBe(true);
    expect(s.roles.analista.chance % 5).toBe(0);
    expect(s.roles.analista.max).toBeLessThanOrEqual(11);
    expect(s.roles.analista.params.battery).toBe(30);
  });
  it('los trece roles tienen nombres canónicos únicos', () => {
    expect(ROLES).toHaveLength(13);
    expect(new Set(ROLES.map((r) => r.name)).size).toBe(13);
    expect(WORKER_ROLES).toHaveLength(7);
    expect(IMPOSTOR_ROLES).toHaveLength(6);
  });
  it('cambiar duraciones en espera modifica la habilidad en la siguiente partida', () => {
    const h = makeGame('train', 4, (s) => {
      for (const r of ROLES) s.roles[r.id] = { ...s.roles[r.id], enabled: false, chance: 0 };
      s.roles.explorador = { ...s.roles.explorador, enabled: true, chance: 100, max: 3, params: { duration: 9, cooldown: 12, intensity: 40 } };
    });
    startExploration(h);
    const ex = [...h.game.players.values()].find((p) => p.role === 'explorador')!;
    const r = h.act(ex.id, { k: 'ability' });
    expect(r.ok, r.msg).toBe(true);
    expect(ex.speedBoostEndsGt - h.game.gt).toBeGreaterThan(8500);
    expect(h.game.speedOf(ex)).toBeCloseTo(190 * 1.4, 0);
  });
});

describe('planos maestros', () => {
  it.each(['train', 'ship', 'plane', 'lobby'] as const)('%s es accesible y coherente', (id) => {
    const rep = validateMap(getMap(id));
    expect(rep.errors).toEqual([]);
  });
  it('el plano es determinista (mismo resultado en cliente y servidor)', () => {
    for (const id of MAP_IDS) expect(JSON.stringify(getMap(id).walls)).toBe(JSON.stringify(getMap(id).walls));
  });
  it('el techo del tren coincide con la posición y anchura de los vagones', () => {
    const m = getMap('train');
    for (let i = 0; i < 9; i++) {
      const roof = m.rooms.find((r) => r.id === `r${i}`)!;
      expect(roof.rect.x).toBe(xs(i) + 12);
      expect(roof.rect.x + roof.rect.w).toBe(xe(i) - 12);
      expect(roof.rect.y + roof.rect.h).toBeLessThanOrEqual(TRAIN.MOD_W);
    }
    expect(m.ladders).toHaveLength(3);
  });
  it.each(MAP_IDS)('%s: escaleras con extremos emparejados en la misma X/Y', (id) => {
    for (const l of getMap(id).ladders) { expect(l.a.x).toBe(l.b.x); expect(l.a.y).toBe(l.b.y); expect(l.a.level).not.toBe(l.b.level); }
  });
  it('el avión solo conecta niveles por dos accesos de servicio', () => {
    expect(getMap('plane').ladders).toHaveLength(2);
    expect(getMap('ship').levels).toHaveLength(3);
  });
  it.each(MAP_IDS)('%s: requisitos mínimos de contenido', (id) => {
    const m = getMap(id);
    expect(m.cameras).toHaveLength(4);
    expect(m.stations.filter((s) => s.kind === 'emergency')).toHaveLength(2);
    expect(m.sabotages.filter((s) => s.kind === 'critical')).toHaveLength(2);
    expect(m.sabotages.map((s) => s.kind)).toEqual(expect.arrayContaining(['lights', 'comms', 'doors']));
    expect(new Set(m.tasks.map((t) => t.type)).size).toBeGreaterThanOrEqual(8);
    expect(m.tasks.filter((t) => t.exclusive).length).toBeGreaterThanOrEqual(3);
    expect(m.vents.length).toBeGreaterThanOrEqual(5);
    expect(m.responsible).toBeTruthy();
    for (const c of m.cameras) expect(m.levels.some((l) => l.id === c.level)).toBe(true);
    for (const t of m.tasks) t.stages.forEach((_, i) => expect(MINIGAMES[taskMinigame(t.type, i)]).toBeTruthy());
    for (const s of m.sabotages) for (const r of s.repair) expect(MINIGAMES[r.minigame]).toBeTruthy();
  });
  it('la tarea del techo es exclusiva del tren', () => {
    expect(getMap('train').tasks.some((t) => t.type === 'roof')).toBe(true);
    expect(getMap('ship').tasks.some((t) => t.type === 'roof')).toBe(false);
    expect(getMap('plane').tasks.some((t) => t.type === 'roof')).toBe(false);
  });
  it('ningún texto de un vehículo pertenece a otro', () => {
    const forbidden: Record<string, RegExp> = {
      train: /capit|piloto|barco|avión|cubierta|bodega|naufrag|aterriz/i,
      ship: /conductor|piloto|tren|avión|vagón|locomotora|aterriz|descarril/i,
      plane: /conductor|capit|tren|barco|vagón|locomotora|naufrag|descarril/i,
    };
    for (const id of MAP_IDS) {
      const m = getMap(id);
      const texts = [...Object.values(m.texts), m.responsible!.title, ...m.sabotages.flatMap((s) => [s.name, s.failText ?? '', s.failTitle ?? '', ...s.repair.map((r) => r.label)]), ...m.levels.map((l) => l.name), m.knife!.docName, m.knife!.authName, ...m.knife!.stages.map((s) => s.label)].join(' | ');
      expect(texts, id).not.toMatch(forbidden[id]);
    }
  });
});

describe('cadena del cuchillo', () => {
  it.each(MAP_IDS)('%s: cinco etapas variables, distintas y válidas', (id) => {
    const m = getMap(id);
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      for (const cx of [1, 2, 3]) {
        const c = generateKnifeChain(new Rng(seed), m, cx);
        expect(c.stations).toHaveLength(5);
        expect(new Set(c.stations).size).toBe(5);
        c.stations.forEach((s, i) => { expect(m.knife!.stages[i].stations).toContain(s); expect(c.options[i]).toContain(s); });
        expect(c.code).toBe(c.codeA + c.codeB);
        seen.add(c.stations.join());
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('resolución terminal', () => {
  it('tras confirmar una victoria se bloquean más acciones y no hay dos finales', () => {
    const h = makeGame('ship', 4);
    startExploration(h);
    const imp = [...h.game.players.values()].find((p) => p.team === 'impostor')!;
    h.game.endGame('workers', 'ejected', 'A', 'a', 'x');
    h.game.endGame('impostor', 'murder', 'B', 'b', 'y');
    expect(h.game.result?.title).toBe('A');
    const r = h.act(imp.id, { k: 'attack' });
    expect(r.ok).toBe(false);
    const ends = [...h.events.values()].flat().filter((e) => e.e === 'end');
    expect(ends.length).toBe(4);
  });
  it('no se puede convocar reunión durante un ataque confirmado; un botón válido lo interrumpe antes', () => {
    const h = makeGame('train', 4, (s) => { s.game.knifeComplexity = 1; });
    startExploration(h);
    h.advanceMs(31_000);
    const imp = [...h.game.players.values()].find((p) => p.team === 'impostor')!;
    imp.knife!.hasKnife = true; imp.knife!.authorized = true; imp.knife!.stage = 5;
    const r = h.game.responsible; r.waitUntil = Infinity;
    imp.level = r.level; const f = h.game.rt.nearestFree(r.level, r.x + 30, r.y); imp.x = f.x; imp.y = f.y;
    expect(h.act(imp.id, { k: 'attack' }).ok).toBe(true);
    const w = [...h.game.players.values()].find((p) => p.team === 'worker')!;
    const btn = h.game.rt.stations.get('btn1')!;
    w.level = btn.level; w.x = btn.x; w.y = btn.y;
    h.advanceMs(1000);
    expect(h.act(w.id, { k: 'use', st: 'btn1' }).ok).toBe(true);
    expect(h.game.responsible.alive).toBe(true);
    expect(h.game.phase).toBe('DISCUSION');
  });
});

describe('simulación independiente de FPS', () => {
  it('la velocidad por paso es fija y las diagonales no corren más', async () => {
    const { stepMove } = await import('../src/shared/movement');
    const { getRuntime } = await import('../src/shared/maps');
    const rt = getRuntime('lobby');
    const doors = { isClosed: () => false };
    const a = stepMove(rt, 'hall', 500, 450, 100, 0, 190, doors, false);
    const d = stepMove(rt, 'hall', 500, 450, 100, 100, 190, doors, false);
    const la = Math.hypot(a.x - 500, a.y - 450), ld = Math.hypot(d.x - 500, d.y - 450);
    expect(la).toBeCloseTo(190 / 30, 3);
    expect(ld).toBeCloseTo(la, 3);
  });
});
