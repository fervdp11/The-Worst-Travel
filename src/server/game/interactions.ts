import { ATTACK_RANGE, LADDER_MS, LOCKER_ANIM_MS, USE_RANGE, VENT_ANIM_MS, VENT_MOVE_MS } from '../../shared/constants';
import { dist } from '../../shared/geometry';
import { MINIGAMES, taskMinigame } from '../../shared/minigames';
import type { ClientAction, PanelOpen } from '../../shared/protocol';
import type { MapId } from '../../shared/maps/types';
import { abilityRoleParam, analystOnTaskDone } from './abilities';
import type { Game } from './Game';
import { KNIFE_MINIGAMES } from './knife';
import type { GPlayer, TaskInst } from './types';
import { occupancy } from './visibility';

export function stationLabel(g: Game, id: string): string {
  return g.rt.stations.get(id)?.name ?? id;
}

function busy(p: GPlayer) {
  return !!p.timed || !!p.panel || (p.state !== 'free' && p.state !== 'ghost');
}

function inRange(g: Game, p: GPlayer, sid: string, extra = 14): boolean {
  const s = g.rt.stations.get(sid);
  if (!s || s.level !== p.level) return false;
  if (dist(p.x, p.y, s.x, s.y) > (s.range ?? USE_RANGE) + extra) return false;
  return !p.alive || g.rt.los(p.level, p.x, p.y - 4, s.x, s.y - 4, g.doorState);
}

export function handleAction(g: Game, p: GPlayer, a: ClientAction): string | null {
  switch (a.k) {
    case 'use': return use(g, p, String(a.st ?? ''));
    case 'sabotage': return startSabotage(g, p, String(a.st ?? ''), a.opt);
    case 'step': return step(g, p, a.ref, a.part, a.ans);
    case 'close': return closeAll(g, p);
    case 'vent': return ventAction(g, p, a);
    case 'attack': return attack(g, p);
    case 'cam': return selectCam(g, p, String(a.cam ?? ''));
    case 'occ': return occLevel(g, p, String(a.level ?? ''));
    case 'leaveLocker': return leaveLocker(g, p);
    default: return 'Acción desconocida';
  }
}

// ------------------------------------------------------------------ USAR
function use(g: Game, p: GPlayer, st: string): string | null {
  if (!g.isExploring()) return 'Ahora no se puede.';
  if (p.invisible) return 'No puedes interactuar siendo invisible.';
  if (st.startsWith('door:')) return doorOpen(g, p, st.slice(5));
  const s = g.rt.stations.get(st);
  if (!s) return 'Estación desconocida.';
  if (busy(p)) return 'Termina antes lo que estás haciendo.';
  if (!inRange(g, p, st)) return 'Demasiado lejos.';
  if (!p.alive && s.kind !== 'task' && s.kind !== 'ladder') return 'Los expulsados solo pueden terminar tareas.';
  switch (s.kind) {
    case 'emergency': return g.callMeeting(p, st);
    case 'ladder': return ladder(g, p, st);
    case 'vent': return enterVent(g, p, st);
    case 'locker': return enterLocker(g, p, st);
    case 'cameras': {
      const cams = g.map.cameras.map((c) => c.id);
      p.sysPanel = { kind: 'cameras', station: st, cam: cams[0] };
      p.state = 'cams';
      g.dirtyPub = true;
      g.openPanel(p, { kind: 'cameras', station: st, cams, current: cams[0], noSignal: camNoSignal(g) });
      return null;
    }
    case 'occupancy': {
      const lv = p.level;
      p.sysPanel = { kind: 'occupancy', station: st, level: lv };
      p.state = 'cams';
      g.openPanel(p, { kind: 'occupancy', station: st });
      g.event(p.id, { e: 'occ', data: occupancy(g, lv) });
      return null;
    }
    case 'sabotage': {
      if (p.team !== 'impostor' && !g.practice) return 'Instalación del sistema: todo parece en orden.';
      const def = g.map.sabotages.find((sb) => sb.activation.includes(st));
      if (!def) return 'Nada que manipular aquí.';
      const options = def.kind === 'doors' ? g.map.doorGroups.map((dg) => ({ id: def.id, name: `Cerrar: ${dg.name}`, group: dg.id })) : [{ id: def.id, name: def.name }];
      p.sysPanel = { kind: 'sabotage', station: st };
      g.openPanel(p, { kind: 'sabotage', station: st, options });
      return null;
    }
    case 'commsTerminal':
      return 'Terminal de comunicaciones: funcionamiento normal.';
    case 'knife':
      return knifeUse(g, p, st);
    case 'repair':
    case 'task': {
      const r = tryRepair(g, p, st);
      if (r !== 'none') return r;
      const t = tryTask(g, p, st);
      if (t !== 'none') return t;
      return s.kind === 'repair' ? 'Este sistema funciona con normalidad.' : 'No tienes tareas aquí.';
    }
    default:
      return 'Nada que hacer aquí.';
  }
}

