import { COLORS } from '../../shared/constants';
import type { MapId } from '../../shared/maps/types';
import { getMap } from '../../shared/maps';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { Chat } from './Chat';
import { ejectionScene } from './Cinematics';
import { clear, fmtTime, h, ICONS } from './dom';
import { drawPortrait, portrait } from './Portrait';
import { fillStroke, makeCanvas, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';

/** Reunión: convocatoria → discusión → votación → resultados → expulsión. */
export class MeetingUI {
  private root: HTMLElement | null = null;
  private chat: Chat | null = null;
  private grid = h('div', { class: 'portraits' });
  private timer = h('div', { class: 'timer' });
  private title = h('h2');
  private bottom = h('div', { class: 'bottom' });
  private status = h('div', { class: 'small muted' });
  private selected: string | null = null;
  private stage = '';
  private offs: (() => void)[] = [];
  private tick: ReturnType<typeof setInterval>;
  private banner: HTMLElement | null = null;
  private ejectStop: (() => void) | null = null;
  private banner2 = makeCanvas(1200, 190);
  private bannerKey = '';

  constructor(private app: App) {
    this.offs.push(store.on('pub', () => this.sync()));
    this.tick = setInterval(() => this.updateTimer(), 200);
    this.sync();
  }

  private me() { return store.pub?.players.find((p) => p.id === store.net?.pid); }

  private sync() {
    const pub = store.pub;
    const inMeeting = !!pub && ['DISCUSION', 'VOTACION', 'RESULTADOS', 'EXPULSION'].includes(pub.phase) && !!pub.meeting;
    if (!inMeeting) { this.close(); return; }
    const m = pub!.meeting!;
    if (m.stage === 'call') { this.showBanner(m.callerName); return; }
    this.hideBanner();
    if (!this.root) this.open();
    if (m.stage !== this.stage) {
      this.stage = m.stage;
      if (m.stage === 'vote') audio.sfx('vote');
      if (m.stage === 'eject') this.showEject();
    }
    this.render();
  }

  private showBanner(caller: string) {
    if (this.banner) return;
    this.app.panels?.show(null);
    this.banner = h('div', { class: 'call-banner' }, h('h1', null, '¡REUNIÓN DE EMERGENCIA!'), h('div', { class: 'title', style: 'font-size:1.6em' }, `Convocada por ${caller}`));
    document.getElementById('ui')!.append(this.banner);
  }
  private hideBanner() { this.banner?.remove(); this.banner = null; }

  private open() {
    const def = getMap((store.gstart?.mapId ?? 'train') as MapId);
    this.chat = new Chat('meeting');
    const room = def.rooms.find((r) => r.id === def.meetingRoom)?.name ?? 'Salón';
    this.root = h('div', { class: 'meeting' },
      h('div', { class: 'main' },
        h('div', { class: 'head' }, h('span', { html: ICONS.users, style: 'display:inline-flex;width:34px' }), this.title, this.timer),
        h('div', { class: 'small muted' }, `${room} · ${def.texts.vehicle}. Las posiciones de exploración se conservan.`),
        this.banner2,
        this.grid, this.status, this.bottom),
      h('div', { class: 'panel', style: 'display:flex;flex-direction:column;min-height:0' }, this.chat.el),
    );
    document.getElementById('ui')!.append(this.root);
    this.selected = null;
  }

  private render() {
    const pub = store.pub!;
    const m = pub.meeting!;
    const me = this.me();
    const alive = !!me?.alive;
    const voted = new Set(m.voted);
    this.drawRoom();
    this.title.textContent = m.stage === 'discuss' ? 'Discusión' : m.stage === 'vote' ? 'Votación' : m.stage === 'results' ? 'Resultados' : 'Expulsión';
    clear(this.grid);
    const res = m.results;
    for (const p of pub.players) {
      if (p.left) continue;
      const canPick = m.stage === 'vote' && alive && !voted.has(me!.id) && p.alive;
      const votesFor = res ? res.counts[p.id] ?? 0 : 0;
      const voters = res?.votes ? Object.entries(res.votes).filter(([, t]) => t === p.id).map(([v]) => v) : [];
      const card = h('button', {
        class: `portrait${!p.alive ? ' dead' : ''}${this.selected === p.id ? ' sel' : ''}`, disabled: !canPick, type: 'button',
        onclick: () => { if (!canPick) return; this.selected = p.id; audio.sfx('click'); this.render(); },
      }, portrait(p.color, p.acc, 58, { ghost: !p.alive }),
      h('div', { class: 'col', style: 'gap:2px;min-width:0' },
        h('div', { class: 'nm', style: `color:${COLORS[p.color]?.hex}` }, p.name),
        h('div', { class: 'small muted' }, `${COLORS[p.color]?.name}${!p.alive ? ' · expulsado' : ''}${!p.connected ? ' · desconectado' : ''}`),
        res ? h('div', { class: 'votes' }, res.votes ? voters.map((v) => h('i', { style: `background:${COLORS[pub.players.find((x) => x.id === v)?.color ?? 0]?.hex}` })) : Array.from({ length: votesFor }, () => h('i', { style: 'background:#a8b1c8' }))) : null,
      ),
      voted.has(p.id) && m.stage !== 'results' && m.stage !== 'eject' ? h('span', { class: 'voted' }, '✔ HA VOTADO') : null);
      this.grid.append(card);
    }
    clear(this.bottom);
    if (m.stage === 'discuss') this.status.textContent = 'Discutid lo que habéis visto. La votación empezará al terminar la discusión.';
    else if (m.stage === 'vote') {
      if (!alive) this.status.textContent = 'Los expulsados no votan. Puedes leer la reunión y hablar en el canal de espectadores.';
      else if (voted.has(me!.id)) this.status.textContent = 'Voto registrado. Esperando al resto…';
      else {
        this.status.textContent = 'Elige a una persona viva o salta la votación y confirma.';
        const sel = this.selected ? pub.players.find((p) => p.id === this.selected) : null;
        this.bottom.append(
          h('button', { class: 'btn primary big', disabled: !sel, onclick: () => this.vote(this.selected!), html: `${ICONS.vote}<span>${sel ? `CONFIRMAR VOTO: ${sel.name}` : 'SELECCIONA A ALGUIEN'}</span>` }),
          h('button', { class: 'btn big', onclick: () => this.vote('skip'), html: `${ICONS.skip}<span>SALTAR (${res?.counts.skip ?? ''})</span>`.replace(' ()', '') }),
        );
      }
    } else if (res) {
      const skip = res.counts.skip ?? 0;
      this.status.textContent = res.ejected
        ? `${res.ejectedName} recibe más votos que ninguna otra opción y es expulsado. Votos para SALTAR: ${skip}.`
        : res.tie ? `Empate en el máximo de votos: nadie es expulsado. SALTAR: ${skip}.` : res.skipped ? `SALTAR recibe más votos: nadie es expulsado (${skip}).` : 'Nadie ha votado: nadie es expulsado.';
    }
  }

  /** Ilustración del salón con los participantes vivos alrededor de la mesa. */
  private drawRoom() {
    const pub = store.pub!;
    const alive = pub.players.filter((p) => p.alive && !p.left);
    const key = alive.map((p) => `${p.id}${p.color}${p.acc}`).join();
    if (key === this.bannerKey) return;
    this.bannerKey = key;
    const map = (store.gstart?.mapId ?? 'train') as MapId;
    const c = this.banner2;
    c.style.cssText = 'width:100%;height:auto;max-height:150px;border-radius:12px;border:2px solid #1d1830;object-fit:cover';
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const wall = map === 'train' ? ['#b07a4a', '#7a4d2c'] : map === 'ship' ? ['#f1ede4', '#cfc6b4'] : ['#eef1f6', '#c3cddb'];
    g.fillStyle = vgrad(g, 0, H, wall[0], wall[1]); g.fillRect(0, 0, W, H);
    for (let x = 90; x < W; x += 180) { rr(g, x, 22, map === 'plane' ? 34 : 110, 60, 14); fillStroke(g, vgrad(g, 22, 82, '#cfe9ff', '#7fb1d8'), INK, 3); }
    g.fillStyle = map === 'train' ? '#5a3a24' : map === 'ship' ? '#20375c' : '#4a5568'; g.fillRect(0, H - 30, W, 30);
    const n = Math.max(1, alive.length);
    const step = Math.min(110, (W - 140) / n);
    alive.forEach((p, i) => {
      const pc = makeCanvas(128, 128);
      drawPortrait(pc, p.color, p.acc, { flip: i >= n / 2 });
      g.drawImage(pc, W / 2 - (step * n) / 2 + i * step + (step - 96) / 2, 40, 96, 96);
    });
    rr(g, 60, H - 70, W - 120, 46, 16); fillStroke(g, vgrad(g, H - 70, H - 24, '#c98f5a', '#8a5a33'), INK, 4);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, 80, H - 64, W - 160, 10, 5); g.fill();
  }

  private vote(target: string) {
    store.net?.act({ k: 'vote', target });
    audio.sfx('vote');
    this.selected = null;
  }

  private updateTimer() {
    const pub = store.pub;
    if (!pub?.meeting || !this.root || pub.phaseEnds === null) return;
    const left = pub.phaseEnds - (store.net?.serverNow() ?? Date.now());
    this.timer.textContent = fmtTime(left);
  }

  private showEject() {
    const res = store.pub?.meeting?.results;
    if (!res?.ejected) return;
    const reveal = res.reveal;
    const text = reveal ? `${res.ejectedName} era ${reveal === 'impostor' ? 'el IMPOSTOR' : 'TRABAJADOR'}.` : `${res.ejectedName} ha sido expulsado.`;
    const host = h('div', { class: 'cine' });
    document.getElementById('ui')!.append(host);
    const p = store.pub!.players.find((x) => x.id === res.ejected)!;
    const stop = ejectionScene(host, (store.gstart?.mapId ?? 'train') as MapId, p.color, p.acc, text, 6500);
    this.ejectStop = () => { stop(); host.remove(); };
  }

  close() {
    this.hideBanner();
    if (this.ejectStop) { this.ejectStop(); this.ejectStop = null; }
    this.chat?.destroy(); this.chat = null;
    this.root?.remove(); this.root = null;
    this.bannerKey = '';
    this.stage = '';
  }

  destroy() {
    this.close();
    clearInterval(this.tick);
    for (const o of this.offs) o();
  }
}
