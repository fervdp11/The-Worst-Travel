import {
  BASE_SPEED, BASE_VISION, EJECT_MS, INTRO_MS, MAX_INPUT_BUFFER, MEETING_CALL_MS, MIN_VISION, RECONNECT_GRACE_MS,
  RESULTS_MS, SIM_DT, SNAPSHOT_EVERY,
} from '../../shared/constants';
import { getMap, getRuntime } from '../../shared/maps';
import type { MapDef, MapId } from '../../shared/maps/types';
import { DoorState, MapRuntime } from '../../shared/maps/runtime';
import { stepMove } from '../../shared/movement';
import type {
  ActionMsg, EndResult, GameEvent, MeetingPublic, PanelOpen, Phase, PlayerPublic, PrivateState, PublicGame,
  ServerToClient, SabotageState, Snapshot,
} from '../../shared/protocol';
import { Rng, randomId } from '../../shared/rng';
import { ROLE_BY_ID, RoleId, Team } from '../../shared/roles';
import { assignRoles, effectiveCriticalTime, GameSettings, RoomSettings } from '../../shared/settings';
import { SKIP, tallyVotes } from '../../shared/votes';
import { abilityTick, handleAbility, initAbility, abilityPrivate, cancelAbilitiesForMeeting, analystOnTaskDone } from './abilities';
import { handleAction, completeTimed, cancelPlayerActivity, sabotageTick, stationLabel } from './interactions';
import { generateKnifeChain, KnifeChain, describePlace } from './knife';
import { assignTasks, taskPrivate } from './tasks';
import type { ActiveSabotage, Decoy, GPlayer, Interference, Sensor } from './types';
import { buildSnapshot } from './visibility';

export interface GameHost {
  send<E extends keyof ServerToClient>(pid: string, ev: E, data: Parameters<ServerToClient[E]>[0]): void;
  onEnd(r: EndResult): void;
}

export interface GameInit {
  mapId: MapId;
  settings: RoomSettings;
  seed: number;
  configVersion: number;
  players: { id: string; name: string; color: number; acc: number; connected: boolean }[];
  practice?: { team: Team; role: RoleId | null } | null;
  clock?: () => number;
}

export class Game {
  map: MapDef;
  rt: MapRuntime;
  gs: GameSettings;
  rng: Rng;
  phase: Phase = 'INICIO';
  phaseEnds: number | null;
  gt = 0;
  tickNo = 0;
  lastTickAt: number;
  players = new Map<string, GPlayer>();
  impostorId: string | null = null;
  knife: KnifeChain | null = null;
  responsible: { x: number; y: number; level: string; alive: boolean; idx: number; waitUntil: number; facing: 1 | -1; struggling: boolean };
  closedDoors = new Map<string, number>();
  sabotage: ActiveSabotage | null = null;
  sabotageReadyGt: number;
  meeting: { stage: MeetingPublic['stage']; caller: string; button: string; votes: Record<string, string>; results?: MeetingPublic['results']; stageEnds: number } | null = null;
  arrival: { remaining: number } | null = null;
  result: EndResult | null = null;
  buttonReadyGt: number;
  decoys: Decoy[] = [];
  sensors: Sensor[] = [];
  interference: Interference[] = [];
  escapistLinks: { a: string; b: string; endsGt: number }[] = [];
  lightsFactor = 1;
  dirtyPub = true;
  disguiseSeq = 0;
  ended = false;
  clock: () => number;
  doorState: DoorState;
  practice: GameInit['practice'];
  configVersion: number;
  seed: number;

