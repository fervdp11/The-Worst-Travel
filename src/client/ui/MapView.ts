import { getMap } from '../../shared/maps';
import type { MapDef } from '../../shared/maps/types';
import { makeCanvas } from '../art/draw';
import { store } from '../state';
import type { App } from './App';
import { clear, h } from './dom';
import { levelBase, toScreen, xformFor } from './MapDraw';

function levelOrder(def: MapDef) {
  return [...def.levels].sort((a, b) => b.index - a.index);
}

interface Marker { x: number; y: number; level: string; color: string; shape: 'task' | 'repair' | 'sab' | 'knife' | 'track' | 'sensor'; label?: string; age?: number }

function collectMarkers(def: MapDef): Marker[] {
  const out: Marker[] = [];
  const priv = store.priv, pub = store.pub;
  if (!priv || !pub) return out;
  const st = (id: string) => def.stations.find((s) => s.id === id);
  for (const t of priv.tasks) {
    if (t.done || !t.station) continue;
    const s = st(t.station);
    if (s) out.push({ x: s.x, y: s.y, level: s.level, color: '#ffd23f', shape: 'task', label: t.name });
  }
  const sab = pub.sabotage;
  if (sab && sab.kind !== 'doors') {
    const step = sab.steps[sab.step];
    for (const id of step?.stations ?? []) { const s = st(id); if (s) out.push({ x: s.x, y: s.y, level: s.level, color: '#ff4d5e', shape: 'repair', label: step.label }); }
  }
  // Información privada del impostor (solo en su mapa)
  if (priv.team === 'impostor' || store.room?.practice) for (const s of priv.sabotageStations) out.push({ x: s.x, y: s.y, level: s.level, color: '#ff6b81', shape: 'sab', label: s.name });
  if (priv.knife) for (const k of priv.knife.hints) out.push({ x: k.x, y: k.y, level: k.level, color: '#c77dff', shape: 'knife', label: k.name });
  const gt = store.gtNow();
  if (priv.tracker) for (const r of priv.tracker.readings) if (!r.none) out.push({ x: r.x, y: r.y, level: r.l, color: '#5cc8ff', shape: 'track', age: Math.round((gt - r.gt) / 1000) });
  if (priv.sensor) out.push({ x: priv.sensor.x, y: priv.sensor.y, level: priv.sensor.l, color: '#3ddc97', shape: 'sensor', label: priv.sensor.noSignal ? 'Sensor SIN SEÑAL' : `Sensor: ${priv.sensor.passes.length} pasos` });
  return out;
}

