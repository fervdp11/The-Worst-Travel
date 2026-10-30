import { COLORS } from '../../shared/constants';
import { store } from '../state';
import { h } from './dom';

/** Chat ordenado: vivos en espera y reunión; los expulsados tienen su propio canal. */
export class Chat {
  el: HTMLElement;
  private msgs: HTMLElement;
  private input: HTMLInputElement;
  private off: () => void;
  private shown = 0;

  constructor(private mode: 'lobby' | 'meeting') {
    this.msgs = h('div', { class: 'msgs scroll' });
    this.input = h('input', { type: 'text', maxLength: 160, placeholder: mode === 'lobby' ? 'Escribe en la sala…' : 'Escribe en la reunión…', 'aria-label': 'Mensaje' }) as HTMLInputElement;
    const form = h('form', { onsubmit: (e: Event) => { e.preventDefault(); this.send(); } }, this.input, h('button', { class: 'btn', type: 'submit' }, 'Enviar'));
    this.el = h('div', { class: 'chat' }, h('h3', { style: 'margin-bottom:6px' }, mode === 'lobby' ? 'Chat' : 'Discusión'), this.msgs, form);
    this.off = store.on('chat', () => this.render());
    this.render();
  }

  private visible() {
    const me = store.pub?.players.find((p) => p.id === store.net?.pid);
    const ghost = me ? !me.alive : false;
    return store.chat.filter((c) => (this.mode === 'lobby' ? c.ch === 'lobby' : c.ch === 'meeting' || (ghost && c.ch === 'ghost')));
  }

  private render() {
    const list = this.visible();
    if (list.length < this.shown) { this.msgs.innerHTML = ''; this.shown = 0; }
    for (let i = this.shown; i < list.length; i++) {
      const c = list[i];
      const col = c.color >= 0 ? COLORS[c.color]?.hex ?? '#fff' : '#a8b1c8';
      const el = c.from
        ? h('div', { class: `msg${c.ch === 'ghost' ? ' ghost' : ''}` }, h('b', { style: `color:${col}` }, c.ch === 'ghost' ? `👻 ${c.name}: ` : `${c.name}: `), c.text)
        : h('div', { class: 'msg sys' }, c.text);
      this.msgs.append(el);
    }
    this.shown = list.length;
    while (this.msgs.children.length > 80) this.msgs.firstChild!.remove();
    this.msgs.scrollTop = this.msgs.scrollHeight;
  }

  private send() {
    const t = this.input.value.trim();
    if (!t) return;
    store.net?.emit('chat', { text: t });
    this.input.value = '';
  }

  focus() { this.input.focus(); }

  destroy() { this.off(); }
}