  constructor(public host: GameHost, init: GameInit) {
    this.clock = init.clock ?? Date.now;
    this.map = getMap(init.mapId);
    this.rt = getRuntime(init.mapId);
    this.gs = init.settings.game;
    this.settingsAll = init.settings;
    this.seed = init.seed;
    this.rng = new Rng(init.seed);
    this.practice = init.practice ?? null;
    this.configVersion = init.configVersion;
    this.lastTickAt = this.clock();
    this.phaseEnds = this.lastTickAt + INTRO_MS;
    this.doorState = { isClosed: (id) => this.closedDoors.has(id) };
    this.sabotageReadyGt = this.gs.sabotageGrace * 1000;
    this.buttonReadyGt = this.gs.buttonCooldown * 1000;

    const ids = init.players.map((p) => p.id);
    let team: Record<string, Team>;
    let roles: Record<string, RoleId | null>;
    if (this.practice) {
      const pid = ids[0];
      team = { [pid]: this.practice.team };
      roles = { [pid]: this.practice.role && ROLE_BY_ID[this.practice.role].team === this.practice.team ? this.practice.role : null };
      this.impostorId = this.practice.team === 'impostor' ? pid : null;
    } else {
      const a = assignRoles(this.rng.fork('roles'), ids, init.settings);
      team = a.team;
      roles = a.roles;
      this.impostorId = a.impostor;
    }
    const spawns = this.map.spawn;
    init.players.forEach((ip, i) => {
      const sp = spawns[i % spawns.length];
      const off = Math.floor(i / spawns.length) * 14;
      const pos = this.rt.nearestFree(sp.level, sp.x + off, sp.y, this.doorState);
      const p: GPlayer = {
        id: ip.id, name: ip.name, color: ip.color, acc: ip.acc, team: team[ip.id], role: roles[ip.id],
        alive: true, left: false, connected: ip.connected, disconnectedAt: ip.connected ? 0 : this.clock(),
        x: pos.x, y: pos.y, level: sp.level, facing: i % 2 ? -1 : 1, moving: false,
        inputs: [], credit: 0, ack: 0, lastQueued: 0, state: 'intro', timed: null, panel: null, sysPanel: null,
        tasks: [], meetingsLeft: this.gs.meetingsPerPlayer, carrying: false, vent: null, ventCooldownGt: 0, locker: null,
        saved: null, handles: new Map(), handleRev: new Map(), recentActs: [],
        abilityCooldownGt: 0, abilityUses: 0, activeEndsGt: 0, battery: 0, analystOpenSince: null, disguise: null, invisible: false,
        speedBoostEndsGt: 0, techBoostEndsGt: 0, tracker: null, observing: null, knife: null, lastDoorRects: new Set(),
        dirtyPriv: true, anim: 'idle',
      };
      this.players.set(p.id, p);
    });
    const trng = this.rng.fork('tasks');
    for (const p of this.players.values()) {
      p.tasks = assignTasks(trng, this.map, this.gs, p.team === 'impostor');
      initAbility(this, p, init.settings);
    }
    if (this.impostorId) {
      this.knife = generateKnifeChain(this.rng.fork('knife'), this.map, this.gs.knifeComplexity);
      const imp = this.players.get(this.impostorId)!;
      imp.knife = { stage: 0, hasKnife: false, authorized: false, clue: '', codeParts: [], searched: [] };
      this.refreshKnifeClue(imp);
    }
    const rd = this.map.responsible!;
    this.responsible = { x: rd.patrol[0].x, y: rd.patrol[0].y, level: rd.level, alive: true, idx: 0, waitUntil: 0, facing: 1, struggling: false };
    for (const p of this.players.values()) this.sendPriv(p);
  }

  // ------------------------------------------------------------------ utilidades
  now() { return this.clock(); }
  player(id: string) { return this.players.get(id); }
  alive() { return [...this.players.values()].filter((p) => p.alive && !p.left); }
  event(pid: string, ev: GameEvent) { this.host.send(pid, 'ev', ev); }
  toast(pid: string, text: string, tone: 'info' | 'warn' | 'ok' | 'bad' = 'info') { this.event(pid, { e: 'toast', text, tone }); }
  commsDown() { return this.sabotage?.id === 'comms'; }
  isCritical() { return !!this.sabotage && this.sabotageDef()?.kind === 'critical'; }
  sabotageDef(id = this.sabotage?.id) { return id ? this.map.sabotages.find((s) => s.id === id) : undefined; }
  isExploring() { return this.phase === 'EXPLORACION' && !this.ended; }
  canMove(p: GPlayer) {
    if (!this.isExploring() || !p.connected || p.left) return false;
    if (!p.alive) return p.state === 'ghost' || p.state === 'free';
    return p.state === 'free' && !p.timed;
  }
  speedOf(p: GPlayer) {
    let s = BASE_SPEED * this.gs.playerSpeed;
    if (!p.alive) return s * 1.15;
    if (p.speedBoostEndsGt > this.gt) s *= 1 + ((this.roleParam(p, 'intensity') ?? 15) / 100);
    return s;
  }
  roleParam(p: GPlayer, key: string): number | undefined {
    if (!p.role) return undefined;
    return this.settingsRoles[p.role]?.params[key];
  }
  get settingsRoles() { return this.settingsAll.roles; }
  settingsAll!: RoomSettings;
  visionOf(p: GPlayer) {
    if (!p.alive) return 2400;
    if (p.team === 'impostor') return Math.max(MIN_VISION, BASE_VISION * this.gs.visionImpostor);
    const v = BASE_VISION * this.gs.visionWorker * (0.3 + 0.7 * this.lightsFactor);
    return Math.max(MIN_VISION, v);
  }
  critTimeMs() { return effectiveCriticalTime(this.gs, this.map.critTimeScale) * 1000; }

