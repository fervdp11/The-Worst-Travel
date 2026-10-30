import { COLORS } from '../../shared/constants';
import { getMap } from '../../shared/maps';
import type { MapId } from '../../shared/maps/types';
import type { AnalystData, GameEvent, OccupancyData, PanelOpen } from '../../shared/protocol';
import type { RoleId } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { MinigameHost } from '../minigames/host';
import { store } from '../state';
import type { App } from './App';
import { clear, fmtTime, h, ICONS, modal, toast } from './dom';

/** Gestiona el panel del servidor abierto para este jugador. */
export class PanelHost {
  private el: HTMLElement | null = null;
  private mg: MinigameHost | null = null;
  private cur: PanelOpen | null = null;
  private occBody: HTMLElement | null = null;
  private analyst: HTMLElement | null = null;
  private camScreen: HTMLElement | null = null;
  private camTimer: ReturnType<typeof setInterval> | null = null;
  private resizeObs: ResizeObserver | null = null;

  constructor(private app: App) {}

  show(p: PanelOpen | null) {
    // Panel nuevo del mismo tipo de minijuego: lo reutiliza el anfitrión.
    this.hide();
    this.cur = p;
    if (!p) return;
    audio.sfx('open');
    switch (p.kind) {
      case 'minigame': this.mg = new MinigameHost(this.app, p, () => this.requestClose()); break;
      case 'cameras': this.cameras(p.cams, p.current, p.noSignal); break;
      case 'observer': this.cameras([p.cam], p.cam, [], p.endsGt); break;
      case 'occupancy': this.occupancy(); break;
      case 'sabotage': this.sabotage(p.station, p.options); break;
      case 'vent': this.vent(p.links); break;
      default: break;
    }
  }

  private hide() {
    this.mg?.destroy(); this.mg = null;
    this.el?.remove(); this.el = null;
    if (this.camTimer) { clearInterval(this.camTimer); this.camTimer = null; }
    this.resizeObs?.disconnect(); this.resizeObs = null;
    this.camScreen = null;
    this.occBody = null;
    this.app.world?.closeCamera();
  }

  requestClose() {
    if (!this.cur) return;
    const kind = this.cur.kind;
    if (kind === 'vent') return; // dentro de la trampilla se sale con el botón SALIR
    store.net?.act({ k: 'close' });
    store.panel = null;
    this.hide();
    this.cur = null;
    audio.sfx('close');
  }

  closeTop(): boolean {
    if (document.querySelector('.mapview')) { document.querySelector('.mapview')!.remove(); return true; }
    if (document.querySelector('.modal-back')) return false;
    if (this.cur) { this.requestClose(); return true; }
    if (this.analyst) { store.net?.act({ k: 'ability' }); this.closeAnalyst(); return true; }
    return false;
  }

  onEvent(e: GameEvent) {
    if (e.e === 'stepOk' || e.e === 'stepBad') this.mg?.onServer(e);
    else if (e.e === 'occ') this.renderOcc(e.data);
    else if (e.e === 'analyst') this.renderAnalyst(e.data);
  }

  private frame(title: string, body: Node, extra: Node[] = []): HTMLElement {
    const el = h('div', { class: 'mg-back' }, h('div', { class: 'panel mg' },
      h('div', { class: 'bar' }, h('h3', null, title), ...extra, h('button', { class: 'btn icon ghost', title: 'Cerrar (Esc)', onclick: () => this.requestClose(), html: ICONS.close })),
      body));
    document.getElementById('ui')!.append(el);
    this.el = el;
    return el;
  }