function camNoSignal(g: Game): string[] {
  return g.map.cameras.filter((c) => g.commsDown() || g.interference.some((i) => i.endsGt > g.gt && i.cams.includes(c.id))).map((c) => c.id);
}

function selectCam(g: Game, p: GPlayer, cam: string): string | null {
  if (p.sysPanel?.kind !== 'cameras') return 'silencio';
  if (!g.map.cameras.some((c) => c.id === cam)) return 'silencio';
  p.sysPanel.cam = cam;
  g.dirtyPub = true;
  return null;
}

function occLevel(g: Game, p: GPlayer, level: string): string | null {
  if (p.sysPanel?.kind !== 'occupancy') return 'silencio';
  if (!g.map.levels.some((l) => l.id === level)) return 'silencio';
  p.sysPanel.level = level;
  g.event(p.id, { e: 'occ', data: occupancy(g, level) });
  return null;
}

function openMinigame(g: Game, p: GPlayer, ctx: 'task' | 'repair' | 'knife' | 'fake', ref: string, st: string, mg: string, part: number, puzzle: Record<string, unknown>, title: string, waitFactor = 1, sabStep?: number, decoy?: boolean) {
  p.panel = { ctx, ref, station: st, mg, part, partStartGt: g.gt, puzzle, waitFactor, sabStep, decoy };
  p.state = 'panel';
  const pan: PanelOpen = { kind: 'minigame', ctx: ctx === 'fake' ? 'task' : ctx, ref, station: st, mg, part, puzzle, title, theme: g.map.id as MapId };
  g.openPanel(p, pan);
}

function tryRepair(g: Game, p: GPlayer, st: string): string | 'none' | null {
  const sab = g.sabotage;
  if (!sab || !p.alive) return 'none';
  const def = g.sabotageDef()!;
  const stepDef = def.repair[sab.step];
  if (!stepDef || !stepDef.stations.includes(st)) {
    if (def.repair.some((r) => r.stations.includes(st))) return 'Primero hay que completar el paso anterior de la reparación.';
    return 'none';
  }
  const mg = MINIGAMES[stepDef.minigame];
  const puzzle = mg.gen(g.rng, { complexity: g.gs.knifeComplexity, mapId: g.map.id });
  let wf = 1;
  if (def.kind !== 'critical' && p.techBoostEndsGt > g.gt) wf = 1 - (abilityRoleParam(g, p, 'intensity') ?? 15) / 100;
  openMinigame(g, p, 'repair', `rep:${sab.id}:${sab.step}`, st, stepDef.minigame, 0, puzzle, stepDef.label, wf, sab.step);
  return null;
}

function tryTask(g: Game, p: GPlayer, st: string): string | 'none' | null {
  const t = p.tasks.find((x) => !x.done && x.stations[x.stage] === st);
  if (!t) return 'none';
  if (t.slot.type === 'orders' && t.stage === 1 && !p.carrying) return 'Primero recoge la comanda.';
  const mgId = taskMinigame(t.slot.type, t.stage);
  const def = MINIGAMES[mgId];
  if (!t.puzzles[t.stage]) t.puzzles[t.stage] = def.gen(g.rng, { complexity: g.gs.knifeComplexity, memory: t.memory, mapId: g.map.id });
  openMinigame(g, p, t.fake ? 'fake' : 'task', t.id, st, mgId, t.part, t.puzzles[t.stage]!, t.slot.name);
  return null;
}

