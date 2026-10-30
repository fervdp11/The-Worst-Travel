import { io, Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '../../shared/protocol';
import type { ClientAction, ServerToClient } from '../../shared/protocol';

type Handler = (data: any) => void;

export interface Transport {
  emit(ev: string, data?: unknown): void;
  onMessage(cb: (ev: string, data: unknown) => void): void;
  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void): void;
  close(): void;
  local: boolean;
}

/** Transporte real: Socket.IO contra el servidor que sirve la página (sin URL fija). */
export class SocketTransport implements Transport {
  local = false;
  private s: Socket;
  constructor() {
    this.s = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 3000 });
  }
  emit(ev: string, data?: unknown) { this.s.emit(ev, data); }
  onMessage(cb: (ev: string, data: unknown) => void) { this.s.onAny((ev, data) => cb(ev, data)); }
  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void) {
    this.s.on('connect', () => cb('connected'));
    this.s.on('disconnect', () => cb('disconnected'));
    this.s.io.on('reconnect_attempt', () => cb('reconnecting'));
  }
  close() { this.s.close(); }
}

/**
 * Transporte local para el modo PRÁCTICA: ejecuta el mismo gestor de salas y la
 * misma lógica de partida dentro del navegador. No es multijugador.
 */
export class LocalTransport implements Transport {
  local = true;
  private cb: ((ev: string, data: unknown) => void) | null = null;
  private statusCb: ((s: 'connected') => void) | null = null;
  private session: { handle(ev: string, d: unknown): void; onDisconnect(): void } | null = null;
  private queue: [string, unknown][] = [];
  async init() {
    const { RoomManager } = await import('../../server/room/RoomManager');
    const mgr = new RoomManager();
    this.session = mgr.connect({
      send: (ev, data) => {
        // Clonado estructurado: el cliente nunca comparte objetos con la simulación.
        const copy = data === undefined || data === null ? data : structuredClone(data);
        queueMicrotask(() => this.cb?.(ev, copy));
      },
    });
    for (const [ev, d] of this.queue) this.session.handle(ev, d);
    this.queue = [];
    queueMicrotask(() => this.statusCb?.('connected'));
  }
  emit(ev: string, data?: unknown) {
    const d = data === undefined ? undefined : structuredClone(data);
    if (this.session) this.session.handle(ev, d);
    else this.queue.push([ev, d]);
  }
  onMessage(cb: (ev: string, data: unknown) => void) { this.cb = cb; }
  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void) { this.statusCb = cb; }
  close() { this.session?.onDisconnect(); this.session = null; }
}

const TOKEN_KEY = 'twt.token';

/** Cliente de red: sesión, reloj sincronizado, acciones con identificador y diagnóstico. */
export class Net {
  pid = '';
  token = '';
  handlers = new Map<string, Set<Handler>>();
  /** serverTime ≈ performance.now() + offset */
  offset = 0;
  rtt = 0;
  jitter = 0;
  status: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
  private actSeq = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private samples: { rtt: number; off: number }[] = [];
  statusListeners = new Set<(s: string) => void>();
  bytesIn = 0;

  constructor(public t: Transport, private name: () => string) {
    t.onMessage((ev, data) => this.dispatch(ev, data));
    t.onStatus((s) => {
      this.status = s;
      for (const l of this.statusListeners) l(s);
      if (s === 'connected') this.hello();
    });
    this.pingTimer = setInterval(() => this.ping(), 2000);
  }

  private hello() {
    let token: string | undefined;
    try { token = this.t.local ? undefined : sessionStorage.getItem(TOKEN_KEY) ?? undefined; } catch { /* almacenamiento bloqueado */ }
    this.t.emit('hello', { v: PROTOCOL_VERSION, token, name: this.name() });
    this.ping();
  }

  private ping() {
    if (this.status !== 'connected') return;
    this.t.emit('ping', { t: performance.now() });
  }

  private dispatch(ev: string, data: any) {
    if (ev === 'welcome') {
      this.pid = data.pid;
      this.token = data.token;
      if (!this.t.local) try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch { /* sin almacenamiento */ }
    } else if (ev === 'pong') {
      const now = performance.now();
      const rtt = now - data.t;
      const off = data.st + rtt / 2 - now;
      this.samples.push({ rtt, off });
      if (this.samples.length > 10) this.samples.shift();
      const best = [...this.samples].sort((a, b) => a.rtt - b.rtt)[0];
      const prevRtt = this.rtt;
      this.rtt = rtt;
      this.jitter = this.jitter * 0.8 + Math.abs(rtt - prevRtt) * 0.2;
      // Ajuste suave del desfase para que los temporizadores no salten.
      this.offset = this.samples.length === 1 ? best.off : this.offset + (best.off - this.offset) * 0.3;
    } else if (ev === 'snap' && data) {
      this.bytesIn += 1;
    }
    const hs = this.handlers.get(ev);
    if (hs) for (const h of hs) h(data);
  }

  on<E extends keyof ServerToClient>(ev: E, h: (d: Parameters<ServerToClient[E]>[0]) => void): () => void {
    let s = this.handlers.get(ev);
    if (!s) this.handlers.set(ev, (s = new Set()));
    s.add(h as Handler);
    return () => s!.delete(h as Handler);
  }

  emit(ev: string, data?: unknown) { this.t.emit(ev, data); }

  act(a: ClientAction): string {
    const id = `${this.pid.slice(0, 4)}${Date.now().toString(36)}${(++this.actSeq).toString(36)}`;
    this.t.emit('act', { ...a, id });
    return id;
  }

  serverNow(): number { return performance.now() + this.offset; }

  destroy() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.t.close();
    this.handlers.clear();
  }
}
