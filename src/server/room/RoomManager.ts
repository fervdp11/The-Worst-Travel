import { MAX_PLAYERS, MIN_PLAYERS } from '../../shared/constants';
import type { MapId } from '../../shared/maps/types';
import { PROTOCOL_VERSION } from '../../shared/protocol';
import type { ActionMsg } from '../../shared/protocol';
import { randomId } from '../../shared/rng';
import { ROLE_BY_ID, RoleId, Team } from '../../shared/roles';
import type { PresetId } from '../../shared/settings';
import { Conn, Room } from './Room';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAPS: MapId[] = ['train', 'ship', 'plane'];

interface Session {
  pid: string;
  token: string;
  code: string | null;
  seen: number;
}

/**
 * Gestiona salas y sesiones. Es independiente del transporte: lo usan el
 * servidor Socket.IO y el modo práctica local (bucle en el navegador).
 */
export class RoomManager {
  rooms = new Map<string, Room>();
  sessions = new Map<string, Session>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Las sesiones sin sala y sin actividad se olvidan para no crecer sin límite.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    (this.sweeper as unknown as { unref?: () => void }).unref?.();
  }

  sweep(now = Date.now()) {
    for (const [t, s] of this.sessions) {
      const inRoom = s.code !== null && this.rooms.get(s.code)?.members.has(s.pid);
      if (!inRoom && now - s.seen > 15 * 60_000) this.sessions.delete(t);
    }
  }

  private newCode(): string {
    for (;;) {
      let c = '';
      const bytes = new Uint8Array(5);
      globalThis.crypto.getRandomValues(bytes);
      for (const b of bytes) c += CODE_CHARS[b % CODE_CHARS.length];
      if (!this.rooms.has(c)) return c;
    }
  }

  connect(conn: Conn): ClientSession {
    return new ClientSession(this, conn);
  }

  createRoom(practice: boolean, opts: { mapId: MapId; maxPlayers: number; preset: PresetId }, team?: Team, role?: RoleId | null): Room {
    const code = this.newCode();
    const room = new Room(code, practice, opts, (r) => this.rooms.delete(r.code), team, role ?? null);
    this.rooms.set(code, room);
    return room;
  }

  stats() {
    return { rooms: this.rooms.size, sessions: this.sessions.size };
  }
}

export class ClientSession {
  session: Session | null = null;
  constructor(private mgr: RoomManager, private conn: Conn) {}

  private get room(): Room | null {
    const c = this.session?.code;
    return c ? this.mgr.rooms.get(c) ?? null : null;
  }

  handle(ev: string, d: any) {
    if (this.session) this.session.seen = Date.now();
    try {
      this.dispatch(ev, d ?? {});
    } catch (err) {
      console.error('Error al procesar', ev, err);
    }
  }

  private err(code: string, msg: string) {
    this.conn.send('err', { code, msg });
  }

  private dispatch(ev: string, d: any) {
    if (ev === 'hello') return this.hello(d);
    if (ev === 'ping') return this.conn.send('pong', { t: Number(d.t) || 0, st: Date.now() });
    if (!this.session) { if (ev !== 'inp' && ev !== 'loaded') this.err('nosession', 'Sesión no iniciada.'); return; }
    const room = this.room;
    const pid = this.session.pid;
    switch (ev) {
      case 'create': {
        if (room) room.removeMember(pid);
        const mapId = MAPS.includes(d.mapId) ? d.mapId : 'train';
        const preset: PresetId = d.preset === 'clasico' ? 'clasico' : d.preset === 'personalizado' ? 'personalizado' : 'equilibrado';
        const r = this.mgr.createRoom(false, { mapId, maxPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Number(d.maxPlayers) || 8)), preset });
        this.enter(r, String(d.name ?? ''));
        return;
      }
      case 'join': {
        const code = String(d.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const r = this.mgr.rooms.get(code);
        if (!r || r.practice) return this.err('noroom', 'No existe ninguna sala con ese código.');
        if (room && room !== r) room.removeMember(pid);
        if (r.members.has(pid)) { r.reconnect(r.members.get(pid)!, this.conn); this.session.code = r.code; return; }
        this.enter(r, String(d.name ?? ''));
        return;
      }
      case 'practice': {
        if (room) room.removeMember(pid);
        const mapId = MAPS.includes(d.mapId) ? d.mapId : 'train';
        const team: Team = d.team === 'impostor' ? 'impostor' : 'worker';
        const role: RoleId | null = d.role && ROLE_BY_ID[d.role as RoleId]?.team === team ? d.role : null;
        const r = this.mgr.createRoom(true, { mapId, maxPlayers: 1, preset: 'equilibrado' }, team, role);
        this.enter(r, String(d.name ?? ''));
        return;
      }
      case 'leave':
        if (room) room.removeMember(pid);
        this.session.code = null;
        this.conn.send('room', null);
        return;
    }
    if (!room) return this.err('noroom', 'No estás en ninguna sala.');
    switch (ev) {
      case 'settings': { const e = room.onSettings(pid, d.patch, d.mapId); if (e) this.err('settings', e); return; }
      case 'start': { const e = room.onStart(pid); if (e) this.err('start', e); return; }
      case 'cancel': room.onCancel(pid); return;
      case 'custom': room.onCustom(pid, d); return;
      case 'chat': room.onChat(pid, d.text); return;
      case 'inp': room.onInput(pid, d); return;
      case 'act': room.onAction(pid, d as ActionMsg); return;
      case 'back': room.onBack(pid); return;
      case 'loaded': room.onLoaded(pid, d.mapId); return;
    }
  }

  private enter(r: Room, name: string) {
    const res = r.addMember(this.session!.pid, this.session!.token, name, this.conn);
    if (typeof res === 'string') {
      this.err('join', res);
      if (!r.members.size) { r.destroy(); this.mgr.rooms.delete(r.code); }
      return;
    }
    this.session!.code = r.code;
    r.broadcastRoom();
  }

  private hello(d: { v?: number; token?: string; name?: string }) {
    if (d.v !== PROTOCOL_VERSION) {
      this.err('version', `Versión incompatible (cliente ${d.v}, servidor ${PROTOCOL_VERSION}). Recarga la página.`);
      return;
    }
    const known = d.token ? this.mgr.sessions.get(d.token) : undefined;
    if (known) {
      this.session = known;
      this.conn.send('welcome', { pid: known.pid, token: known.token, v: PROTOCOL_VERSION, serverTime: Date.now() });
      const r = this.room;
      const m = r?.members.get(known.pid);
      if (r && m) r.reconnect(m, this.conn);
      else { known.code = null; this.conn.send('room', null); }
      return;
    }
    const s: Session = { pid: randomId(10), token: randomId(24), code: null, seen: Date.now() };
    this.mgr.sessions.set(s.token, s);
    this.session = s;
    this.conn.send('welcome', { pid: s.pid, token: s.token, v: PROTOCOL_VERSION, serverTime: Date.now() });
    this.conn.send('room', null);
  }

  onDisconnect() {
    const r = this.room;
    const m = r?.members.get(this.session?.pid ?? '');
    if (r && m && m.conn === this.conn) r.disconnect(m);
  }
}