  private cameras(cams: string[], current: string, noSignal: string[], endsGt?: number) {
    const def = getMap((store.gstart?.mapId ?? 'train') as MapId);
    let cur = current;
    const tabs = h('div', { class: 'tabs' });
    const screen = h('div', { class: 'screenbox' });
    const rec = h('div', { class: 'rec' }, '● EN VIVO');
    const ns = h('div', { class: 'nosignal hidden' }, 'SIN SEÑAL');
    const info = h('div', { class: 'small muted' });
    screen.append(rec, ns);
    const renderTabs = () => {
      clear(tabs);
      for (const id of cams) {
        const c = def.cameras.find((x) => x.id === id)!;
        tabs.append(h('button', { class: `tab${id === cur ? ' active' : ''}`, onclick: () => { cur = id; store.net?.act({ k: 'cam', cam: id }); renderTabs(); place(); } }, `${c.name} · ${def.levels.find((l) => l.id === c.level)?.name}`));
      }
    };
    const place = () => {
      const jam = noSignal.includes(cur) || store.pub?.sabotage?.id === 'comms';
      ns.classList.toggle('hidden', !jam);
      rec.classList.toggle('hidden', jam);
      const r = screen.getBoundingClientRect();
      if (jam || r.width < 10) { this.app.world.closeCamera(); return; }
      this.app.world.showCamera(cur, { x: r.left + 3, y: r.top + 3, w: r.width - 6, h: r.height - 6 });
    };
    const body = h('div', { class: 'cams' }, cams.length > 1 ? tabs : null, screen, info);
    info.textContent = endsGt ? 'Consulta remota del Observador: quieto y distraído mientras dura.' : 'Al usar las cámaras, su piloto rojo se enciende y quien esté cerca puede verlo.';
    this.frame(endsGt ? 'Cámara remota' : 'Vigilancia', body).classList.add('camview');
    this.camScreen = screen;
    renderTabs();
    requestAnimationFrame(place);
    this.resizeObs = new ResizeObserver(() => place());
    this.resizeObs.observe(screen);
    this.camTimer = setInterval(() => {
      if (endsGt) info.textContent = `Consulta remota: ${fmtTime(endsGt - store.gtNow())} s restantes.`;
      place();
    }, 500);
  }

  private occupancy() {
    const def = getMap((store.gstart?.mapId ?? 'train') as MapId);
    const tabs = h('div', { class: 'tabs' });
    let level = this.app.world.myPos().level;
    const renderTabs = () => {
      clear(tabs);
      for (const lv of [...def.levels].sort((a, b) => b.index - a.index)) tabs.append(h('button', { class: `tab${lv.id === level ? ' active' : ''}`, onclick: () => { level = lv.id; store.net?.act({ k: 'occ', level: lv.id }); renderTabs(); } }, lv.name));
    };
    renderTabs();
    this.occBody = h('div', { class: 'col' });
    this.frame('Panel de ocupación', h('div', { class: 'col' }, tabs,
      h('p', { class: 'small muted', style: 'margin:0' }, 'Cantidades aproximadas de empleados vivos en el nivel elegido, actualizadas cada 2 s. Incluye a quien está oculto en taquillas o invisible (son cuerpos reales). Excluye pasajeros, señuelos, expulsados y a quien está en trampillas o escaleras. Sin nombres ni colores.'),
      this.occBody));
  }

  private renderOcc(d: OccupancyData) {
    if (!this.occBody) return;
    clear(this.occBody);
    if (d.noSignal) { this.occBody.append(h('div', { class: 'nosignal', style: 'position:relative;height:120px;border-radius:10px' }, 'SIN SEÑAL')); return; }
    for (const z of d.zones) this.occBody.append(h('div', { class: 'occ-row' }, h('span', null, z.name), h('span', { class: 'n' }, z.count === null ? (z.noise ? '▒▒' : '—') : '●'.repeat(Math.min(z.count, 6)) || '0')));
  }

  private sabotage(station: string, options: { id: string; name: string; group?: string }[]) {
    const body = h('div', { class: 'col' },
      h('p', { class: 'small muted', style: 'margin:0' }, 'La preparación requiere unos segundos manipulando la instalación; se parece a una reparación normal.'),
      options.map((o) => h('button', { class: 'btn danger', onclick: () => { store.net?.act({ k: 'sabotage', st: station, opt: o.group }); store.panel = null; this.hide(); this.cur = null; }, html: `${ICONS.sabotage}<span>${o.name}</span>` })));
    this.frame('Instalación', body);
  }

  private vent(links: { id: string; name: string; extra: boolean }[]) {
    const priv = store.priv;
    const left = h('div', { class: 'small muted' });
    const body = h('div', { class: 'col' },
      h('p', { class: 'small muted', style: 'margin:0' }, 'Solo se muestran los destinos conectados. Dentro no puedes hacer tareas, sabotear ni atacar.'),
      links.map((l) => h('button', { class: `btn${l.extra ? ' info' : ''}`, onclick: () => store.net?.act({ k: 'vent', to: l.id }), html: `${ICONS.vent}<span>${l.name}${l.extra ? ' (ruta extra)' : ''}</span>` })),
      h('button', { class: 'btn primary', onclick: () => store.net?.act({ k: 'vent', exit: true }), html: `${ICONS.back}<span>SALIR AQUÍ</span>` }), left);
    this.frame('Red de trampillas', body);
    this.camTimer = setInterval(() => { left.textContent = priv ? `Tiempo restante dentro: ${fmtTime((store.priv?.ventUntilGt ?? 0) - store.gtNow())} s` : ''; }, 250);
  }