function knifeUse(g: Game, p: GPlayer, st: string): string | null {
  if (!p.knife || !g.knife || p.knife.stage >= 5) return 'No hay nada útil aquí.';
  const stage = p.knife.stage;
  const opts = g.knife.options[stage];
  if (!opts.includes(st)) return 'No hay nada útil aquí.';
  const correct = g.knife.stations[stage] === st;
  if (!correct) {
    if (p.knife.searched.includes(st)) return 'Ya has registrado este lugar.';
    const puzzle = MINIGAMES.k_search.gen(g.rng, { complexity: g.gs.knifeComplexity, mapId: g.map.id });
    openMinigame(g, p, 'knife', `k:${stage}:${st}`, st, 'k_search', 0, puzzle, stationLabel(g, st), 1, undefined, true);
    return null;
  }
  const mg = KNIFE_MINIGAMES[stage];
  const puzzle = MINIGAMES[mg].gen(g.rng, { complexity: g.gs.knifeComplexity, mapId: g.map.id });
  if (mg === 'k_docs') Object.assign(puzzle, { codeA: g.knife.codeA });
  openMinigame(g, p, 'knife', `k:${stage}:${st}`, st, mg, 0, puzzle, stationLabel(g, st));
  return null;
}

// ------------------------------------------------------------------ etapas de minijuego
function step(g: Game, p: GPlayer, ref: string, part: number, ans: Record<string, unknown>): string | null {
  const pan = p.panel;
  if (!pan || pan.ref !== ref || pan.part !== part) return 'silencio';
  if (!g.isExploring()) return 'silencio';
  const def = MINIGAMES[pan.mg];
  const waitScale = def.waitParts?.includes(part) ? pan.waitFactor : 1;
  const min = def.minMs[part] * waitScale * 0.8;
  if (g.gt - pan.partStartGt < min) {
    g.event(p.id, { e: 'stepBad', ref, part, msg: 'Demasiado rápido: hazlo con calma.' });
    pan.partStartGt = g.gt;
    return null;
  }
  const secret = pan.mg === 'k_keypad' ? g.knife?.code : undefined;
  if (!def.check(pan.puzzle, part, ans ?? {}, secret)) {
    g.event(p.id, { e: 'stepBad', ref, part, msg: 'No es correcto, prueba otra vez.' });
    pan.partStartGt = g.gt;
    return null;
  }
  pan.part++;
  pan.partStartGt = g.gt;
  const task = (pan.ctx === 'task' || pan.ctx === 'fake') ? p.tasks.find((t) => t.id === ref) : undefined;
  if (task) task.part = pan.part;
  if (pan.part < def.parts) {
    g.event(p.id, { e: 'stepOk', ref, part, done: false });
    return null;
  }
  let reveal: string | undefined;
  if (task) completeTaskStage(g, p, task, def.remember?.(pan.puzzle, ans) ?? {});
  else if (pan.ctx === 'repair') completeRepairStep(g, p, pan.sabStep ?? -1, ref);
  else if (pan.ctx === 'knife') reveal = completeKnife(g, p, pan.station, !!pan.decoy);
  p.panel = null;
  p.state = p.alive ? 'free' : 'ghost';
  g.event(p.id, { e: 'stepOk', ref, part, done: true, reveal });
  return null;
}

function completeTaskStage(g: Game, p: GPlayer, t: TaskInst, mem: Record<string, unknown>) {
  if (t.done) return; // una tarea cuenta una sola vez
  Object.assign(t.memory, mem);
  t.stage++;
  t.part = 0;
  if (t.slot.type === 'orders') p.carrying = t.stage === 1;
  if (t.stage >= t.slot.stages.length) {
    t.done = true;
    if (!t.fake) {
      g.dirtyPub = true;
      analystOnTaskDone(g, p);
      if (g.gs.visualTasks) for (const o of g.players.values()) g.event(o.id, { e: 'fx', fx: 'sparkle', x: p.x, y: p.y, l: p.level });
    }
  }
  if (g.gs.taskBarMode === 'always') g.dirtyPub = true;
  p.dirtyPriv = true;
}