  handleFor(viewer: GPlayer, key: string): string {
    let h = viewer.handles.get(key);
    if (!h) {
      h = randomId(6);
      viewer.handles.set(key, h);
      viewer.handleRev.set(h, key);
    }
    return h;
  }

  // ------------------------------------------------------------------ red
  onInput(pid: string, msg: { s: number; d: number[] }) {
    const p = this.players.get(pid);
    if (!p || !Number.isInteger(msg?.s) || !Array.isArray(msg.d)) return;
    for (let i = 0; i + 1 < msg.d.length && i < 16; i += 2) {
      const s = msg.s + i / 2;
      if (s <= p.lastQueued) continue;
      const dx = Math.max(-100, Math.min(100, Math.round(Number(msg.d[i]) || 0)));
      const dy = Math.max(-100, Math.min(100, Math.round(Number(msg.d[i + 1]) || 0)));
      p.inputs.push({ s, dx, dy });
      p.lastQueued = s;
    }
    while (p.inputs.length > MAX_INPUT_BUFFER) {
      const dropped = p.inputs.shift()!;
      p.ack = dropped.s;
    }
  }

  onAction(pid: string, msg: ActionMsg) {
    const p = this.players.get(pid);
    if (!p || p.left || this.ended || !msg || typeof msg.id !== 'string') return;
    if (p.recentActs.includes(msg.id)) {
      this.host.send(pid, 'ack', { id: msg.id, ok: true, msg: 'duplicado' });
      return;
    }
    p.recentActs.push(msg.id);
    if (p.recentActs.length > 64) p.recentActs.shift();
    let res: string | null;
    try {
      if (msg.k === 'vote') res = this.vote(p, msg.target);
      else if (msg.k === 'ability') res = handleAbility(this, p, msg);
      else res = handleAction(this, p, msg);
    } catch (err) {
      console.error('Error de acción', err);
      res = 'Acción no válida';
    }
    this.host.send(pid, 'ack', { id: msg.id, ok: res === null, msg: res ?? undefined });
    if (res && res !== 'silencio') this.toast(pid, res, 'warn');
  }

  onDisconnect(pid: string) {
    const p = this.players.get(pid);
    if (!p || p.left) return;
    p.connected = false;
    p.disconnectedAt = this.clock();
    p.inputs = [];
    cancelPlayerActivity(this, p, 'disconnect');
    this.dirtyPub = true;
  }

  onReconnect(pid: string) {
    const p = this.players.get(pid);
    if (!p || p.left) return;
    p.connected = true;
    p.inputs = [];
    p.credit = 0;
    this.dirtyPub = true;
    p.dirtyPriv = true;
    this.sendPriv(p);
    this.host.send(pid, 'pub', this.buildPub());
  }