  private renderAnalyst(d: AnalystData) {
    if (!this.analyst) {
      this.analyst = h('div', { class: 'panel interactive', style: 'position:absolute;right:14px;top:120px;width:min(300px,80vw);z-index:20' });
      document.getElementById('ui')!.append(this.analyst);
    }
    clear(this.analyst);
    const bat = store.priv?.ability?.battery ?? 0;
    this.analyst.append(h('div', { class: 'row' }, h('span', { html: ICONS.analista, style: 'display:inline-flex;width:24px' }), h('b', { class: 'grow title' }, 'Diagnóstico portátil'), h('button', { class: 'btn icon ghost', onclick: () => { store.net?.act({ k: 'ability' }); this.closeAnalyst(); }, html: ICONS.close })));
    this.analyst.append(h('div', { class: 'small muted' }, `Batería: ${bat.toFixed(1)} s`));
    if (d.noSignal) { this.analyst.append(h('div', { class: 'nosignal', style: 'position:relative;height:90px;border-radius:8px;font-family:var(--font-title);display:flex;align-items:center;justify-content:center' }, 'SIN SEÑAL')); return; }
    this.analyst.append(h('div', { class: 'occ-row' }, h('span', null, `Responsable del viaje`), h('b', { style: `color:${d.responsible === 'operativo' ? 'var(--ok)' : 'var(--bad)'}` }, d.responsible === 'operativo' ? 'Operativo' : 'Constantes alteradas')));
    for (const s of d.systems) this.analyst.append(h('div', { class: 'occ-row' }, h('span', null, s.name), h('span', { class: 'small', style: `color:${s.state === 'ok' ? 'var(--ok)' : s.state === 'critico' ? 'var(--bad)' : 'var(--gold)'}` }, s.detail)));
    clearTimeout((this.analyst as unknown as { _t: number })._t);
    (this.analyst as unknown as { _t: number })._t = window.setTimeout(() => this.closeAnalyst(), 1500);
  }

  private closeAnalyst() { this.analyst?.remove(); this.analyst = null; }

  destroy() {
    this.hide();
    this.closeAnalyst();
  }
}

/** Selección de objetivo para habilidades que lo requieren. */
export function abilityDialog(app: App, role: RoleId) {
  const priv = store.priv!;
  const ab = priv.ability!;
  if (store.gtNow() < ab.cooldownEndsGt) { toast(`Habilidad en enfriamiento (${Math.ceil((ab.cooldownEndsGt - store.gtNow()) / 1000)} s).`, 'warn'); return; }
  const def = getMap((store.gstart?.mapId ?? 'train') as MapId);
  const list = h('div', { class: 'col' });
  let m: { close: () => void };
  if (role === 'rastreador') {
    const range = store.gstart?.settings.roles.rastreador.params.range ?? 160;
    const ents = app.world.visibleEntities(range);
    if (!ents.length) { toast('No hay nadie visible lo bastante cerca para marcar.', 'warn'); return; }
    for (const e of ents) list.append(h('button', { class: 'btn', onclick: () => { store.net?.act({ k: 'ability', target: e.h }); m.close(); }, html: `<span style="color:${COLORS[e.color]?.hex}">●</span><span>${e.name} (${Math.round(e.d)} u)</span>` }));
  } else if (role === 'camuflador') {
    for (const p of store.pub!.players.filter((x) => x.alive && !x.left && x.id !== store.net?.pid)) list.append(h('button', { class: 'btn', onclick: () => { store.net?.act({ k: 'ability', target: p.id }); m.close(); }, html: `<span style="color:${COLORS[p.color]?.hex}">●</span><span>Copiar a ${p.name}</span>` }));
  } else {
    for (const c of def.cameras) list.append(h('button', { class: 'btn', onclick: () => { store.net?.act({ k: 'ability', cam: c.id }); m.close(); }, html: `${ICONS.camera}<span>${c.name} · ${def.levels.find((l) => l.id === c.level)?.name}</span>` }));
  }
  m = modal(role === 'rastreador' ? 'Marcar a alguien' : role === 'camuflador' ? 'Elegir apariencia' : 'Elegir cámara', list);
}
