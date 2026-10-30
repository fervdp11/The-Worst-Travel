import type { App } from './App';
import { h, uiRoot } from './dom';

/** Joystick táctil; los botones de acción del HUD ya son objetivos táctiles amplios. */
export class TouchControls {
  el: HTMLElement;
  private knob: HTMLElement;
  private id: number | null = null;
  private cx = 0;
  private cy = 0;

  constructor(private app: App) {
    this.knob = h('div', { class: 'knob' });
    this.el = h('div', { class: 'joy interactive', 'aria-label': 'Joystick' }, this.knob);
    this.el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
  }

  attach() {
    if (!this.el.isConnected) uiRoot().append(this.el);
  }

  private down(e: PointerEvent) {
    this.id = e.pointerId;
    const r = this.el.getBoundingClientRect();
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.move(e);
    e.preventDefault();
  }

  private move(e: PointerEvent) {
    if (this.id !== e.pointerId) return;
    const R = 55;
    let dx = e.clientX - this.cx, dy = e.clientY - this.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const w = this.app.world;
    if (w) w.touchDir = { x: dx / R, y: dy / R };
  }

  private up(e: PointerEvent) {
    if (this.id !== e.pointerId) return;
    this.id = null;
    this.knob.style.transform = '';
    if (this.app.world) this.app.world.touchDir = { x: 0, y: 0 };
  }

  destroy() {
    this.el.remove();
  }
}