  /** Abandono definitivo (tras el margen de reconexión o salida voluntaria). */
  onLeave(pid: string) {
    const p = this.players.get(pid);
    if (!p || p.left) return;
    cancelPlayerActivity(this, p, 'leave');
    p.left = true;
    p.connected = false;
    const wasAlive = p.alive;
    p.alive = false;
    this.decoys = this.decoys.filter((d) => d.owner !== pid);
    this.sensors = this.sensors.filter((s) => s.owner !== pid);
    this.dirtyPub = true;
    if (this.ended) return;
    if (p.team === 'impostor') {
      this.endGame('workers', 'abandon', 'El impostor abandonó', 'El impostor ha abandonado el viaje. Los trabajadores ganan por abandono.', 'abandon');
      return;
    }
    // Reasignar tareas pendientes entre trabajadores conectados (vivos o expulsados).
    const pending = p.tasks.filter((t) => !t.done && !t.fake);
    const receivers = [...this.players.values()].filter((o) => o.team === 'worker' && !o.left && o.connected);
    if (!receivers.length) {
      if (![...this.players.values()].some((o) => o.team === 'worker' && !o.left)) {
        this.endGame('cancelled', 'cancelled', 'Partida cancelada', 'Todos los trabajadores han abandonado.', 'cancelled');
      }
      return;
    }
    pending.forEach((t, i) => {
      const r = receivers[i % receivers.length];
      t.id = `${t.id}_r${r.id.slice(0, 4)}`;
      t.puzzles = t.puzzles.map(() => null);
      t.part = 0;
      r.tasks.push(t);
      r.dirtyPriv = true;
      this.toast(r.id, `Has recibido la tarea «${t.slot.name}» de ${p.name}.`, 'info');
    });
    p.tasks = p.tasks.filter((t) => t.done || t.fake);
    void wasAlive;
    this.checkVotingComplete();
  }

  // ------------------------------------------------------------------ bucle
  tick() {
    if (this.ended && this.phase !== 'FINAL') return;
    const now = this.clock();
    const elapsed = Math.max(0, Math.min(100, now - this.lastTickAt));
    this.lastTickAt = now;
    this.tickNo++;
    if (this.isExploring()) this.gt += elapsed;

    // Desconexiones definitivas
    for (const p of this.players.values()) {
      if (!p.connected && !p.left && now - p.disconnectedAt > RECONNECT_GRACE_MS) this.onLeave(p.id);
    }
    if (this.ended && this.phase !== 'FINAL') return;

    this.phaseTick(now);
    if (this.isExploring()) {
      for (const p of this.players.values()) this.movePlayer(p);
      for (const p of this.players.values()) if (p.timed && this.gt >= p.timed.endGt) completeTimed(this, p);
      this.responsibleTick(elapsed);
      sabotageTick(this);
      abilityTick(this);
      this.arrivalTick(elapsed);
      const target = this.sabotage?.id === 'lights' ? 0 : 1;
      const prev = this.lightsFactor;
      this.lightsFactor += Math.sign(target - this.lightsFactor) * Math.min(Math.abs(target - this.lightsFactor), elapsed / 1500);
      if (prev !== this.lightsFactor) for (const p of this.players.values()) if (p.team === 'worker') p.dirtyPriv = true;
    } else {
      // Consumir entradas sin mover (para mantener el reconocimiento de secuencia)
      for (const p of this.players.values()) {
        if (p.inputs.length) { p.ack = p.inputs[p.inputs.length - 1].s; p.inputs = []; }
      }
    }
    if (this.tickNo % SNAPSHOT_EVERY === 0) this.sendSnapshots(now);
    if (this.tickNo % 30 === 0) this.dirtyPub = true;
    this.flush();
  }

  private movePlayer(p: GPlayer) {
    p.credit = Math.min(p.credit + 1, 4);
    let moved = false;
    const can = this.canMove(p);
    while (p.credit >= 1 && p.inputs.length) {
      const inp = p.inputs.shift()!;
      p.credit -= 1;
      p.ack = inp.s;
      if (!can) continue;
      if (inp.dx > 10) p.facing = 1; else if (inp.dx < -10) p.facing = -1;
      const r = stepMove(this.rt, p.level, p.x, p.y, inp.dx, inp.dy, this.speedOf(p), this.doorState, !p.alive);
      if (r.x !== p.x || r.y !== p.y) moved = true;
      p.x = r.x; p.y = r.y;
    }
    p.moving = moved;
    if (moved && p.alive) {
      this.sensorCheck(p);
      if (p.sysPanel && p.sysPanel.kind !== 'vent') { p.sysPanel = null; this.host.send(p.id, 'panel', null); }
    }
  }

