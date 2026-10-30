import type { GameStart, PanelOpen, PrivateState, PublicGame, RoomState, ChatMsg, EndResult } from '../shared/protocol';
import type { Net } from './net/Net';

export type Quality = 'bajo' | 'medio' | 'alto';

export interface Prefs {
  name: string;
  quality: Quality;
  reduceMotion: boolean;
  shake: boolean;
  effects: number;
  diagnostics: boolean;
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  abilityKey: string;
  touch: 'auto' | 'on' | 'off';
  uiScale: number;
}

const DEFAULT_PREFS: Prefs = {
  name: '', quality: 'medio', reduceMotion: false, shake: true, effects: 1, diagnostics: false,
  master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.6, abilityKey: 'Q', touch: 'auto', uiScale: 1,
};

const KEY = 'twt.prefs';

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* almacenamiento no disponible */ }
  const p = { ...DEFAULT_PREFS };
  if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) p.reduceMotion = true;
  if ((navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia?.('(pointer: coarse)').matches) p.quality = 'bajo';
  return p;
}

export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
}

type Listener = () => void;

/** Almacén mínimo del cliente con suscripción por claves. */
export class Store {
  room: RoomState | null = null;
  pub: PublicGame | null = null;
  priv: PrivateState | null = null;
  gstart: GameStart | null = null;
  panel: PanelOpen | null = null;
  chat: ChatMsg[] = [];
  result: EndResult | null = null;
  prefs: Prefs = loadPrefs();
  net: Net | null = null;
  view: 'menu' | 'lobby' | 'game' | 'end' = 'menu';
  private listeners = new Map<string, Set<Listener>>();

  on(key: string, l: Listener): () => void {
    let s = this.listeners.get(key);
    if (!s) this.listeners.set(key, (s = new Set()));
    s.add(l);
    return () => s!.delete(l);
  }
  emit(key: string) {
    for (const l of this.listeners.get(key) ?? []) l();
    for (const l of this.listeners.get('*') ?? []) l();
  }
  setPrefs(patch: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...patch };
    savePrefs(this.prefs);
    this.emit('prefs');
  }
  /** Tiempo de juego estimado (avanza solo en exploración). */
  gtNow(): number {
    return this.gtBase + (this.pub?.phase === 'EXPLORACION' && this.gtAt ? performance.now() - this.gtAt : 0);
  }
  gtBase = 0;
  gtAt = 0;
  syncGt(gt: number) {
    const est = this.gtNow();
    // Corrección suave: los temporizadores no saltan.
    if (Math.abs(est - gt) > 400 || !this.gtAt) { this.gtBase = gt; this.gtAt = performance.now(); }
    else { this.gtBase = est + (gt - est) * 0.15; this.gtAt = performance.now(); }
  }
}

export const store = new Store();
