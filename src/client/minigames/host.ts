import type { MapId } from '../../shared/maps/types';
import type { GameEvent, PanelOpen } from '../../shared/protocol';
import { makeCanvas } from '../art/draw';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from '../ui/App';
import { h, ICONS } from '../ui/dom';
import { MG, MGCtor } from './base';
import { KAuth, KCompartment, KDocs, KKeypad, KSearch } from './knife';
import { CritCoolant, CritKeyConfirm, CritLevers, CritNavAlign, CritPatch, CritPower, CritPumps, CritRelief, CritSeal, CritStabilize, CritTelegraph, CritValves, RepComms, RepLights } from './repairs';
import { Assist, BrakesRead, BrakesSet, Cooking, Dishes, Drink, Filter, Fuses, Luggage, OrdersPick, OrdersServe, Pressure, Roof, Signal, Toilet, Wiring } from './tasks';
import { Ballast, BallastTrim, Bilge, CabinPressure, CabinPressureDoor, Carts, Seal, Sorting } from './tasks2';

/** Registro: identificador de minijuego → implementación con su propia acción. */
export const REGISTRY: Record<string, MGCtor> = {
  orders_pick: OrdersPick, orders_serve: OrdersServe, cooking: Cooking, drink: Drink, dishes: Dishes, toilet: Toilet,
  wiring: Wiring, fuses: Fuses, pressure: Pressure, filter: Filter, assist: Assist, luggage: Luggage, roof: Roof,
  signal: Signal, brakes_read: BrakesRead, brakes_set: BrakesSet, bilge: Bilge, seal: Seal, ballast: Ballast,
  ballast_trim: BallastTrim, carts: Carts, sorting: Sorting, cabinPressure: CabinPressure, cabinPressure_door: CabinPressureDoor,
  rep_lights: RepLights, rep_comms: RepComms, crit_levers: CritLevers, crit_keyconfirm: CritKeyConfirm, crit_coolant: CritCoolant,
  crit_relief: CritRelief, crit_patch: CritPatch, crit_pumps: CritPumps, crit_stabilize: CritStabilize, crit_telegraph: CritTelegraph,
  crit_valves: CritValves, crit_seal: CritSeal, crit_power: CritPower, crit_navalign: CritNavAlign,
  k_docs: KDocs, k_search: KSearch, k_compartment: KCompartment, k_keypad: KKeypad, k_auth: KAuth,
};

/** Contenedor DOM del minijuego: transición breve, puntero unificado y bucle solo mientras está abierto. */
export class MinigameHost {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mg: MG;
  private raf = 0;
  private last = performance.now();
  private hintEl: HTMLElement;
  private panelEl: HTMLElement;
  private closing = false;
  private lastPtr: { x: number; y: number } | null = null;

  constructor(private app: App, private p: Extract<PanelOpen, { kind: 'minigame' }>, private onClose: () => void) {
    const Ctor = REGISTRY[p.mg];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas = makeCanvas(MG.W * dpr, MG.H * dpr);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.mg = new Ctor({
      send: (part, ans) => { store.net?.act({ k: 'step', ref: p.ref, part, ans }); audio.sfx('step'); },
      sfx: (s) => audio.sfx(s),
    }, p.puzzle, p.part, p.theme as MapId);
    this.mg.init();
    this.hintEl = h('div', { class: 'hint' });
    this.panelEl = h('div', { class: 'panel mg' },
      h('div', { class: 'bar' }, h('h3', null, p.title), h('button', { class: 'btn icon ghost', title: 'Cerrar (Esc)', onclick: () => this.onClose(), html: ICONS.close })),
      this.hintEl, this.canvas);
    this.el = h('div', { class: 'mg-back' }, this.panelEl);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.onClose(); });
    const pos = (e: PointerEvent) => { const r = this.canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * MG.W, y: ((e.clientY - r.top) / r.height) * MG.H }; };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      const q = pos(e);
      this.mg.ptr = { ...q, down: true };
      this.lastPtr = q;
      if (!this.mg.busy) this.mg.down(q.x, q.y);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const q = pos(e);
      this.mg.ptr.x = q.x; this.mg.ptr.y = q.y;
      if (this.mg.busy) return;
      this.mg.move(q.x, q.y);
      if (this.mg.ptr.down && this.lastPtr) this.mg.dragBy(q.x - this.lastPtr.x, q.y - this.lastPtr.y);
      this.lastPtr = q;
    });
    const up = (e: PointerEvent) => { const q = pos(e); this.mg.ptr.down = false; this.lastPtr = null; if (!this.mg.busy) this.mg.up(q.x, q.y); };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    document.getElementById('ui')!.append(this.el);
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.mg.frame(this.ctx, dt);
      if (this.hintEl.textContent !== this.mg.hint) this.hintEl.textContent = this.mg.hint;
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    void this.app;
  }

  onServer(e: GameEvent) {
    if (e.e === 'stepOk' && e.ref === this.p.ref) {
      this.mg.onOk(e.done);
      if (e.done) this.finish(e.reveal);
    } else if (e.e === 'stepBad' && e.ref === this.p.ref) {
      this.mg.onBad();
      this.mg.hint = e.msg;
      this.panelEl.classList.remove('bad'); void this.panelEl.offsetWidth; this.panelEl.classList.add('bad');
    }
  }

  /** Confirmación breve (0,2–0,5 s) y cierre; el servidor ya liberó al jugador. */
  private finish(reveal?: string) {
    if (this.closing) return;
    this.closing = true;
    this.panelEl.classList.add('ok');
    if (reveal) this.mg.hint = reveal;
    setTimeout(() => {
      if (store.panel?.kind === 'minigame' && store.panel.ref === this.p.ref) store.panel = null;
      this.destroy();
    }, reveal ? 1700 : 420);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }
}