  /** Sensor del Vigilante: cuenta cuerpos vivos que atraviesan físicamente el umbral. */
  private sensorCheck(p: GPlayer) {
    const inside = new Set<string>();
    for (const s of this.sensors) {
      const d = this.rt.doors.get(s.door)!;
      const r = d.rect;
      if (p.level === d.level && p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) inside.add(s.id);
    }
    for (const sid of inside) {
      if (p.lastDoorRects.has(sid)) continue;
      const s = this.sensors.find((x) => x.id === sid)!;
      if (this.gt <= s.endsGt && !this.commsDown() && s.passes.length < s.maxPasses) {
        s.passes.push(this.gt);
        const o = this.players.get(s.owner);
        if (o) o.dirtyPriv = true;
      }
    }
    p.lastDoorRects = inside;
  }

  private responsibleTick(elapsed: number) {
    const r = this.responsible;
    if (!r.alive || r.struggling) return;
    const pts = this.map.responsible!.patrol;
    if (this.gt < r.waitUntil) return;
    const t = pts[(r.idx + 1) % pts.length];
    const dx = t.x - r.x, dy = t.y - r.y;
    const d = Math.hypot(dx, dy);
    const step = 55 * (elapsed / 1000);
    if (d <= step) {
      r.x = t.x; r.y = t.y; r.idx = (r.idx + 1) % pts.length;
      r.waitUntil = this.gt + 2500 + this.rng.int(0, 3000);
    } else {
      r.x += (dx / d) * step; r.y += (dy / d) * step;
      if (Math.abs(dx) > 2) r.facing = dx > 0 ? 1 : -1;
    }
  }

  private arrivalTick(elapsed: number) {
    const total = this.taskTotals();
    if (!this.arrival && total.total > 0 && total.done >= total.total) {
      this.arrival = { remaining: this.gs.arrivalTime * 1000 };
      for (const p of this.players.values()) this.toast(p.id, `Todo el trabajo está hecho: ${this.map.texts.approach.toLowerCase()} en curso.`, 'ok');
      this.dirtyPub = true;
    }
    if (this.arrival && !this.isCritical()) {
      this.arrival.remaining -= elapsed;
      if (this.arrival.remaining <= 0) {
        this.endGame('workers', 'tasks', this.map.texts.arrivalTitle, this.map.texts.arrivalText, 'arrival');
      }
    }
  }

  taskTotals() {
    let total = 0, done = 0;
    for (const p of this.players.values()) {
      if (p.team !== 'worker') continue;
      for (const t of p.tasks) {
        if (t.fake) continue;
        if (p.left && !t.done) continue;
        total++;
        if (t.done) done++;
      }
    }
    return { total, done };
  }

  // ------------------------------------------------------------------ fases
  private setPhase(ph: Phase, durMs: number | null) {
    this.phase = ph;
    this.phaseEnds = durMs === null ? null : this.clock() + durMs;
    this.dirtyPub = true;
  }

  private phaseTick(now: number) {
    if (this.phaseEnds === null || now < this.phaseEnds) return;
    switch (this.phase) {
      case 'INICIO':
        this.setPhase('EXPLORACION', null);
        for (const p of this.players.values()) { p.state = 'free'; p.dirtyPriv = true; }
        break;
      case 'DISCUSION':
        if (this.meeting && this.meeting.stage === 'call') {
          this.meeting.stage = 'discuss';
          this.setPhase('DISCUSION', this.gs.discussionTime * 1000);
          if (this.gs.discussionTime === 0) this.phaseEnds = now;
        } else {
          this.meeting!.stage = 'vote';
          this.setPhase('VOTACION', this.gs.votingTime * 1000);
        }
        break;
      case 'VOTACION':
        this.resolveVotes();
        break;
      case 'RESULTADOS': {
        const ej = this.meeting?.results?.ejected;
        if (ej) {
          this.meeting!.stage = 'eject';
          this.setPhase('EXPULSION', EJECT_MS);
        } else this.endMeeting();
        break;
      }
      case 'EXPULSION': {
        const ej = this.meeting?.results?.ejected;
        const ejp = ej ? this.players.get(ej) : undefined;
        if (ejp && ejp.team === 'impostor') {
          this.endGame('workers', 'ejected', '¡Impostor expulsado!', `${ejp.name} era el impostor. El viaje sigue a salvo.`, 'ejected');
        } else this.endMeeting();
        break;
      }
      case 'FINAL':
        this.phaseEnds = null;
        break;
      default:
        break;
    }
  }

