import { CHAT_MAX, COLORS } from '../../shared/constants';
import type { ChatMsg } from '../../shared/protocol';
import { store } from '../state';
import { h } from './dom';
import { portrait } from './Portrait';

/**
 * Chat de sala y de reunión. Cada mensaje lleva el retrato del aspecto del
 * autor (mismo compositor que el mundo), su nombre y el texto; los mensajes
 * seguidos del mismo autor se agrupan. Los avisos del sistema van aparte y
 * nadie puede imitarlos (el texto se inserta siempre como texto plano).
 */
export class Chat {
  el: HTMLElement;
  private msgs: HTMLElement;
  private input: HTMLInputElement;
  private counter = h('span', { class: 'count small muted' });
  private newBtn: HTMLButtonElement;
  private off: () => void;
  private shown = 0;
  private lastFrom: string | null = null;
  private lastGroup: HTMLElement | null = null;

  constructor(private mode: 'lobby' | 'meeting') {
    this.msgs = h('div', { class: 'msgs scroll', role: 'log', 'aria-live': 'polite' });
    this.input = h('input', { type: 'text', maxLength: CHAT_MAX, placeholder: mode === 'lobby' ? 'Escribe en la sala…' : 'Escribe en la discusión…', 'aria-label': 'Mensaje', autocomplete: 'off' }) as HTMLInputElement;
    this.input.addEventListener('input', () => this.updateCounter());
    // El input no deja escapar teclas al juego (WASD no mueve al personaje mientras escribes).
    this.input.addEventListener('keydown', (e) => e.stopPropagation());
    this.newBtn = h('button', { class: 'btn small newmsgs hidden', type: 'button', onclick: () => this.toBottom() }, 'NUEVOS MENSAJES ↓') as HTMLButtonElement;
    this.msgs.addEventListener('scroll', () => { if (this.atBottom()) this.newBtn.classList.add('hidden'); });
    const form = h('form', { class: 'chat-form', onsubmit: (e: Event) => { e.preventDefault(); this.send(); } }, this.input, this.counter, h('button', { class: 'btn', type: 'submit' }, 'Enviar'));
    this.el = h('div', { class: 'chat' }, h('h3', { style: 'margin-bottom:6px' }, mode === 'lobby' ? 'Chat' : 'Discusión'), h('div', { class: 'msgs-wrap' }, this.msgs, this.newBtn), form);
    this.off = store.on('chat', () => this.render());
    this.updateCounter();
    this.render();
  }

  private updateCounter() {
    const n = this.input.value.length;
    this.counter.textContent = `${n}/${CHAT_MAX}`;
    this.counter.classList.toggle('warn', n > CHAT_MAX - 20);
  }

  private visible() {
    const me = store.pub?.players.find((p) => p.id === store.net?.pid);
    const ghost = me ? !me.alive : false;
    return store.chat.filter((c) => (this.mode === 'lobby' ? c.ch === 'lobby' : c.ch === 'meeting' || (ghost && c.ch === 'ghost')));
  }

  private atBottom() { return this.msgs.scrollHeight - this.msgs.scrollTop - this.msgs.clientHeight < 24; }
  private toBottom() { this.msgs.scrollTop = this.msgs.scrollHeight; this.newBtn.classList.add('hidden'); }

  /** Solo la propia interfaz del impostor pinta su nombre en rojo. */
  private nameColor(c: ChatMsg): string {
    if (c.from && c.from === store.net?.pid && store.priv?.team === 'impostor' && store.view === 'game') return '#ff5a6a';
    return COLORS[c.color]?.hex ?? '#fff';
  }

  private render() {
    const list = this.visible();
    const stick = this.atBottom();
    if (list.length < this.shown) { this.msgs.innerHTML = ''; this.shown = 0; this.lastFrom = null; this.lastGroup = null; }
    let added = false;
    for (let i = this.shown; i < list.length; i++) {
      const c = list[i];
      added = true;
      if (!c.from) {
        this.msgs.append(h('div', { class: 'msg sys' }, c.text));
        this.lastFrom = null; this.lastGroup = null;
        continue;
      }
      const key = `${c.ch}|${c.from}`;
      const line = h('div', { class: 'line' }, c.text);
      if (this.lastFrom === key && this.lastGroup) { this.lastGroup.querySelector('.body')!.append(line); continue; }
      const pic = portrait(c.color, c.acc ?? 9, 34, { ghost: c.ch === 'ghost' });
      pic.className = 'av';
      const group = h('div', { class: `msg${c.ch === 'ghost' ? ' ghost' : ''}${c.from === store.net?.pid ? ' mine' : ''}` },
        pic,
        h('div', { class: 'body' }, h('div', { class: 'who', style: `color:${this.nameColor(c)}` }, c.ch === 'ghost' ? `${c.name} · espectador` : c.name), line));
      this.msgs.append(group);
      this.lastFrom = key; this.lastGroup = group;
    }
    this.shown = list.length;
    while (this.msgs.children.length > 120) this.msgs.firstChild!.remove();
    if (!added) return;
    // Autoscroll solo si ya se estaba leyendo el final.
    if (stick) this.toBottom(); else this.newBtn.classList.remove('hidden');
  }

  private send() {
    const t = this.input.value.trim();
    if (!t) return;
    store.net?.emit('chat', { text: t });
    this.input.value = '';
    this.updateCounter();
    this.toBottom();
  }

  focus() { this.input.focus(); }

  destroy() { this.off(); }
}
