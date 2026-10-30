import { ACCESSORIES, COLORS } from '../../shared/constants';
import { getMap } from '../../shared/maps';
import { ROLES } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { Chat } from './Chat';
import { clear, h, ICONS, modal, toast, uiRoot } from './dom';
import { mapCards, mapThumb, MODE_INFO } from './MapCards';
import { portrait, setPortraitTextures } from './Portrait';
import { showHostSettings, showPrefs } from './SettingsUI';

/** Interfaz de la sala de espera: código, modo y mapa, tripulación, chat e INICIAR. */
export class LobbyUI {
  /** La práctica arranca sola solo la primera vez; después se usa INICIAR. */
  static autoStarted = new Set<string>();
  root: HTMLElement;
  private offs: (() => void)[] = [];
  private codeEl = h('span', { class: 'code' });
  private mapEl = h('div', { class: 'lobby-map' });
  private occEl = h('div', { class: 'small muted' });
  private statusEl = h('div', { class: 'small' });
  private plist = h('div', { class: 'plist scroll' });
  private startBtn: HTMLButtonElement;
  private blockers = h('div', { class: 'blockers' });
  private countdown = h('div', { class: 'countdown hidden' });
  private chat: Chat;
  private prompt = h('div', { class: 'prompt hidden' });
  private practiceStarted = false;
  private timer: ReturnType<typeof setInterval>;
  private mapKey = '';

  constructor(private app: App) {
    setPortraitTextures(app.world.textures);
    this.startBtn = h('button', { class: 'btn primary big', onclick: () => { audio.sfx('click'); store.net?.emit('start'); }, html: `${ICONS.play}<span>INICIAR</span>` }) as HTMLButtonElement;
    this.chat = new Chat('lobby');
    const copy = h('button', { class: 'btn icon ghost', title: 'Copiar enlace de la sala', 'aria-label': 'Copiar enlace de la sala', onclick: () => this.copyCode(), html: ICONS.copy });
    const top = h('div', { class: 'lobby-top' },
      h('div', { class: 'panel code-box' }, h('div', { class: 'col', style: 'gap:0' }, h('span', { class: 'small muted' }, 'CÓDIGO DE SALA'), this.codeEl), copy),
      h('div', { class: 'panel grow lobby-mode' }, this.mapEl, this.occEl),
      h('div', { class: 'panel' }, this.statusEl),
    );
    const side = h('div', { class: 'lobby-side' },
      h('div', { class: 'panel crew' }, h('h3', null, 'Tripulación'), this.plist),
      h('div', { class: 'panel lobby-chat' }, this.chat.el),
    );
    const bottom = h('div', { class: 'lobby-bottom' },
      h('div', { class: 'col' }, this.blockers, h('div', { class: 'row wrap' }, this.startBtn,
        h('button', { class: 'btn', onclick: () => showHostSettings(), html: `${ICONS.gear}<span>AJUSTES DE SALA</span>` }),
        h('button', { class: 'btn', onclick: () => this.customize(), html: `${ICONS.sparkle}<span>PERSONALIZAR</span>` }),
        h('button', { class: 'btn ghost', onclick: () => showPrefs(), html: `${ICONS.sound}<span>OPCIONES</span>` }),
        h('button', { class: 'btn danger', onclick: () => this.app.leaveRoom(), html: `${ICONS.back}<span>SALIR</span>` }),
      )),
    );
    this.root = h('div', { class: 'screen', style: 'pointer-events:none' }, top, side, bottom, this.countdown, this.prompt);
    uiRoot().append(this.root);
    this.offs.push(store.on('room', () => this.render()));
    this.timer = setInterval(() => this.tick(), 100);
    this.render();
  }

  private copyCode() {
    const code = store.room?.code ?? '';
    const url = `${location.origin}${location.pathname}?sala=${code}`;
    navigator.clipboard?.writeText(url).then(() => toast('Enlace de la sala copiado.', 'ok'), () => toast(`Código: ${code}`, 'info'));
  }