  callMeeting(p: GPlayer, buttonId: string): string | null {
    if (!this.isExploring()) return 'Ahora no se puede convocar.';
    if (!p.alive) return 'Los expulsados no pueden convocar reuniones.';
    if (this.isCritical()) return 'No se puede convocar durante una avería crítica.';
    if (p.meetingsLeft <= 0) return 'No te quedan reuniones.';
    if (this.gt < this.buttonReadyGt) return `Botón en enfriamiento (${Math.ceil((this.buttonReadyGt - this.gt) / 1000)} s).`;
    p.meetingsLeft--;
    p.dirtyPriv = true;
    // Cancelar todo lo no confirmado y guardar posiciones válidas.
    for (const o of this.players.values()) {
      cancelPlayerActivity(this, o, 'meeting');
      o.saved = { x: o.x, y: o.y, level: o.level };
      o.inputs = [];
      if (o.alive) o.state = 'meeting';
    }
    cancelAbilitiesForMeeting(this);
    this.meeting = { stage: 'call', caller: p.id, button: buttonId, votes: {}, stageEnds: 0 };
    this.setPhase('DISCUSION', MEETING_CALL_MS);
    for (const o of this.players.values()) this.event(o.id, { e: 'meeting', caller: p.id, callerName: p.name });
    return null;
  }

  vote(p: GPlayer, target: string): string | null {
    if (this.phase !== 'VOTACION' || !this.meeting) return 'No es momento de votar.';
    if (!p.alive || p.left) return 'No puedes votar.';
    if (this.meeting.votes[p.id]) return 'Ya has votado.';
    if (target !== SKIP) {
      const t = this.players.get(target);
      if (!t || !t.alive || t.left) return 'Voto no válido.';
    }
    this.meeting.votes[p.id] = target;
    this.dirtyPub = true;
    this.checkVotingComplete();
    return null;
  }

  private checkVotingComplete() {
    if (this.phase !== 'VOTACION' || !this.meeting) return;
    const voters = this.alive().filter((p) => p.connected);
    if (voters.every((v) => this.meeting!.votes[v.id])) {
      this.phaseEnds = Math.min(this.phaseEnds ?? Infinity, this.clock() + 1200);
      this.dirtyPub = true;
    }
  }

  private resolveVotes() {
    const m = this.meeting!;
    const aliveIds = this.alive().map((p) => p.id);
    const t = tallyVotes(m.votes, aliveIds, aliveIds);
    const ej = t.ejected ? this.players.get(t.ejected)! : null;
    m.results = {
      counts: t.counts,
      votes: this.gs.anonymousVotes ? undefined : { ...m.votes },
      ejected: t.ejected,
      ejectedName: ej?.name,
      ejectedColor: ej?.color,
      tie: t.tie,
      skipped: t.skipped,
      reveal: ej && this.gs.revealTeam ? ej.team : null,
    };
    m.stage = 'results';
    if (ej) {
      ej.alive = false;
      ej.state = 'ghost';
      ej.carrying = false;
      ej.dirtyPriv = true;
      this.sensors = this.sensors.filter((s) => s.owner !== ej.id);
    }
    this.setPhase('RESULTADOS', RESULTS_MS);
  }

  private endMeeting() {
    for (const p of this.players.values()) {
      if (p.saved) {
        const safe = this.rt.nearestFree(p.saved.level, p.saved.x, p.saved.y, this.doorState);
        p.x = safe.x; p.y = safe.y; p.level = p.saved.level;
        p.saved = null;
      }
      p.state = p.alive ? 'free' : 'ghost';
      p.inputs = [];
      p.dirtyPriv = true;
      this.event(p.id, { e: 'teleport', x: p.x, y: p.y, l: p.level });
    }
    this.meeting = null;
    this.buttonReadyGt = this.gt + this.gs.buttonCooldown * 1000;
    this.setPhase('EXPLORACION', null);
  }

