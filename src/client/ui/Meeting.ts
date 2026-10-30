import { COLORS, EJECT_EMPTY_MS, EJECT_MS } from '../../shared/constants';
import type { MapId } from '../../shared/maps/types';
import { getMap } from '../../shared/maps';
import { PRODUCT_BY_ID } from '../../shared/market';
import type { MeetingPublic } from '../../shared/protocol';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { Chat } from './Chat';
import { ejectionScene } from './Cinematics';
import { clear, fmtSecs, h, ICONS, productIcon } from './dom';
import { drawPortrait, portrait } from './Portrait';
import { fillStroke, makeCanvas, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';

type Results = NonNullable<MeetingPublic['results']>;

/** Texto de la causa del resultado (con o sin expulsado). */
export function resultText(res: Results): { text: string; sub: string } {
  const skip = res.counts.skip ?? 0;
  if (res.ejected) {
    const reveal = res.reveal;
    return {
      text: reveal ? `${res.ejectedName} era ${reveal === 'impostor' ? 'el IMPOSTOR' : 'TRABAJADOR'}.` : `${res.ejectedName} ha sido expulsado.`,
      sub: `Recibió más votos que ninguna otra opción. SALTAR: ${skip}.`,
    };
  }
  if (res.cause === 'tie') return { text: 'EMPATE', sub: 'Empate en el máximo de votos: nadie es expulsado.' };
  if (res.cause === 'skip') return { text: 'SE HA SALTADO LA VOTACIÓN', sub: `SALTAR recibió más votos (${skip}): nadie es expulsado.` };
  return { text: 'NADIE HA SIDO EXPULSADO', sub: 'Nadie ha votado.' };
}

/** Reunión: (convocatoria) → discusión → votación → resultados → secuencia siempre. */
export class MeetingUI {
  private root: HTMLElement | null = null;
  private chat: Chat | null = null;
  private grid = h('div', { class: 'portraits' });
  private timer = h('div', { class: 'timer', role: 'timer' });
  private title = h('h2');
  private bottom = h('div', { class: 'bottom' });
  private status = h('div', { class: 'small muted' });
  private history = h('div', { class: 'history scroll', 'aria-label': 'Registro de aportes' });
  private selected: string | null = null;
  private stage = '';
  private offs: (() => void)[] = [];
  private tick: ReturnType<typeof setInterval>;
  private banner: HTMLElement | null = null;
  private ejectStop: (() => void) | null = null;
  /** Resoluciones ya reproducidas: un mensaje duplicado no repite la secuencia. */
  private played = new Set<string>();
  private banner2 = makeCanvas(1200, 190);
  private bannerKey = '';
  private historyKey = '';

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
    const def = getMap((store.gstart?.mapId ?? 'ship') as MapId);
    this.app.panels?.show(null);
    this.chat = new Chat('meeting');
    const market = store.pub?.mode === 'market';
    const room = market ? 'Zona de cajas' : def.rooms.find((r) => r.id === def.meetingRoom)?.name ?? 'Salón';
    const side = h('div', { class: 'panel meeting-side' });
    if (market) side.append(h('h3', null, 'Registro de aportes'), this.history);
    side.append(this.chat.el);
    this.root = h('div', { class: 'meeting' },
      h('div', { class: 'main' },
        h('div', { class: 'head' }, h('span', { html: ICONS.users, style: 'display:inline-flex;width:34px' }), this.title, this.timer),
        h('div', { class: 'small muted' }, market ? `${room} · ${def.texts.vehicle}. Comentad las compras y votad.` : `${room} · ${def.texts.vehicle}. Las posiciones de exploración se conservan.`),
        this.banner2,
        this.grid, this.status, this.bottom),
      side,
    );
    document.getElementById('ui')!.append(this.root);
    this.selected = null;
  }

  private renderHistory() {
    const mk = store.pub?.market;
    if (!mk) return;
    const key = `${mk.history.length}`;
    if (key === this.historyKey) return;
    this.historyKey = key;
    clear(this.history);
    const rounds = [...new Set(mk.history.map((e) => e.round))].sort((a, b) => b - a);
    for (const r of rounds) {
      this.history.append(h('div', { class: 'small muted round' }, `Ronda ${r}`));
      for (const e of mk.history.filter((x) => x.round === r)) {
        this.history.append(h('div', { class: 'hrow' },
          portrait(e.color, e.acc, 26),
          h('span', { class: 'nm', style: `color:${COLORS[e.color]?.hex}` }, e.name),
          e.product ? productIcon(e.product, 26) : h('span', { class: 'noaporte' }, '—'),
          h('span', { class: 'grow small' }, e.product ? PRODUCT_BY_ID[e.product]?.name ?? '' : 'SIN APORTE')));
      }
    }
  }

  private render() {
    const pub = store.pub!;
    const m = pub.meeting!;
    const me = this.me();
    const alive = !!me?.alive;
    const voted = new Set(m.voted);
    this.drawRoom();
    if (pub.mode === 'market') this.renderHistory();
    this.title.textContent = m.stage === 'discuss' ? 'Discusión' : m.stage === 'vote' ? 'Votación' : m.stage === 'results' ? 'Resultados' : 'Resultado';
    clear(this.grid);
    const res = m.results;
    const meImp = store.priv?.team === 'impostor';
    for (const p of pub.players) {
      if (p.left) continue;
      const canPick = m.stage === 'vote' && alive && !voted.has(me!.id) && p.alive;
      const votesFor = res ? res.counts[p.id] ?? 0 : 0;
      const voters = res?.votes ? Object.entries(res.votes).filter(([, t]) => t === p.id).map(([v]) => v) : [];
      const isMe = p.id === me?.id;
      const card = h('button', {
        class: `portrait${!p.alive ? ' dead' : ''}${this.selected === p.id ? ' sel' : ''}`, disabled: !canPick, type: 'button', 'aria-pressed': String(this.selected === p.id),
        onclick: () => { if (!canPick) return; this.selected = p.id; audio.sfx('click'); this.render(); },
      }, portrait(p.color, p.acc, 58, { ghost: !p.alive }),
      h('div', { class: 'col', style: 'gap:2px;min-width:0' },
        h('div', { class: 'nm', style: `color:${isMe && meImp ? '#ff5a6a' : COLORS[p.color]?.hex}` }, p.name, isMe ? h('span', { class: 'muted small' }, ' (tú)') : null),
        h('div', { class: 'small muted' }, `${COLORS[p.color]?.name}${!p.alive ? ' · expulsado' : ''}${!p.connected ? ' · desconectado' : ''}`),
        res ? h('div', { class: 'votes' }, res.votes ? voters.map((v) => h('i', { style: `background:${COLORS[pub.players.find((x) => x.id === v)?.color ?? 0]?.hex}` })) : Array.from({ length: votesFor }, () => h('i', { style: 'background:#a8b1c8' }))) : null,
      ),
      voted.has(p.id) && m.stage !== 'results' && m.stage !== 'eject' ? h('span', { class: 'voted' }, '✔ HA VOTADO') : null);
      this.grid.append(card);
    }
    clear(this.bottom);
    const skipAllowed = store.gstart?.settings.game.allowSkip !== false;
    if (m.stage === 'discuss') this.status.textContent = pub.mode === 'market' ? 'Comentad las compras. La votación empezará al terminar la discusión.' : 'Discutid lo que habéis visto. La votación empezará al terminar la discusión.';
    else if (m.stage === 'vote') {
      if (!alive) this.status.textContent = 'Los expulsados no votan. Puedes leer la reunión y hablar en el canal de espectadores.';
      else if (voted.has(me!.id)) this.status.textContent = `Voto registrado. Han votado ${m.voted.length}.`;
      else {
        this.status.textContent = skipAllowed ? 'Elige a una persona viva o salta la votación y confirma.' : 'Elige a una persona viva y confirma.';
        const sel = this.selected ? pub.players.find((p) => p.id === this.selected) : null;
        this.bottom.append(h('button', { class: 'btn primary big', disabled: !sel, onclick: () => this.vote(this.selected!), html: `${ICONS.vote}<span>${sel ? `CONFIRMAR VOTO: ${escapeHtml(sel.name)}` : 'SELECCIONA A ALGUIEN'}</span>` }));
        if (skipAllowed) this.bottom.append(h('button', { class: 'btn big', onclick: () => this.vote('skip'), html: `${ICONS.skip}<span>SALTAR</span>` }));
      }
    } else if (res) {
      const t = resultText(res);
      this.status.textContent = `${t.text} ${t.sub}`;
    }
  }

  /** Ilustración del salón con los participantes vivos. */
  private drawRoom() {
    const pub = store.pub!;
    const alive = pub.players.filter((p) => p.alive && !p.left);
    const key = alive.map((p) => `${p.id}${p.color}${p.acc}`).join();
    if (key === this.bannerKey) return;
    this.bannerKey = key;
    const map = (store.gstart?.mapId ?? 'ship') as MapId;
    const c = this.banner2;
    c.style.cssText = 'width:100%;height:auto;max-height:150px;border-radius:12px;border:2px solid #1d1830;object-fit:cover';
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const wall = map === 'market' ? ['#f4efe6', '#d8cfbf'] : map === 'ship' ? ['#f1ede4', '#cfc6b4'] : ['#eef1f6', '#c3cddb'];
    g.fillStyle = vgrad(g, 0, H, wall[0], wall[1]); g.fillRect(0, 0, W, H);
    if (map === 'market') { for (let x = 40; x < W; x += 200) { rr(g, x, 18, 160, 70, 6); fillStroke(g, '#ffffff', INK, 3); for (let k = 0; k < 6; k++) { g.fillStyle = ['#e63946', '#ffd23f', '#2bb24c', '#2f6fe0', '#f77f00', '#7b2cbf'][k]; g.fillRect(x + 12 + k * 24, 30, 16, 20); g.fillRect(x + 12 + k * 24, 58, 16, 20); } } }
    else for (let x = 90; x < W; x += 180) { rr(g, x, 22, map === 'plane' ? 34 : 110, 60, 14); fillStroke(g, vgrad(g, 22, 82, '#cfe9ff', '#7fb1d8'), INK, 3); }
    g.fillStyle = map === 'market' ? '#b8ad9a' : map === 'ship' ? '#20375c' : '#4a5568'; g.fillRect(0, H - 30, W, 30);
    const n = Math.max(1, alive.length);
    const step = Math.min(110, (W - 140) / n);
    alive.forEach((p, i) => {
      const pc = makeCanvas(128, 128);
      drawPortrait(pc, p.color, p.acc, { flip: i >= n / 2 });
      g.drawImage(pc, W / 2 - (step * n) / 2 + i * step + (step - 96) / 2, 40, 96, 96);
    });
    rr(g, 60, H - 70, W - 120, 46, 16); fillStroke(g, map === 'market' ? vgrad(g, H - 70, H - 24, '#f4efe6', '#c9a27a') : vgrad(g, H - 70, H - 24, '#c98f5a', '#8a5a33'), INK, 4);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, 80, H - 64, W - 160, 10, 5); g.fill();
  }

  private vote(target: string) {
    store.net?.act({ k: 'vote', target });
    audio.sfx('vote');
    this.selected = null;
  }

  /** Tiempo derivado del plazo del servidor (no hay una segunda simulación que se desvíe). */
  private updateTimer() {
    const pub = store.pub;
    if (!pub?.meeting || !this.root || pub.phaseEnds === null) return;
    const txt = fmtSecs(store.secsLeft(pub.phaseEnds));
    if (this.timer.textContent !== txt) this.timer.textContent = txt;
  }

  /** Una única secuencia por resolución; con o sin expulsado. */
  private showEject() {
    const res = store.pub?.meeting?.results;
    if (!res || this.played.has(res.rid)) return;
    this.played.add(res.rid);
    const pub = store.pub!;
    // Quien llega tarde ve el punto válido de la fase actual: si apenas queda tiempo, no la reproduce.
    if (pub.phaseEnds !== null && pub.phaseEnds - (store.net?.serverNow() ?? Date.now()) < 900) return;
    const t = resultText(res);
    const host = h('div', { class: 'cine' });
    document.getElementById('ui')!.append(host);
    const p = res.ejected ? pub.players.find((x) => x.id === res.ejected) : null;
    const dur = (res.ejected ? EJECT_MS : EJECT_EMPTY_MS) - 300;
    const stop = ejectionScene(host, (store.gstart?.mapId ?? 'ship') as MapId, p ? { color: p.color, acc: p.acc } : null, t.text, t.sub, dur);
    this.ejectStop = () => { stop(); host.remove(); };
  }

  close() {
    this.hideBanner();
    if (this.ejectStop) { this.ejectStop(); this.ejectStop = null; }
    this.chat?.destroy(); this.chat = null;
    this.root?.remove(); this.root = null;
    this.bannerKey = '';
    this.historyKey = '';
    this.stage = '';
  }

  destroy() {
    this.close();
    clearInterval(this.tick);
    for (const o of this.offs) o();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