function completeRepairStep(g: Game, p: GPlayer, sabStep: number, ref: string) {
  const sab = g.sabotage;
  if (!sab || sab.step !== sabStep) return;
  const def = g.sabotageDef()!;
  sab.step++;
  // Otros que estaban en el mismo paso: su panel ya no aplica.
  for (const o of g.players.values()) {
    if (o !== p && o.panel?.ref === ref) {
      o.panel = null;
      o.state = o.alive ? 'free' : 'ghost';
      g.host.send(o.id, 'panel', null);
      g.toast(o.id, 'Otra persona ha completado este paso.', 'ok');
    }
  }
  if (sab.step >= def.repair.length) resolveSabotage(g, `${def.name}: reparado.`);
  else {
    for (const o of g.players.values()) g.toast(o.id, `Paso completado. Siguiente: ${def.repair[sab.step].label}.`, 'info');
    g.dirtyPub = true;
  }
}

function completeKnife(g: Game, p: GPlayer, st: string, decoy: boolean): string {
  const k = p.knife!;
  const tpl = g.map.knife!;
  if (decoy) {
    k.searched.push(st);
    return 'Aquí no hay nada.';
  }
  let reveal = '';
  switch (k.stage) {
    case 0: k.codeParts.push(g.knife!.codeA); reveal = `Documento manipulado: los primeros dígitos son ${g.knife!.codeA}.`; break;
    case 1: reveal = `Has encontrado la ${tpl.keyName}.`; break;
    case 2: k.codeParts.push(g.knife!.codeB); reveal = `Dentro del ${tpl.compartmentName}: últimos dígitos ${g.knife!.codeB}.`; break;
    case 3: k.hasKnife = true; reveal = 'Tienes el cuchillo. Llévalo oculto.'; break;
    case 4: k.authorized = true; reveal = `Autorización manipulada. ${g.map.texts.accessGoal}.`; break;
  }
  k.stage++;
  k.searched = [];
  g.refreshKnifeClue(p);
  return reveal;
}

// ------------------------------------------------------------------ cerrar
function closeAll(g: Game, p: GPlayer): string | null {
  if (p.panel) {
    p.panel = null;
    p.state = p.alive ? 'free' : 'ghost';
  }
  if (p.sysPanel && p.sysPanel.kind !== 'vent') {
    if (p.sysPanel.kind === 'cameras') g.dirtyPub = true;
    p.sysPanel = null;
    if (p.state === 'cams') p.state = 'free';
  }
  if (p.timed && (p.timed.kind === 'sabotage' || p.timed.kind === 'doorOpen' || p.timed.kind === 'attack')) cancelTimed(g, p);
  if (p.state === 'locker' && !p.timed) leaveLocker(g, p);
  if (p.observing) {
    p.observing = null;
    p.state = 'free';
    g.dirtyPub = true;
  }
  g.host.send(p.id, 'panel', null);
  return null;
}

function cancelTimed(g: Game, p: GPlayer) {
  if (!p.timed) return;
  if (p.timed.kind === 'attack') g.responsible.struggling = false;
  p.timed = null;
  if (p.state === 'sabotaging' || p.state === 'attacking') p.state = 'free';
  g.dirtyPub = true;
}

// ------------------------------------------------------------------ escaleras / trampillas / taquillas
function ladder(g: Game, p: GPlayer, st: string): string | null {
  if (p.carrying) return 'No puedes subir cargando una bandeja.';
  const l = g.map.ladders.find((x) => `${x.id}_a` === st || `${x.id}_b` === st);
  if (!l) return 'Escalera desconocida.';
  const to = `${l.id}_a` === st ? l.b : l.a;
  p.timed = { kind: 'ladder', startGt: g.gt, endGt: g.gt + LADDER_MS, data: { to } };
  p.state = 'ladder';
  const from = `${l.id}_a` === st ? l.a : l.b;
  p.x = from.x; p.y = from.y;
  return null;
}

