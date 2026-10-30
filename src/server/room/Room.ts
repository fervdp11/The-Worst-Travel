import { CHAT_MAX, COLORS, COUNTDOWN_MS, MAX_PLAYERS, MIN_PLAYERS, RECONNECT_GRACE_MS, SIM_HZ, BASE_SPEED, ACCESSORIES } from '../../shared/constants';
import { getRuntime } from '../../shared/maps';
import type { MapId } from '../../shared/maps/types';
import { ALL_OPEN } from '../../shared/maps/runtime';
import { stepMove } from '../../shared/movement';
import type { ActionMsg, ChatMsg, EndResult, EntSnap, LobbyPlayer, RoomState, ServerToClient } from '../../shared/protocol';
import type { RoleId, Team } from '../../shared/roles';
import { defaultSettings, presetSettings, RoomSettings, sanitizeSettings, validateSettings, PresetId } from '../../shared/settings';
import { Game } from '../game/Game';

export interface Conn {
  send<E extends keyof ServerToClient>(ev: E, data: Parameters<ServerToClient[E]>[0]): void;
}

export interface Member {
  id: string;
  token: string;
  name: string;
  color: number;
  acc: number;
  conn: Conn | null;
  connected: boolean;
  disconnectedAt: number;
  loaded: string | null;
  inGame: boolean;
  lastChat: number;
  lobby: { x: number; y: number; level: string; f: 1 | -1; inputs: { s: number; dx: number; dy: number }[]; ack: number; lastQueued: number; credit: number; moving: boolean };
}

export class Room {
  members = new Map<string, Member>();
  hostId = '';
  settings: RoomSettings;
  mapId: MapId;
  configVersion = 1;
  game: Game | null = null;
  countdownEnds: number | null = null;
  timer: ReturnType<typeof setInterval> | null = null;
  tickNo = 0;
  lobbyRt = getRuntime('lobby');
  resetAt: number | null = null;
  hostAwaySince: number | null = null;