  /** Resolución terminal atómica: tras confirmarse, se bloquean más acciones. */
  endGame(winner: EndResult['winner'], cause: EndResult['cause'], title: string, text: string, scene: string) {
    if (this.ended) return;
    this.ended = true;
    for (const p of this.players.values()) { p.timed = null; p.panel = null; p.sysPanel = null; this.host.send(p.id, 'panel', null); }
    this.result = {
      winner, cause, title, text, scene, impostorId: this.impostorId ?? '',
      roles: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, team: p.team, role: p.role })),
    };
    this.setPhase('FINAL', 10_000);
    for (const p of this.players.values()) this.event(p.id, { e: 'end', result: this.result });
    this.flush();
    this.host.onEnd(this.result);
  }

  // ------------------------------------------------------------------ estado público / privado
  buildPub(): PublicGame {
    const totals = this.taskTotals();
    const showBar = this.gs.taskBarMode === 'always' || (this.gs.taskBarMode === 'meetings' && this.phase !== 'EXPLORACION');
    if (showBar || this.gs.taskBarMode === 'always') this.lastShownProgress = totals.total ? totals.done / totals.total : 0;
    const sab = this.sabotage;
    let sabState: SabotageState | null = null;
    if (sab) {
      const def = this.sabotageDef()!;
      sabState = {
        id: sab.id, kind: def.kind, name: def.name, startedGt: sab.startedGt, endsGt: sab.endsGt, step: sab.step,
        steps: def.repair.map((r) => ({ label: r.label, stations: r.stations, level: this.rt.stations.get(r.stations[0])!.level })),
        doorGroup: sab.doorGroup,
      };
    }
    const players: PlayerPublic[] = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, acc: p.acc, alive: p.alive, connected: p.connected, left: p.left }));
    let meeting: MeetingPublic | null = null;
    if (this.meeting) {
      const caller = this.players.get(this.meeting.caller);
      meeting = { stage: this.meeting.stage, caller: this.meeting.caller, callerName: caller?.name ?? '', button: this.meeting.button, voted: Object.keys(this.meeting.votes), results: this.meeting.results };
    }
    const camLeds = new Set<string>();
    for (const p of this.players.values()) {
      if (p.sysPanel?.kind === 'cameras' && p.sysPanel.cam) camLeds.add(p.sysPanel.cam);
      if (p.observing) camLeds.add(p.observing.cam);
    }
    let doorsOpenGt: number | null = null;
    for (const v of this.closedDoors.values()) doorsOpenGt = Math.max(doorsOpenGt ?? 0, v);
    return {
      phase: this.phase, phaseEnds: this.phaseEnds, mapId: this.map.id as MapId, gt: this.gt, players,
      taskProgress: this.gs.taskBarMode === 'never' ? null : this.lastShownProgress,
      sabotage: sabState, sabotageReadyGt: this.sabotageReadyGt, closedDoors: [...this.closedDoors.keys()], doorsOpenGt,
      arrival: this.arrival ? { endsGt: this.gt + this.arrival.remaining, paused: this.isCritical() } : null,
      meeting, buttonReadyGt: this.buttonReadyGt, camLeds: [...camLeds], result: this.result,
      sensors: this.sensors.map((s) => ({ id: s.id, x: s.x, y: s.y, l: s.level })),
      attackInProgress: this.responsible.struggling,
    };
  }
  lastShownProgress = 0;

  buildPriv(p: GPlayer): PrivateState {
    const isImp = p.team === 'impostor';
    const rd = this.map.responsible!;
    const sabStations: PrivateState['sabotageStations'] = [];
    if (isImp || this.practice) {
      for (const sb of this.map.sabotages) for (const sid of sb.activation) {
        const s = this.rt.stations.get(sid)!;
        sabStations.push({ id: sid, sabotage: sb.id, name: `${sb.name}: ${s.name}`, level: s.level, x: s.x, y: s.y });
      }
    }
    let knife: PrivateState['knife'] = null;
    if (p.knife && this.knife) {
      const stage = p.knife.stage;
      const opts = stage < 5 ? this.knife.options[stage] : [];
      const place = stage < 5 ? describePlace(this.map, this.rt, opts, this.gs.knifeComplexity) : { text: '', hints: [] };
      knife = {
        stage,
        objective: stage < 5 ? this.map.knife!.stages[stage].label : this.map.texts.accessGoal,
        clue: p.knife.clue,
        codeParts: p.knife.codeParts,
        hasKnife: p.knife.hasKnife,
        authorized: p.knife.authorized,
        hints: stage < 5 ? place.hints : [{ id: 'resp', name: rd.title, level: rd.level, x: this.responsible.x, y: this.responsible.y }],
      };
    }
    let ventLinks: string[] = [];
    if (p.vent) ventLinks = this.ventLinksFor(p.vent.id).map((l) => l.id);
    const sensor = this.sensors.find((s) => s.owner === p.id);
    return {
      team: p.team, role: p.role, roleName: p.role ? ROLE_BY_ID[p.role].name : 'Sin especialidad',
      tasks: p.tasks.map((t) => taskPrivate(this, t)),
      meetingsLeft: p.meetingsLeft,
      knife,
      ability: abilityPrivate(this, p),
      ventCooldownGt: p.ventCooldownGt,
      ventUntilGt: p.vent?.untilGt ?? 0,
      ventLinks,
      lockerUntilGt: p.locker?.untilGt ?? 0,
      sabotageStations: sabStations,
      tracker: p.tracker ? { readings: this.commsDown() ? [] : p.tracker.readings, endsGt: p.tracker.endsGt } : null,
      sensor: sensor ? { id: sensor.id, x: sensor.x, y: sensor.y, l: sensor.level, endsGt: sensor.endsGt, passes: [...sensor.passes], noSignal: this.commsDown() } : null,
      carrying: p.carrying,
      disguised: !!p.disguise,
      invisible: p.invisible,
      techBoostEndsGt: p.techBoostEndsGt,
      speedBoostEndsGt: p.speedBoostEndsGt,
      responsible: { title: rd.title, name: rd.name },
      vision: this.visionOf(p),
    };
  }

  ventLinksFor(ventId: string): { id: string; name: string; extra: boolean }[] {
    const v = this.map.vents.find((x) => x.id === ventId)!;
    const res = v.links.map((id) => ({ id, name: this.map.vents.find((x) => x.id === id)!.name, extra: false }));
    for (const e of this.escapistLinks) {
      if (e.endsGt < this.gt) continue;
      const other = e.a === ventId ? e.b : e.b === ventId ? e.a : null;
      if (other && !res.some((r) => r.id === other)) res.push({ id: other, name: this.map.vents.find((x) => x.id === other)!.name, extra: true });
    }
    return res;
  }

  refreshKnifeClue(p: GPlayer) {
    if (!p.knife || !this.knife) return;
    const st = p.knife.stage;
    if (st >= 5) {
      p.knife.clue = `Autorización manipulada. ${this.map.texts.accessGoal}: acércate con el arma y mantén ATACAR.`;
    } else {
      const place = describePlace(this.map, this.rt, this.knife.options[st], this.gs.knifeComplexity);
      p.knife.clue = `Pista: ${place.text}.`;
    }
    p.dirtyPriv = true;
  }

  sendPriv(p: GPlayer) {
    p.dirtyPriv = false;
    if (p.left) return;
    this.host.send(p.id, 'priv', this.buildPriv(p));
  }

  openPanel(p: GPlayer, panel: PanelOpen) {
    this.host.send(p.id, 'panel', panel);
  }

  private flush() {
    if (this.dirtyPub) {
      this.dirtyPub = false;
      const pub = this.buildPub();
      for (const p of this.players.values()) if (!p.left) this.host.send(p.id, 'pub', pub);
    }
    for (const p of this.players.values()) if (p.dirtyPriv) this.sendPriv(p);
  }

  private sendSnapshots(now: number) {
    for (const p of this.players.values()) {
      if (!p.connected || p.left) continue;
      const snap: Snapshot = buildSnapshot(this, p, now);
      this.host.send(p.id, 'snap', snap);
    }
  }

  stationName(id: string) { return stationLabel(this, id); }
  simDt() { return SIM_DT; }
}