function drawMarkers(ctx: CanvasRenderingContext2D, def: MapDef, level: string, w: number, hh: number, scale: number, now: number) {
  const X = xformFor(def, w, hh);
  const idx = (id: string) => def.levels.find((l) => l.id === id)?.index ?? 0;
  for (const m of collectMarkers(def)) {
    const p = toScreen(X, m.x, m.y);
    const other = m.level !== level;
    ctx.save();
    ctx.globalAlpha = other ? 0.55 : 1;
    ctx.fillStyle = m.color;
    ctx.strokeStyle = '#1d1830';
    ctx.lineWidth = 2;
    const r = 6 * scale;
    ctx.beginPath();
    if (m.shape === 'task') { ctx.moveTo(p.x, p.y - r * 1.3); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r * 1.3); ctx.lineTo(p.x - r, p.y); ctx.closePath(); }
    else if (m.shape === 'repair') { const k = 1 + Math.sin(now / 150) * 0.2; ctx.arc(p.x, p.y, r * 1.2 * k, 0, Math.PI * 2); }
    else if (m.shape === 'sab') { ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.lineTo(p.x - r, p.y + r); ctx.closePath(); }
    else if (m.shape === 'knife') { ctx.rect(p.x - r * 0.8, p.y - r * 0.8, r * 1.6, r * 1.6); }
    else ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (other) {
      // Indica si el marcador está arriba o abajo
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(11 * scale)}px "Baloo 2", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(idx(m.level) > idx(level) ? '▲' : '▼', p.x, p.y - r * 1.6);
    }
    if (m.age !== undefined) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(10 * scale)}px Nunito`; ctx.textAlign = 'left'; ctx.fillText(`hace ${m.age} s`, p.x + r + 2, p.y + 3); }
    ctx.restore();
  }
}

function drawSelf(ctx: CanvasRenderingContext2D, def: MapDef, w: number, hh: number, x: number, y: number, scale: number, now: number) {
  const X = xformFor(def, w, hh);
  const p = toScreen(X, x, y);
  const k = 1 + Math.sin(now / 200) * 0.15;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(p.x, p.y, 13 * scale * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1d1830'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, 6.5 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** Mapa ampliado con selector de nivel propio de cada vehículo. */
export function openMap(app: App) {
  if (document.querySelector('.mapview')) { document.querySelector('.mapview')!.remove(); return; }
  const def = getMap(store.gstart?.mapId ?? 'train');
  const w = app.world;
  let level = w.myPos().level;
  const W = 1600, H = def.id === 'train' ? 520 : def.id === 'plane' ? 1000 : 820;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const tabs = h('div', { class: 'tabs' });
  const info = h('div', { class: 'small' });
  const renderTabs = () => {
    clear(tabs);
    for (const lv of levelOrder(def)) tabs.append(h('button', { class: `tab${lv.id === level ? ' active' : ''}`, onclick: () => { level = lv.id; renderTabs(); } }, `${lv.name}${lv.id === w.myPos().level ? ' · aquí' : ''}`));
  };
  renderTabs();
  let raf = 0;
  const draw = () => {
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(levelBase(def, level, W, H), 0, 0);
    drawMarkers(ctx, def, level, W, H, 2, now);
    const me = w.myPos();
    if (me.level === level) drawSelf(ctx, def, W, H, me.x, me.y, 2, now);
    const lvName = def.levels.find((l) => l.id === level)?.name;
    const hereName = def.levels.find((l) => l.id === me.level)?.name;
    info.textContent = `Inspeccionando: ${lvName} · Estás en: ${hereName}`;
    raf = requestAnimationFrame(draw);
  };
  const legend = h('div', { class: 'legend' },
    h('span', null, h('i', { style: 'background:#fff' }), 'Tú'),
    h('span', null, h('i', { style: 'background:#ffd23f;border-radius:2px' }), 'Tareas pendientes'),
    h('span', null, h('i', { style: 'background:#ff4d5e' }), 'Reparación activa'),
    h('span', null, h('i', { style: 'background:#5cc8ff' }), 'Escaleras/accesos'),
    h('span', null, h('i', { style: 'background:#ffd23f;border-radius:0' }), 'Puertas cerrables'),
    store.priv?.team === 'impostor' ? h('span', null, h('i', { style: 'background:#ff6b81' }), 'Sabotajes (privado)') : null,
    store.priv?.knife ? h('span', null, h('i', { style: 'background:#c77dff;border-radius:2px' }), 'Pistas del arma (privado)') : null,
    h('span', null, '▲▼ en otro nivel'),
  );
  const back = h('div', { class: 'mapview' }, h('div', { class: 'panel' },
    h('div', { class: 'row wrap' }, h('h2', { class: 'grow' }, `Mapa · ${def.texts.vehicle}`), tabs, h('button', { class: 'btn icon ghost', onclick: () => close(), html: '✕' })),
    canvas, h('div', { class: 'row wrap' }, info, h('span', { class: 'grow' }), legend)));
  const close = () => { cancelAnimationFrame(raf); back.remove(); document.removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'm' || e.key === 'Tab') { if (!app.typing()) { e.preventDefault(); e.stopPropagation(); close(); } } };
  setTimeout(() => document.addEventListener('keydown', key), 0);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.getElementById('ui')!.append(back);
  draw();
}

/** Minimapa compacto del nivel actual (geometría cacheada; solo se redibujan marcadores). */
export class MiniMap {
  el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private def: MapDef;
  private collapsed = false;
  constructor(private app: App) {
    this.def = getMap(store.gstart?.mapId ?? 'train');
    const W = 300, H = this.def.id === 'train' ? 90 : 170;
    this.el = makeCanvas(W, H);
    this.el.className = 'panel interactive';
    this.el.style.cssText = `padding:0;width:${W / 1.25}px;height:${H / 1.25}px;cursor:pointer`;
    this.el.title = 'Minimapa (clic para plegar)';
    this.ctx = this.el.getContext('2d')!;
    this.el.addEventListener('click', () => { this.collapsed = !this.collapsed; this.el.style.opacity = this.collapsed ? '0.35' : '1'; });
  }
  draw() {
    if (this.collapsed) return;
    const w = this.app.world;
    const me = w.myPos();
    if (!me.level || !this.def.levels.some((l) => l.id === me.level)) return;
    const W = this.el.width, H = this.el.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(levelBase(this.def, me.level, W, H, false), 0, 0);
    const now = performance.now();
    drawMarkers(ctx, this.def, me.level, W, H, 0.7, now);
    drawSelf(ctx, this.def, W, H, me.x, me.y, 0.7, now);
    ctx.fillStyle = '#ffd23f'; ctx.font = '900 12px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText((this.def.levels.find((l) => l.id === me.level)?.name ?? '').toUpperCase(), 6, 14);
  }
  destroy() { this.el.remove(); }
}