  constructor(
    public code: string,
    public practice: boolean,
    opts: { mapId: MapId; maxPlayers: number; preset: PresetId },
    private onEmpty: (r: Room) => void,
    public practiceTeam: Team = 'worker',
    public practiceRole: RoleId | null = null,
  ) {
    this.mapId = opts.mapId;
    this.settings = presetSettings(opts.preset, defaultSettings());
    this.settings.game.maxPlayers = practice ? 1 : Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, opts.maxPlayers));
    if (practice) this.settings.game.maxPlayers = MIN_PLAYERS;
    this.timer = setInterval(() => this.tick(), 1000 / SIM_HZ);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ------------------------------------------------------------- miembros
  freeColor(pref?: number): number {
    const used = new Set([...this.members.values()].map((m) => m.color));
    if (pref !== undefined && pref >= 0 && pref < COLORS.length && !used.has(pref)) return pref;
    for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i;
    return 0;
  }

  uniqueName(name: string, selfId?: string): string {
    let clean = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Empleado';
    const taken = new Set([...this.members.values()].filter((m) => m.id !== selfId).map((m) => m.name.toLowerCase()));
    let n = 2;
    const base = clean;
    while (taken.has(clean.toLowerCase())) clean = `${base.slice(0, 13)} ${n++}`;
    return clean;
  }

  addMember(id: string, token: string, name: string, conn: Conn): Member | string {
    if (this.game && !this.practice) return 'La partida ya ha empezado.';
    const cap = this.practice ? 1 : this.settings.game.maxPlayers;
    if (this.members.size >= cap) return 'La sala está llena.';
    const spawn = this.lobbyRt.def.spawn[this.members.size % this.lobbyRt.def.spawn.length];
    const m: Member = {
      id, token, name: this.uniqueName(name), color: this.freeColor(), acc: Math.floor(Math.random() * 9),
      conn, connected: true, disconnectedAt: 0, loaded: null, inGame: false, lastChat: 0,
      lobby: { x: spawn.x, y: spawn.y, level: spawn.level, f: 1, inputs: [], ack: 0, lastQueued: 0, credit: 0, moving: false },
    };
    this.members.set(id, m);
    if (!this.hostId || !this.members.get(this.hostId)) this.hostId = id;
    this.broadcastRoom();
    if (!this.game) this.sendChatSystem(`${m.name} se ha unido a la sala.`);
    return m;
  }

  reconnect(m: Member, conn: Conn) {
    m.conn = conn;
    m.connected = true;
    m.lobby.inputs = [];
    if (m.id === this.hostId) this.hostAwaySince = null;
    this.broadcastRoom();
    if (this.game && m.inGame) {
      conn.send('gstart', { mapId: this.game.map.id as MapId, seed: this.game.seed, configVersion: this.game.configVersion, you: m.id, settings: this.game.settingsAll });
      this.game.onReconnect(m.id);
    }
  }

  disconnect(m: Member) {
    m.conn = null;
    m.connected = false;
    m.disconnectedAt = Date.now();
    if (m.id === this.hostId) this.hostAwaySince = Date.now();
    if (this.game && m.inGame) this.game.onDisconnect(m.id);
    if (this.countdownEnds) this.cancelCountdown('Se ha desconectado alguien.');
    this.broadcastRoom();
  }

  removeMember(id: string) {
    const m = this.members.get(id);
    if (!m) return;
    this.members.delete(id);
    if (this.game && m.inGame) this.game.onLeave(id);
    if (this.hostId === id) this.transferHost();
    if (this.countdownEnds) this.cancelCountdown('Alguien ha salido.');
    if (!this.members.size) {
      this.destroy();
      this.onEmpty(this);
      return;
    }
    if (!this.game) this.sendChatSystem(`${m.name} ha salido.`);
    this.broadcastRoom();
  }

  transferHost() {
    const next = [...this.members.values()].find((m) => m.connected && m.id !== this.hostId) ?? [...this.members.values()].find((m) => m.id !== this.hostId);
    if (next) {
      this.hostId = next.id;
      this.hostAwaySince = null;
      this.sendChatSystem(`${next.name} es ahora el anfitrión.`);
    }
  }

  // ------------------------------------------------------------- envío
  send<E extends keyof ServerToClient>(pid: string, ev: E, data: Parameters<ServerToClient[E]>[0]) {
    const m = this.members.get(pid);
    if (m?.conn) m.conn.send(ev, data);
  }
  broadcast<E extends keyof ServerToClient>(ev: E, data: Parameters<ServerToClient[E]>[0]) {
    for (const m of this.members.values()) m.conn?.send(ev, data);
  }

  connectedCount() {
    return [...this.members.values()].filter((m) => m.connected).length;
  }

  startBlockers(): string[] {
    const b: string[] = [];
    const n = this.connectedCount();
    const min = this.practice ? 1 : MIN_PLAYERS;
    if (n < min) b.push(`Se necesitan al menos ${min} personas conectadas (hay ${n}).`);
    if (!this.practice) for (const i of validateSettings(this.settings, n)) b.push(i.msg);
    const notLoaded = [...this.members.values()].filter((m) => m.connected && m.loaded !== this.mapId);
    if (notLoaded.length) b.push(`Cargando el mapa: ${notLoaded.map((m) => m.name).join(', ')}.`);
    if (this.game) b.push('La partida está en curso.');
    return b;
  }

  stateFor(): RoomState {
    const players: LobbyPlayer[] = [...this.members.values()].map((m) => ({ id: m.id, name: m.name, color: m.color, acc: m.acc, connected: m.connected, host: m.id === this.hostId, loaded: m.loaded === this.mapId }));
    const blockers = this.startBlockers();
    return {
      code: this.code, practice: this.practice, hostId: this.hostId, phase: this.game ? this.game.phase : 'ESPERA', mapId: this.mapId,
      players, settings: this.settings, configVersion: this.configVersion,
      issues: this.practice ? [] : validateSettings(this.settings, this.connectedCount()),
      countdownEnds: this.countdownEnds, canStart: blockers.length === 0 && !this.countdownEnds, startBlockers: blockers,
      practiceTeam: this.practice ? this.practiceTeam : undefined, practiceRole: this.practice ? this.practiceRole : undefined,
    };
  }

  broadcastRoom() {
    const st = this.stateFor();
    this.broadcast('room', st);
  }

  sendChatSystem(text: string) {
    this.broadcast('chat', { ch: 'lobby', from: '', name: 'Terminal', color: -1, text, t: Date.now() });
  }

  // ------------------------------------------------------------- acciones de sala
  onSettings(pid: string, patch: unknown, mapId?: MapId): string | null {
    if (pid !== this.hostId) return 'Solo el anfitrión puede cambiar los ajustes.';
    if (this.game) return 'No se pueden cambiar ajustes durante la partida.';
    if (this.countdownEnds) this.cancelCountdown('Ajustes modificados.');
    if (mapId && mapId !== this.mapId) {
      if (!['train', 'ship', 'plane'].includes(mapId)) return 'Mapa desconocido.';
      // Cambiar de mapa descarta la preparación de la próxima partida pero conserva jugadores y ajustes.
      this.mapId = mapId;
    }
    if (patch) {
      const p = patch as { preset?: string; practiceTeam?: Team; practiceRole?: RoleId | null };
      if (p.preset === 'clasico' || p.preset === 'equilibrado') this.settings = presetSettings(p.preset, this.settings);
      else this.settings = sanitizeSettings(patch, this.settings);
      if (this.practice) {
        if (p.practiceTeam === 'worker' || p.practiceTeam === 'impostor') this.practiceTeam = p.practiceTeam;
        if (p.practiceRole !== undefined) this.practiceRole = p.practiceRole;
      }
      if (!this.practice && this.settings.game.maxPlayers < this.members.size) this.settings.game.maxPlayers = Math.max(this.members.size, MIN_PLAYERS);
    }
    this.configVersion++;
    this.broadcastRoom();
    return null;
  }

  onStart(pid: string): string | null {
    if (pid !== this.hostId) return 'Solo el anfitrión puede iniciar.';
    const b = this.startBlockers();
    if (b.length) return b[0];
    if (this.countdownEnds) return null;
    this.countdownEnds = Date.now() + (this.practice ? 600 : COUNTDOWN_MS);
    this.broadcastRoom();
    return null;
  }

  cancelCountdown(reason: string) {
    if (!this.countdownEnds) return;
    this.countdownEnds = null;
    this.sendChatSystem(`Cuenta atrás cancelada: ${reason}`);
    this.broadcastRoom();
  }

  onCancel(pid: string) {
    if (pid === this.hostId) this.cancelCountdown('El anfitrión la ha detenido.');
  }

  onCustom(pid: string, d: { color?: number; acc?: number; name?: string }) {
    const m = this.members.get(pid);
    if (!m || (this.game && m.inGame)) return;
    if (typeof d.color === 'number') m.color = this.freeColor(d.color) === d.color ? d.color : m.color;
    if (typeof d.acc === 'number' && d.acc >= 0 && d.acc < ACCESSORIES.length) m.acc = Math.floor(d.acc);
    if (typeof d.name === 'string') m.name = this.uniqueName(d.name, m.id);
    this.broadcastRoom();
  }

  onLoaded(pid: string, mapId: MapId) {
    const m = this.members.get(pid);
    if (!m) return;
    if (this.game && m.inGame && this.game.map.id === mapId) this.game.markReady(pid);
    if (m.loaded === mapId) return;
    m.loaded = mapId;
    this.broadcastRoom();
  }

  onChat(pid: string, text: string) {
    const m = this.members.get(pid);
    if (!m) return;
    const now = Date.now();
    if (now - m.lastChat < 450) return;
    const clean = String(text ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, CHAT_MAX);
    if (!clean) return;
    m.lastChat = now;
    const base = { from: m.id, name: m.name, color: m.color, text: clean, t: now };
    const g = this.game;
    if (!g || !m.inGame || g.phase === 'FINAL') {
      this.broadcast('chat', { ...base, ch: 'lobby' });
      return;
    }
    const gp = g.player(m.id);
    if (!gp) return;
    if (!gp.alive) {
      // Chat de expulsados: nunca llega a los vivos.
      for (const o of g.players.values()) if (!o.alive) this.send(o.id, 'chat', { ...base, ch: 'ghost' } as ChatMsg);
      return;
    }
    if (g.phase === 'DISCUSION' || g.phase === 'VOTACION' || g.phase === 'RESULTADOS') {
      this.broadcast('chat', { ...base, ch: 'meeting' });
    } else {
      this.send(m.id, 'ev', { e: 'toast', text: 'Durante la exploración no hay chat entre vivos.', tone: 'warn' });
    }
  }

  onInput(pid: string, msg: { s: number; d: number[] }) {
    const m = this.members.get(pid);
    if (!m) return;
    if (this.game && m.inGame) { this.game.onInput(pid, msg); return; }
    if (!Number.isInteger(msg?.s) || !Array.isArray(msg.d)) return;
    const L = m.lobby;
    for (let i = 0; i + 1 < msg.d.length && i < 16; i += 2) {
      const s = msg.s + i / 2;
      if (s <= L.lastQueued) continue;
      L.inputs.push({ s, dx: Math.max(-100, Math.min(100, Math.round(Number(msg.d[i]) || 0))), dy: Math.max(-100, Math.min(100, Math.round(Number(msg.d[i + 1]) || 0))) });
      L.lastQueued = s;
    }
    while (L.inputs.length > 8) L.ack = L.inputs.shift()!.s;
  }

  onAction(pid: string, msg: ActionMsg) {
    if (this.game) this.game.onAction(pid, msg);
    else this.send(pid, 'ack', { id: msg?.id, ok: true });
  }

  // ------------------------------------------------------------- partida
  private startGame() {
    this.countdownEnds = null;
    const players = [...this.members.values()].filter((m) => m.connected);
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const frozen: RoomSettings = structuredClone(this.settings);
    this.configVersion++;
    for (const m of players) m.inGame = true;
    this.game = new Game(
      {
        send: (pid, ev, data) => this.send(pid, ev, data),
        onEnd: (r) => this.onGameEnd(r),
      },
      {
        mapId: this.mapId, settings: frozen, seed, configVersion: this.configVersion,
        players: players.map((m) => ({ id: m.id, name: m.name, color: m.color, acc: m.acc, connected: m.connected })),
        practice: this.practice ? { team: this.practiceTeam, role: this.practiceRole } : null,
      },
    );
    for (const m of players) m.conn?.send('gstart', { mapId: this.mapId, seed, configVersion: this.configVersion, you: m.id, settings: frozen });
    this.broadcastRoom();
  }

  private onGameEnd(_r: EndResult) {
    this.resetAt = Date.now() + 11_000;
    this.broadcastRoom();
  }

  private resetToLobby() {
    this.resetAt = null;
    this.game = null;
    for (const m of [...this.members.values()]) {
      m.inGame = false;
      const sp = this.lobbyRt.def.spawn[Math.floor(Math.random() * this.lobbyRt.def.spawn.length)];
      Object.assign(m.lobby, { x: sp.x, y: sp.y, level: sp.level, inputs: [], moving: false });
      if (!m.connected && Date.now() - m.disconnectedAt > RECONNECT_GRACE_MS) this.removeMember(m.id);
    }
    if (!this.members.size) return;
    this.broadcastRoom();
  }

  onBack(pid: string) {
    // El cliente vuelve a la vista de sala; la sala se reinicia sola tras el final.
    const m = this.members.get(pid);
    if (m && this.game?.ended && !this.resetAt) this.resetToLobby();
  }

  // ------------------------------------------------------------- bucle
  tick() {
    this.tickNo++;
    const now = Date.now();
    if (this.countdownEnds) {
      if (this.startBlockers().length) this.cancelCountdown('Ya no se cumplen los requisitos.');
      else if (now >= this.countdownEnds) this.startGame();
    }
    if (this.hostAwaySince && !this.game && now - this.hostAwaySince > 8000) this.transferHost();
    for (const m of [...this.members.values()]) {
      if (!m.connected && now - m.disconnectedAt > RECONNECT_GRACE_MS && !(this.game && m.inGame && !this.game.ended)) this.removeMember(m.id);
    }
    if (this.game) {
      this.game.tick();
      if (this.resetAt && now >= this.resetAt) this.resetToLobby();
      // Jugadores de la sala que no están en la partida siguen en la terminal.
    }
    this.lobbyTick(now);
  }

  private lobbyTick(now: number) {
    const lobbyMembers = [...this.members.values()].filter((m) => !m.inGame);
    if (!lobbyMembers.length) return;
    const speed = BASE_SPEED;
    for (const m of lobbyMembers) {
      const L = m.lobby;
      L.credit = Math.min(L.credit + 1, 4);
      let moved = false;
      while (L.credit >= 1 && L.inputs.length) {
        const inp = L.inputs.shift()!;
        L.credit--;
        L.ack = inp.s;
        if (inp.dx > 10) L.f = 1; else if (inp.dx < -10) L.f = -1;
        const r = stepMove(this.lobbyRt, L.level, L.x, L.y, inp.dx, inp.dy, speed, ALL_OPEN, false);
        if (r.x !== L.x || r.y !== L.y) moved = true;
        L.x = r.x; L.y = r.y;
      }
      L.moving = moved;
    }
    if (this.tickNo % 2 !== 0) return;
    for (const m of lobbyMembers) {
      if (!m.conn) continue;
      const e: EntSnap[] = lobbyMembers.filter((o) => o !== m).map((o) => ({
        h: o.id, k: 'p', x: Math.round(o.lobby.x * 10) / 10, y: Math.round(o.lobby.y * 10) / 10, l: o.lobby.level, f: o.lobby.f,
        a: !o.connected ? 'stopped' : o.lobby.moving ? 'walk' : 'idle', n: o.name, c: o.color, ac: o.acc, dc: o.connected ? undefined : 1,
      }));
      m.conn.send('snap', { t: now, gt: 0, me: { x: m.lobby.x, y: m.lobby.y, l: m.lobby.level, ack: m.lobby.ack, st: 'free', f: m.lobby.f, vis: 4000, speed }, e });
    }
  }
}
