import { h } from './dom';

/** Pantalla de carga con barra de progreso real. */
export class Loading {
  private el: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private lbl: HTMLElement | null = null;

  show(p: number, label: string) {
    if (!this.el) {
      this.bar = h('i');
      this.lbl = h('div', { class: 'lbl' });
      this.el = h('div', { class: 'loading' },
        h('div', { class: 'logo' }, h('span', { class: 'the' }, 'THE'), h('span', { class: 'main' }, 'Worst ', h('span', { class: 'w' }, 'Travel'))),
        h('div', { class: 'bar' }, this.bar), this.lbl);
      document.getElementById('ui')!.append(this.el);
    }
    if (!this.el.isConnected) document.getElementById('ui')!.append(this.el);
    this.bar!.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    this.lbl!.textContent = label;
  }

  hide() {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.style.transition = 'opacity 200ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }
}