  /** Resumen del modo y el mapa con ilustración y reglas breves (lo cambia el anfitrión). */
  private renderMode() {
    const r = store.room!;
    const key = `${r.mode}|${r.mapId}|${r.hostId === store.net?.pid}`;
    if (key === this.mapKey) return;
    this.mapKey = key;
    const def = getMap(r.mapId);
    const info = MODE_INFO[r.mode];
    const thumb = mapThumb(r.mapId, 240, 120);
    thumb.className = 'lobby-thumb';
    clear(this.mapEl);
    const isHost = r.hostId === store.net?.pid;
    this.mapEl.append(
      thumb,
      h('div', { class: 'col grow', style: 'gap:4px;min-width:0' },
        h('div', { class: 'row', style: 'gap:8px' }, h('span', { class: 'badge mode' }, info.name), h('b', { class: 'title', style: 'font-size:1.15em' }, `${def.texts.short} · ${def.texts.vehicle}`)),
        h('div', { class: 'small' }, info.text),
        h('ul', { class: 'rules small muted' }, info.rules.map((x) => h('li', null, x))),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn small', onclick: () => showHostSettings('partida'), html: `${ICONS.map}<span>${isHost ? 'CAMBIAR MODO O MAPA' : 'VER AJUSTES'}</span>` }))),
    );
  }

  private render() {
    const r = store.room;
    if (!r) return;
    const me = store.net?.pid;
    const isHost = r.hostId === me;
    this.codeEl.textContent = r.practice ? 'PRÁCTICA' : r.code;
    this.renderMode();
    const conn = r.players.filter((p) => p.connected).length;
    this.occEl.textContent = r.practice ? 'Modo práctica (un jugador, sin red)' : `${conn}/${r.settings.game.maxPlayers} plazas · mínimo 4 · un impostor · anfitrión: ${r.players.find((p) => p.host)?.name ?? '—'}`;
    const st = store.net?.status ?? 'disconnected';
    clear(this.statusEl);
    this.statusEl.append(h('span', { html: ICONS.wifi, style: `display:inline-flex;width:20px;color:${st === 'connected' ? 'var(--ok)' : 'var(--gold)'}` }), ` ${st === 'connected' ? 'Conectado' : 'Reconectando…'}`);
    if (store.net && !store.net.t.local) this.statusEl.append(h('div', { class: 'muted' }, `${Math.round(store.net.rtt)} ms`));
    clear(this.plist);
    for (const p of r.players) {
      const pic = portrait(p.color, p.acc, 36);
      pic.className = 'av';
      this.plist.append(h('div', { class: `prow${p.id === me ? ' me' : ''}` },
        pic,
        h('span', { class: 'nm' }, p.name, p.id === me ? h('span', { class: 'muted' }, ' (tú)') : null),
        p.host ? h('span', { class: 'badge host', title: 'Anfitrión', html: `${ICONS.crown}` }) : null,
        !p.connected ? h('span', { class: 'badge' }, 'desconectado') : !p.loaded ? h('span', { class: 'badge loading' }, 'cargando…') : h('span', { class: 'badge ok' }, 'listo'),
      ));
    }
    this.startBtn.classList.toggle('hidden', !isHost);
    this.startBtn.disabled = !r.canStart;
    clear(this.blockers);
    if (!isHost) this.blockers.append(h('div', null, `Esperando a que ${r.players.find((p) => p.host)?.name ?? 'el anfitrión'} inicie la partida.`));
    else for (const b of r.startBlockers) this.blockers.append(h('div', null, `• ${b}`));
    if (r.practice && isHost && r.canStart && !this.practiceStarted && !LobbyUI.autoStarted.has(r.code)) {
      this.practiceStarted = true;
      LobbyUI.autoStarted.add(r.code);
      setTimeout(() => store.net?.emit('start'), 300);
    }
  }

  private tick() {
    const r = store.room;
    if (r?.countdownEnds) {
      const left = store.secsLeft(r.countdownEnds);
      this.countdown.classList.remove('hidden');
      const txt = String(Math.max(1, left));
      if (this.countdown.textContent !== txt) { this.countdown.textContent = txt; audio.sfx('click'); }
    } else this.countdown.classList.add('hidden');
    const it = this.app.world?.interact;
    if (it?.station) {
      this.prompt.classList.remove('hidden');
      const html = `<kbd>E</kbd>${it.station.name}`;
      if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
    } else this.prompt.classList.add('hidden');
  }

  onKey(k: string) {
    if (k === 'e') this.useStation();
    if (k === 'enter') this.chat.focus();
  }

  useStation() {
    const s = this.app.world?.interact.station;
    if (!s) return;
    audio.sfx('open');
    if (s.kind === 'wardrobe') this.customize();
    else if (s.kind === 'kiosk') this.kiosk();
  }

  private kiosk() {
    const r = store.room!;
    const cards = mapCards(r.mapId, null, r.mode);
    const def = getMap(r.mapId);
    const crit = def.sabotages.filter((s) => s.kind === 'critical').map((s) => s.name).join(' y ');
    modal('Panel de salidas', h('div', { class: 'col' }, cards.el,
      h('p', null, `Próxima salida: ${def.texts.vehicle}. ${def.texts.description}`),
      r.mode === 'travel'
        ? h('p', { class: 'muted small' }, `Responsable del viaje: ${def.responsible?.title} (personaje no jugador). Críticos: ${crit}. Especialidades posibles (${ROLES.length}).`)
        : h('p', { class: 'muted small' }, 'Supermercado: cada persona aporta un ingrediente por ronda; se revelan en caja, se discute y se vota.'),
    ), { wide: true });
  }

  /** Vestuario: personaje grande, pestañas, selección visible y APLICAR / CANCELAR. */
  private customize() {
    const r = store.room;
    if (!r) return;
    const me = r.players.find((p) => p.id === store.net?.pid);
    if (!me) return;
    let color = me.color, acc = me.acc;
    let tab: 'color' | 'acc' | 'name' = 'color';
    const preview = h('div', { class: 'wardrobe-preview' });
    const pane = h('div', { class: 'wardrobe-pane' });
    const tabs = h('div', { class: 'tabs' });
    const nameIn = h('input', { type: 'text', maxLength: 16, value: me.name, 'aria-label': 'Nombre' }) as HTMLInputElement;
    nameIn.addEventListener('keydown', (e) => e.stopPropagation());
    const dirty = () => color !== me.color || acc !== me.acc || nameIn.value.trim() !== me.name;
    const applyBtn = h('button', { class: 'btn primary', onclick: () => apply(), html: `${ICONS.check}<span>APLICAR</span>` }) as HTMLButtonElement;
    const cancelBtn = h('button', { class: 'btn ghost', onclick: () => { m.close(); } }, 'CANCELAR');
    const draw = () => {
      clear(preview); preview.append(portrait(color, acc, 140));
      clear(tabs);
      for (const [id, name] of [['color', 'COLOR'], ['acc', 'COMPLEMENTO'], ['name', 'NOMBRE']] as const) tabs.append(h('button', { class: `tab${tab === id ? ' active' : ''}`, onclick: () => { tab = id; draw(); } }, name));
      clear(pane);
      if (tab === 'color') {
        const sw = h('div', { class: 'swatches' });
        const taken = new Set(store.room!.players.filter((p) => p.id !== me.id).map((p) => p.color));
        COLORS.forEach((c) => sw.append(h('button', {
          class: `swatch${c.id === color ? ' sel' : ''}${taken.has(c.id) ? ' taken' : ''}`, title: `${c.name}${taken.has(c.id) ? ' (ocupado)' : ''}`, 'aria-label': c.name, 'aria-pressed': String(c.id === color),
          style: `background:${c.hex}`, disabled: taken.has(c.id), onclick: () => { color = c.id; audio.sfx('click'); draw(); },
        })));
        pane.append(h('div', { class: 'small muted' }, 'Cada color lleva su distintivo bordado, para no depender solo del color.'), sw);
      } else if (tab === 'acc') {
        const accs = h('div', { class: 'acc-grid' });
        ACCESSORIES.forEach((a) => accs.append(h('button', { class: `btn ghost acc${a.id === acc ? ' pressed' : ''}`, title: a.name, 'aria-pressed': String(a.id === acc), onclick: () => { acc = a.id; audio.sfx('click'); draw(); } }, portrait(color, a.id, 44), h('span', { class: 'small' }, a.name))));
        pane.append(accs);
      } else pane.append(h('div', { class: 'field' }, h('label', null, 'Nombre visible'), nameIn));
      applyBtn.disabled = !dirty();
    };
    nameIn.addEventListener('input', () => { applyBtn.disabled = !dirty(); });
    const apply = () => {
      const n = nameIn.value.trim();
      store.net?.emit('custom', { color, acc, ...(n && n !== me.name ? { name: n } : {}) });
      if (n && n !== me.name) store.setPrefs({ name: n });
      audio.sfx('ok');
      toast('Uniforme actualizado.', 'ok', 1400);
      m.close();
    };
    const off = store.on('room', () => {
      // Si alguien ocupa el color elegido mientras decides, se marca al instante.
      if (tab === 'color') draw();
    });
    draw();
    const m = modal('Vestuario del personal', h('div', { class: 'wardrobe' }, preview, h('div', { class: 'col grow' }, tabs, pane)), { wide: true, onClose: () => off(), actions: [cancelBtn, applyBtn] });
  }

  destroy() {
    for (const o of this.offs) o();
    clearInterval(this.timer);
    this.chat.destroy();
    this.root.remove();
  }
}
