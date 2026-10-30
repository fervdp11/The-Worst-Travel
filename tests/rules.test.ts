import { describe, expect, it } from 'vitest';
import { getMap, getRuntime, MAP_IDS } from '../src/shared/maps';
import { validateMap } from '../src/shared/maps/validate';
import { MINIGAMES, taskMinigame } from '../src/shared/minigames';
import { Rng } from '../src/shared/rng';
import { IMPOSTOR_ROLES, ROLES, WORKER_ROLES } from '../src/shared/roles';
import { assignRoles, defaultSettings, presetSettings, sanitizeSettings, validateSettings } from '../src/shared/settings';
import { SKIP, tallyVotes } from '../src/shared/votes';
import { generateKnifeChain } from '../src/server/game/knife';
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
    const h = makeGame('ship', 4, (s) => {
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
  it.each(['ship', 'plane', 'market', 'lobby'] as const)('%s es accesible y coherente con todos los objetos colocados', (id) => {
    const rep = validateMap(getMap(id));
    expect(rep.errors).toEqual([]);
  });
  it('el plano es determinista (mismo resultado en cliente y servidor)', () => {
    for (const id of MAP_IDS) expect(JSON.stringify(getMap(id).walls)).toBe(JSON.stringify(getMap(id).walls));
  });
  it.each(['ship', 'plane', 'market', 'lobby'] as const)('%s tiene exactamente una planta transitable', (id) => {
    const m = getMap(id);
    expect(m.levels).toHaveLength(1);
    for (const s of m.stations) expect(s.level).toBe(m.levels[0].id);
    for (const p of m.props) expect(p.level).toBe(m.levels[0].id);
  });
  it('el tren ya no existe ni es seleccionable', () => {
    expect(MAP_IDS).toEqual(['ship', 'plane', 'market']);
    expect(MAP_IDS as string[]).not.toContain('train');
  });
  it.each(['ship', 'plane'] as const)('%s: requisitos mínimos de contenido del modo Viaje', (id) => {
    const m = getMap(id);
    expect(m.cameras).toHaveLength(4);
    expect(m.stations.filter((s) => s.kind === 'emergency')).toHaveLength(2);
    expect(m.sabotages.filter((s) => s.kind === 'critical')).toHaveLength(2);
    expect(m.sabotages.map((s) => s.kind)).toEqual(expect.arrayContaining(['lights', 'comms', 'doors']));
    expect(new Set(m.tasks.map((t) => t.type)).size).toBeGreaterThanOrEqual(8);
    expect(m.tasks.filter((t) => t.exclusive).length).toBeGreaterThanOrEqual(2);
    expect(m.vents.length).toBeGreaterThanOrEqual(5);
    expect(m.responsible).toBeTruthy();
    for (const t of m.tasks) t.stages.forEach((_, i) => expect(MINIGAMES[taskMinigame(t.type, i)]).toBeTruthy());
    for (const s of m.sabotages) for (const r of s.repair) expect(MINIGAMES[r.minigame]).toBeTruthy();
    for (const v of m.vents) for (const l of v.links) expect(m.vents.find((x) => x.id === l)?.links).toContain(v.id);
  });
  it('ningún texto de un vehículo pertenece a otro ni al tren', () => {
    const forbidden: Record<string, RegExp> = {
      ship: /conductor|piloto|tren|avión|vagón|locomotora|aterriz|descarril|techo|ferrocarril|raíles/i,
      plane: /conductor|capit|tren|barco|vagón|locomotora|naufrag|descarril|techo|ferrocarril|raíles/i,
    };
    for (const id of ['ship', 'plane'] as const) {
      const m = getMap(id);
      const texts = [...Object.values(m.texts), m.responsible!.title, ...m.sabotages.flatMap((s) => [s.name, s.failText ?? '', s.failTitle ?? '', ...s.repair.map((r) => r.label)]), ...m.levels.map((l) => l.name), m.knife!.docName, m.knife!.authName, ...m.tasks.flatMap((t) => t.stages.map((x) => x.label))].join(' | ');
      expect(texts, id).not.toMatch(forbidden[id]);
    }
  });
});

describe('cadena del cuchillo según dificultad', () => {
  it.each(['ship', 'plane'] as const)('%s: fácil 3, normal 5 y difícil 7 etapas reales, distintas y válidas', (id) => {
    const m = getMap(id);
    const rt = getRuntime(id);
    const seen = new Set<string>();
    for (const [stages, help, spread] of [[3, 1, 1], [5, 2, 2], [7, 3, 3], [4, 2, 1], [6, 3, 2]] as const) {
      for (let seed = 1; seed < 25; seed++) {
        const c = generateKnifeChain(new Rng(seed), m, rt, { stages, help, spread });
        expect(c.kinds).toHaveLength(stages);
        expect(c.stations).toHaveLength(stages);
        expect(new Set(c.stations).size).toBe(stages);
        expect(c.kinds[stages - 1]).toBe('auth');
        expect(c.kinds[stages - 2]).toBe('keypad');
        c.stations.forEach((s, i) => { expect(m.knife!.pools[c.kinds[i]]).toContain(s); expect(c.options[i]).toContain(s); expect(rt.stations.get(s)).toBeTruthy(); });
        if (help >= 3) expect(c.options.slice(0, -1).some((o) => o.length > 1)).toBe(true);
        expect(c.code).toHaveLength(4);
        seen.add(c.stations.join());
      }
    }
    expect(seen.size).toBeGreaterThan(3);
  });
  it('los presets cambian la cadena generada, no solo el texto', () => {
    const lens = (['facil', 'normal', 'dificil'] as const).map((d) => {
      const h = makeGame('ship', 4, (s) => { s.game.knifeDifficulty = d; });
      return h.game.knife!.kinds.length;
    });
    expect(lens).toEqual([3, 5, 7]);
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
    const h = makeGame('ship', 4);
    startExploration(h);
    h.advanceMs(31_000);
    const imp = [...h.game.players.values()].find((p) => p.team === 'impostor')!;
    imp.knife!.hasKnife = true; imp.knife!.authorized = true; imp.knife!.stage = h.game.knife!.kinds.length;
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