function enterVent(g: Game, p: GPlayer, st: string): string | null {
  if (p.team !== 'impostor' && p.role !== 'ingeniero') return 'Solo personal autorizado puede usar las trampillas.';
  if (p.carrying) return 'No cabes con la bandeja.';
  if (g.gt < p.ventCooldownGt) return `Trampilla en enfriamiento (${Math.ceil((p.ventCooldownGt - g.gt) / 1000)} s).`;
  if (p.disguise) return 'No puedes entrar disfrazado.';
  const v = g.map.vents.find((x) => x.id === st)!;
  p.x = v.x; p.y = v.y;
  p.state = 'vent';
  p.timed = { kind: 'ventIn', startGt: g.gt, endGt: g.gt + VENT_ANIM_MS, data: { vent: st } };
  fxAround(g, 'vent', v.x, v.y, v.level);
  return null;
}

function ventStayMs(g: Game, p: GPlayer) {
  if (p.team === 'impostor') return g.gs.ventStay * 1000;
  return (abilityRoleParam(g, p, 'duration') ?? 6) * 1000;
}
function ventCooldownMs(g: Game, p: GPlayer) {
  if (p.team === 'impostor') return g.gs.ventCooldown * 1000;
  return (abilityRoleParam(g, p, 'cooldown') ?? 30) * 1000;
}

function sendVentPanel(g: Game, p: GPlayer) {
  if (!p.vent) return;
  p.sysPanel = { kind: 'vent', station: p.vent.id };
  g.openPanel(p, { kind: 'vent', vent: p.vent.id, links: g.ventLinksFor(p.vent.id) });
  p.dirtyPriv = true;
}

function ventAction(g: Game, p: GPlayer, a: Extract<ClientAction, { k: 'vent' }>): string | null {
  if (p.state !== 'vent' || !p.vent || p.timed) return 'silencio';
  if (a.exit) {
    p.timed = { kind: 'ventOut', startGt: g.gt, endGt: g.gt + VENT_ANIM_MS, data: {} };
    fxAround(g, 'vent', p.x, p.y, p.level);
    return null;
  }
  const to = String(a.to ?? '');
  if (!g.ventLinksFor(p.vent.id).some((l) => l.id === to)) return 'Esa trampilla no está conectada.';
  p.timed = { kind: 'ventMove', startGt: g.gt, endGt: g.gt + VENT_MOVE_MS, data: { to } };
  return null;
}

function enterLocker(g: Game, p: GPlayer, st: string): string | null {
  if (p.carrying) return 'No cabes con la bandeja.';
  for (const o of g.players.values()) if (o !== p && o.locker?.id === st) return 'La taquilla está ocupada.';
  const s = g.rt.stations.get(st)!;
  p.x = s.x; p.y = s.y;
  p.state = 'locker';
  p.locker = { id: st, untilGt: g.gt + g.gs.lockerTime * 1000 };
  p.timed = { kind: 'lockerIn', startGt: g.gt, endGt: g.gt + LOCKER_ANIM_MS, data: {} };
  fxAround(g, 'locker', s.x, s.y, s.level);
  return null;
}

function leaveLocker(g: Game, p: GPlayer): string | null {
  if (p.state !== 'locker' || p.timed) return 'silencio';
  p.timed = { kind: 'lockerOut', startGt: g.gt, endGt: g.gt + LOCKER_ANIM_MS, data: {} };
  fxAround(g, 'locker', p.x, p.y, p.level);
  return null;
}

function doorOpen(g: Game, p: GPlayer, doorId: string): string | null {
  if (!p.alive) return 'silencio';
  if (busy(p)) return 'Termina antes lo que estás haciendo.';
  const d = g.rt.doors.get(doorId);
  if (!d || !g.closedDoors.has(doorId)) return 'La puerta ya está abierta.';
  if (d.level !== p.level || dist(p.x, p.y, d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2) > 95) return 'Demasiado lejos.';
  let ms = 3000;
  if (p.techBoostEndsGt > g.gt) ms *= 1 - (abilityRoleParam(g, p, 'intensity') ?? 15) / 100;
  p.timed = { kind: 'doorOpen', startGt: g.gt, endGt: g.gt + ms, data: { door: doorId } };
  return null;
}

