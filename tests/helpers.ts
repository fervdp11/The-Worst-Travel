import { Game } from '../src/server/game/Game';
import type { MapId } from '../src/shared/maps/types';
import type { ClientAction, GameEvent, PanelOpen, PrivateState, PublicGame } from '../src/shared/protocol';
import { defaultSettings, RoomSettings } from '../src/shared/settings';

export interface Harness {
  game: Game;
  now: { t: number };
  sent: { pid: string; ev: string; data: any }[];
  priv: Map<string, PrivateState>;
  pub: PublicGame | null;
  panels: Map<string, PanelOpen | null>;
  events: Map<string, GameEvent[]>;
  act(pid: string, a: ClientAction): { ok: boolean; msg?: string };
  ticks(n: number): void;
  advanceMs(ms: number): void;
  ids: string[];
}

let actSeq = 0;

export function makeGame(mapId: MapId, n = 4, mod?: (s: RoomSettings) => void, practice?: Game['practice']): Harness {
  const settings = defaultSettings();
  mod?.(settings);
  const now = { t: 1_000_000 };
  const sent: Harness['sent'] = [];
  const priv = new Map<string, PrivateState>();
  const panels = new Map<string, PanelOpen | null>();
  const events = new Map<string, GameEvent[]>();
  const acks = new Map<string, { ok: boolean; msg?: string }>();
  const h: Harness = {
    game: null as unknown as Game, now, sent, priv, pub: null, panels, events, ids: [],
    act(pid, a) {
      const id = `a${++actSeq}`;
      h.game.onAction(pid, { ...a, id } as never);
      return acks.get(id) ?? { ok: false, msg: 'sin ack' };
    },
    ticks(k) {
      for (let i = 0; i < k; i++) { now.t += 1000 / 30; h.game.tick(); }
    },
    advanceMs(ms) { h.ticks(Math.ceil(ms / (1000 / 30))); },
  };
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Jugador ${i}`, color: i, acc: 0, connected: true }));
  h.ids = players.map((p) => p.id);
  h.game = new Game({
    send: (pid, ev, data) => {
      sent.push({ pid, ev, data });
      if (ev === 'priv') priv.set(pid, data as PrivateState);
      if (ev === 'pub') h.pub = data as PublicGame;
      if (ev === 'panel') panels.set(pid, data as PanelOpen | null);
      if (ev === 'ev') { const l = events.get(pid) ?? []; l.push(data as GameEvent); events.set(pid, l); }
      if (ev === 'ack') acks.set((data as { id: string }).id, data as { ok: boolean; msg?: string });
    },
    onEnd: () => {},
  }, { mapId, settings, seed: 12345, configVersion: 1, players, clock: () => now.t, practice });
  return h;
}

/** Coloca a un jugador en la posición de una estación (para pruebas de lógica). */
export function teleportTo(h: Harness, pid: string, stationId: string) {
  const s = h.game.rt.stations.get(stationId)!;
  const p = h.game.player(pid)!;
  p.level = s.level;
  const f = h.game.rt.nearestFree(s.level, s.x, s.y);
  p.x = f.x; p.y = f.y;
}

export function startExploration(h: Harness) {
  h.advanceMs(5200);
}
