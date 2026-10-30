import { ACCESSORIES, COLORS } from '../../shared/constants';
import { getMap } from '../../shared/maps';
import { ROLES } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { Chat } from './Chat';
import { clear, h, ICONS, modal, toast, uiRoot } from './dom';
import { mapCards } from './MapCards';
import { portrait, setPortraitTextures } from './Portrait';
import { showHostSettings, showPrefs } from './SettingsUI';

/** Interfaz de la sala de espera: código, mapa, ocupación, anfitrión, chat e INICIAR. */
export class LobbyUI {
  /** La práctica arranca sola solo la primera vez; después se usa INICIAR. */
  static autoStarted = new Set<string>();
  root: HTMLElement;
  private offs: (() => void)[] = [];
  private codeEl = h('span', { class: 'code' });
  private mapEl = h('div');
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

  constructor(private app: App) {
    setPortraitTextures(app.world.textures);
    this.startBtn = h('button', { class: 'btn primary big', onclick: () => { audio.sfx('click'); store.net?.emit('start'); }, html: `${ICONS.play}<span>INICIAR</span>` }) as HTMLButtonElement;
    this.chat = new Chat('lobby');
    const copy = h('button', { class: 'btn icon ghost', title: 'Copiar código', onclick: () => this.copyCode(), html: ICONS.copy });
    const top = h('div', { class: 'lobby-top' },
      h('div', { class: 'panel code-box' }, h('div', { class: 'col', style: 'gap:0' }, h('span', { class: 'small muted' }, 'CÓDIGO DE SALA'), this.codeEl), copy),
      h('div', { class: 'panel grow', style: 'min-width:200px' }, this.mapEl, this.occEl),
      h('div', { class: 'panel' }, this.statusEl),
    );
    const side = h('div', { class: 'lobby-side' },
      h('div', { class: 'panel', style: 'max-height:42%;display:flex;flex-direction:column;gap:6px' }, h('h3', null, 'Tripulación'), this.plist),
      h('div', { class: 'panel', style: 'flex:1;min-height:0;display:flex;flex-direction:column' }, this.chat.el),
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

  private render() {
    const r = store.room;
    if (!r) return;
    const me = store.net?.pid;
    const isHost = r.hostId === me;
    this.codeEl.textContent = r.practice ? 'PRÁCTICA' : r.code;
    const def = getMap(r.mapId);
    clear(this.mapEl);
    this.mapEl.append(h('div', { class: 'row' }, h('span', { html: ICONS[r.mapId] }), h('b', { class: 'title', style: 'font-size:1.2em' }, `${def.texts.short} · ${def.texts.vehicle}`)));
    const conn = r.players.filter((p) => p.connected).length;
    this.occEl.textContent = r.practice ? 'Modo práctica (un jugador, sin red)' : `${conn}/${r.settings.game.maxPlayers} plazas · mínimo 4 · un impostor`;
    const st = store.net?.status ?? 'disconnected';
    clear(this.statusEl);
    this.statusEl.append(h('span', { html: ICONS.wifi, style: `display:inline-flex;width:20px;color:${st === 'connected' ? 'var(--ok)' : 'var(--gold)'}` }), ` ${st === 'connected' ? 'Conectado' : 'Reconectando…'}`);
    if (store.net && !store.net.t.local) this.statusEl.append(h('div', { class: 'muted' }, `${Math.round(store.net.rtt)} ms`));
    clear(this.plist);
    for (const p of r.players) {
      this.plist.append(h('div', { class: 'prow' },
        portrait(p.color, p.acc, 18),
        h('span', { class: 'nm' }, p.name, p.id === me ? h('span', { class: 'muted' }, ' (tú)') : null),
        p.host ? h('span', { class: 'badge host', html: `${ICONS.crown}` }) : null,
        !p.connected ? h('span', { class: 'badge' }, 'desconectado') : !p.loaded ? h('span', { class: 'badge' }, 'cargando…') : null,
      ));
    }
    this.plist.querySelectorAll('canvas').forEach((c) => { (c as HTMLCanvasElement).style.width = '30px'; (c as HTMLCanvasElement).style.height = '30px'; });
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
      const left = Math.ceil((r.countdownEnds - (store.net?.serverNow() ?? Date.now())) / 1000);
      this.countdown.classList.remove('hidden');
      if (this.countdown.textContent !== String(Math.max(1, left))) { this.countdown.textContent = String(Math.max(1, left)); audio.sfx('click'); }
    } else this.countdown.classList.add('hidden');
    const it = this.app.world?.interact;
    if (it?.station) {
      this.prompt.classList.remove('hidden');
      this.prompt.innerHTML = `<kbd>E</kbd>${it.station.name}`;
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
    const cards = mapCards(r.mapId, null);
    const def = getMap(r.mapId);
    modal('Panel de salidas', h('div', { class: 'col' }, cards.el,
      h('p', null, `Próxima salida: ${def.texts.vehicle}. ${def.texts.description}`),
      h('p', { class: 'muted small' }, `Responsable del viaje: ${def.responsible?.title} (personaje no jugador). Críticos: ${def.sabotages.filter((s) => s.kind === 'critical').map((s) => s.name).join(' y ')}.`),
      h('p', { class: 'muted small' }, `Especialidades posibles (${ROLES.length}): ${ROLES.map((x) => x.name).join(', ')}.`),
    ), { wide: true });
  }

  private customize() {
    const r = store.room;
    if (!r) return;
    const me = r.players.find((p) => p.id === store.net?.pid);
    if (!me) return;
    let color = me.color, acc = me.acc;
    const preview = h('div', { class: 'center' });
    const sw = h('div', { class: 'swatches' });
    const accs = h('div', { class: 'acc-grid' });
    const nameIn = h('input', { type: 'text', maxLength: 16, value: me.name }) as HTMLInputElement;
    const draw = () => {
      clear(preview); preview.append(portrait(color, acc, 80));
      clear(sw);
      const taken = new Set(store.room!.players.filter((p) => p.id !== me.id).map((p) => p.color));
      COLORS.forEach((c) => sw.append(h('button', {
        class: `swatch${c.id === color ? ' sel' : ''}${taken.has(c.id) ? ' taken' : ''}`, title: `${c.name}${taken.has(c.id) ? ' (ocupado)' : ''}`,
        style: `background:${c.hex}`, disabled: taken.has(c.id), onclick: () => { color = c.id; send(); },
      })));
      clear(accs);
      ACCESSORIES.forEach((a) => {
        const b = h('button', { class: `btn ghost${a.id === acc ? ' pressed' : ''}`, title: a.name, onclick: () => { acc = a.id; send(); } }, portrait(color, a.id, 24));
        accs.append(b);
      });
    };
    const send = () => { store.net?.emit('custom', { color, acc }); audio.sfx('click'); draw(); };
    const off = store.on('room', () => { const m2 = store.room?.players.find((p) => p.id === me.id); if (m2) { color = m2.color; acc = m2.acc; } draw(); });
    draw();
    modal('Vestuario del personal', h('div', { class: 'col' }, preview,
      h('div', { class: 'field' }, h('label', null, 'Nombre'), nameIn),
      h('div', { class: 'field' }, h('label', null, 'Color del uniforme (cada color lleva su distintivo)'), sw),
      h('div', { class: 'field' }, h('label', null, 'Accesorio'), accs),
    ), { onClose: () => { off(); const n = nameIn.value.trim(); if (n && n !== me.name) { store.setPrefs({ name: n }); store.net?.emit('custom', { name: n }); } } });
  }

  destroy() {
    for (const o of this.offs) o();
    clearInterval(this.timer);
    this.chat.destroy();
    this.root.remove();
  }
}