// ------------------------------------------------------------------ sabotajes
function startSabotage(g: Game, p: GPlayer, st: string, opt?: string): string | null {
  if (!g.isExploring()) return 'Ahora no se puede.';
  if (p.team !== 'impostor' && !g.practice) return 'silencio';
  if (!p.alive) return 'silencio';
  if (p.invisible) return 'No puedes sabotear siendo invisible.';
  if (p.timed || p.panel || (p.state !== 'free' && p.state !== 'cams')) return 'Termina antes lo que estás haciendo.';
  if (!inRange(g, p, st)) return 'Debes estar en la instalación.';
  const def = g.map.sabotages.find((sb) => sb.activation.includes(st));
  if (!def) return 'Nada que sabotear aquí.';
  if (g.sabotage) return 'Ya hay un sabotaje activo.';
  if (g.gt < g.sabotageReadyGt) return `Sabotajes en enfriamiento (${Math.ceil((g.sabotageReadyGt - g.gt) / 1000)} s).`;
  if (g.interference.some((i) => i.endsGt > g.gt) && def.kind === 'critical') return 'Espera a que termine la interferencia.';
  let group: string | undefined;
  if (def.kind === 'doors') {
    group = g.map.doorGroups.find((dg) => dg.id === opt)?.id;
    if (!group) return 'Elige un grupo de puertas.';
  }
  let ms = g.gs.sabotagePrep * 1000;
  if (p.role === 'saboteador') ms *= 1 - (abilityRoleParam(g, p, 'intensity') ?? 15) / 100;
  p.sysPanel = null;
  g.host.send(p.id, 'panel', null);
  p.timed = { kind: 'sabotage', startGt: g.gt, endGt: g.gt + ms, data: { id: def.id, group } };
  p.state = 'sabotaging';
  return null;
}

function activateSabotage(g: Game, id: string, group?: string) {
  if (g.sabotage || !g.isExploring()) return;
  const def = g.sabotageDef(id)!;
  const endsGt = def.kind === 'critical' ? g.gt + g.critTimeMs() : def.kind === 'doors' ? g.gt + g.gs.doorDuration * 1000 : null;
  g.sabotage = { id, startedGt: g.gt, endsGt, step: 0, doorGroup: group };
  if (def.kind === 'doors') {
    const dg = g.map.doorGroups.find((x) => x.id === group)!;
    for (const d of dg.doors) g.closedDoors.set(d, endsGt!);
    // Nadie queda atrapado dentro del hueco de una puerta.
    for (const o of g.players.values()) {
      if (!o.alive) continue;
      if (g.rt.collides(o.level, o.x, o.y, 11, g.doorState)) {
        const f = g.rt.nearestFree(o.level, o.x, o.y, g.doorState);
        o.x = f.x; o.y = f.y;
      }
    }
  }
  if (def.kind === 'comms') {
    for (const o of g.players.values()) {
      if (o.sysPanel?.kind === 'cameras') g.openPanel(o, { kind: 'cameras', station: o.sysPanel.station, cams: g.map.cameras.map((c) => c.id), current: o.sysPanel.cam!, noSignal: camNoSignal(g) });
    }
  }
  g.dirtyPub = true;
  for (const o of g.players.values()) g.event(o.id, { e: 'sound', s: def.kind === 'critical' ? 'alarmCritical' : 'alarm' });
}

export function resolveSabotage(g: Game, msg: string) {
  const sab = g.sabotage;
  if (!sab) return;
  const def = g.sabotageDef()!;
  g.sabotage = null;
  g.closedDoors.clear();
  g.sabotageReadyGt = g.gt + g.gs.sabotageCooldown * 1000;
  g.dirtyPub = true;
  for (const o of g.players.values()) {
    g.toast(o.id, msg, 'ok');
    g.event(o.id, { e: 'sound', s: 'fixed' });
    if (def.kind === 'comms' && o.sysPanel?.kind === 'cameras') g.openPanel(o, { kind: 'cameras', station: o.sysPanel.station, cams: g.map.cameras.map((c) => c.id), current: o.sysPanel.cam!, noSignal: camNoSignal(g) });
    // Cierra paneles de reparación que ya no aplican.
    if (o.panel?.ctx === 'repair') {
      o.panel = null;
      o.state = o.alive ? 'free' : 'ghost';
      g.host.send(o.id, 'panel', null);
    }
  }
}

export function sabotageTick(g: Game) {
  const sab = g.sabotage;
  if (sab && sab.endsGt !== null && g.gt >= sab.endsGt) {
    const def = g.sabotageDef()!;
    if (def.kind === 'critical') {
      g.endGame('impostor', 'critical', def.failTitle ?? 'Desastre', def.failText ?? '', def.failScene ?? 'crash');
      return;
    }
    if (def.kind === 'doors') resolveSabotage(g, 'Las puertas se han abierto.');
  }
  if (g.sabotage?.id === 'doors') {
    for (const [d, until] of g.closedDoors) if (until <= g.gt) g.closedDoors.delete(d);
  }
  for (const p of g.players.values()) {
    if (p.state === 'vent' && p.vent && !p.timed && g.gt >= p.vent.untilGt) {
      p.timed = { kind: 'ventOut', startGt: g.gt, endGt: g.gt + VENT_ANIM_MS, data: {} };
      fxAround(g, 'vent', p.x, p.y, p.level);
    }
    if (p.state === 'locker' && p.locker && !p.timed && g.gt >= p.locker.untilGt) {
      p.timed = { kind: 'lockerOut', startGt: g.gt, endGt: g.gt + LOCKER_ANIM_MS, data: {} };
    }
    if (p.timed?.kind === 'attack') {
      const r = g.responsible;
      if (!r.alive || r.level !== p.level || dist(p.x, p.y, r.x, r.y) > ATTACK_RANGE + 16 || !g.rt.los(p.level, p.x, p.y, r.x, r.y, g.doorState)) cancelTimed(g, p);
    }
    if (p.sysPanel?.kind === 'occupancy' && g.tickNo % 60 === 0) g.event(p.id, { e: 'occ', data: occupancy(g, p.sysPanel.level ?? p.level) });
  }
}

// ------------------------------------------------------------------ ataque al responsable
function attack(g: Game, p: GPlayer): string | null {
  if (!g.isExploring()) return 'Ahora no se puede.';
  if (p.team !== 'impostor' || !p.alive || !p.knife) return 'silencio';
  if (!p.knife.hasKnife) return 'Necesitas el arma.';
  if (!p.knife.authorized) return 'Te falta manipular la autorización.';
  if (p.invisible || p.state !== 'free' || p.timed || p.panel) return 'No puedes atacar ahora.';
  const r = g.responsible;
  if (!r.alive) return 'silencio';
  if (r.level !== p.level || dist(p.x, p.y, r.x, r.y) > ATTACK_RANGE) return 'Acércate más.';
  if (!g.rt.los(p.level, p.x, p.y, r.x, r.y, g.doorState)) return 'No tienes línea de visión.';
  p.timed = { kind: 'attack', startGt: g.gt, endGt: g.gt + g.gs.attackDuration * 1000, data: {} };
  p.state = 'attacking';
  r.struggling = true;
  p.facing = r.x >= p.x ? 1 : -1;
  g.dirtyPub = true;
  return null;
}

// ------------------------------------------------------------------ fin de acciones temporizadas
export function completeTimed(g: Game, p: GPlayer) {
  const t = p.timed!;
  p.timed = null;
  switch (t.kind) {
    case 'ladder': {
      const to = t.data.to as { level: string; x: number; y: number };
      p.level = to.level;
      const f = g.rt.nearestFree(to.level, to.x, to.y, g.doorState);
      p.x = f.x; p.y = f.y;
      p.state = p.alive ? 'free' : 'ghost';
      g.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
      break;
    }
    case 'ventIn':
      p.vent = { id: t.data.vent, untilGt: g.gt + ventStayMs(g, p) };
      sendVentPanel(g, p);
      break;
    case 'ventMove': {
      const v = g.map.vents.find((x) => x.id === t.data.to)!;
      p.x = v.x; p.y = v.y;
      p.vent = { id: v.id, untilGt: p.vent?.untilGt ?? g.gt };
      g.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
      sendVentPanel(g, p);
      break;
    }
    case 'ventOut':
      p.vent = null;
      p.sysPanel = null;
      p.state = 'free';
      p.ventCooldownGt = g.gt + ventCooldownMs(g, p);
      p.dirtyPriv = true;
      g.host.send(p.id, 'panel', null);
      break;
    case 'lockerIn':
      break;
    case 'lockerOut':
      p.locker = null;
      p.state = 'free';
      p.dirtyPriv = true;
      break;
    case 'sabotage':
      p.state = 'free';
      activateSabotage(g, t.data.id, t.data.group);
      break;
    case 'doorOpen': {
      g.closedDoors.delete(t.data.door);
      if (g.sabotage?.id === 'doors' && g.closedDoors.size === 0) resolveSabotage(g, 'Puertas abiertas mediante la apertura de seguridad.');
      g.dirtyPub = true;
      break;
    }
    case 'attack': {
      const r = g.responsible;
      if (r.alive && r.level === p.level && dist(p.x, p.y, r.x, r.y) <= ATTACK_RANGE + 16) {
        r.alive = false;
        r.struggling = false;
        g.endGame('impostor', 'murder', g.map.texts.murderTitle, g.map.texts.murderText, 'murder');
      } else {
        r.struggling = false;
        p.state = 'free';
      }
      break;
    }
    case 'cast':
      p.state = 'free';
      break;
  }
  g.dirtyPub = true;
}

/** Cancela lo no confirmado y deja al jugador en un estado válido (reunión, desconexión, salida). */
export function cancelPlayerActivity(g: Game, p: GPlayer, reason: 'meeting' | 'disconnect' | 'leave') {
  if (p.timed) {
    const t = p.timed;
    if (t.kind === 'ladder') {
      // A mitad de escalera: se resuelve al extremo de destino, seguro.
      completeTimed(g, p);
    } else if (t.kind === 'ventMove' || t.kind === 'ventIn' || t.kind === 'ventOut' || t.kind === 'lockerIn' || t.kind === 'lockerOut') {
      p.timed = null;
    } else if (t.kind === 'attack') {
      g.responsible.struggling = false;
      p.timed = null;
    } else p.timed = null;
  }
  if (p.state === 'vent' || p.vent) {
    p.vent = null;
    const f = g.rt.nearestFree(p.level, p.x, p.y + 16, g.doorState);
    p.x = f.x; p.y = f.y;
  }
  if (p.state === 'locker' || p.locker) {
    p.locker = null;
    const f = g.rt.nearestFree(p.level, p.x, p.y, g.doorState);
    p.x = f.x; p.y = f.y;
  }
  if (p.panel || p.sysPanel) g.host.send(p.id, 'panel', null);
  p.panel = null;
  p.sysPanel = null;
  p.observing = null;
  p.state = p.alive ? 'free' : 'ghost';
  p.dirtyPriv = true;
  void reason;
}

export function fxAround(g: Game, fx: 'vent' | 'poof' | 'fade' | 'unfade' | 'decoy' | 'sensor' | 'locker', x: number, y: number, level: string) {
  for (const o of g.players.values()) {
    if (o.left || !o.connected) continue;
    if (o.level !== level) continue;
    const vr = g.visionOf(o) + 40;
    if (dist(o.x, o.y, x, y) > vr) continue;
    if (o.alive && !g.rt.los(level, o.x, o.y - 8, x, y - 8, g.doorState)) continue;
    g.event(o.id, { e: 'fx', fx, x, y, l: level });
  }
}
