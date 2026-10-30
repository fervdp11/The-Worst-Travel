import { getMap } from '../../shared/maps';
import type { MapDef } from '../../shared/maps/types';
import { makeCanvas } from '../art/draw';
import { store } from '../state';
import type { App } from './App';
import { h } from './dom';
import { levelBase, toScreen, xformFor } from './MapDraw';

interface Marker { x: number; y: number; color: string; shape: 'task' | 'repair' | 'sab' | 'knife' | 'area' | 'track' | 'sensor' | 'checkout'; label?: string; age?: number; w?: number; h?: number }

/**
 * Marcadores del jugador. Cada uno se resuelve por ID a un objetivo vigente y a
 * una estación REAL del mapa actual y su única planta; si la relación falla no
 * se dibuja ningún marcador genérico (y se avisa en depuración).
 */
function collectMarkers(def: MapDef): Marker[] {
  const out: Marker[] = [];
  const priv = store.priv, pub = store.pub;
  if (!priv || !pub) return out;
  const level = def.levels[0].id;
  const st = (id: string) => {
    const s = def.stations.find((x) => x.id === id && x.level === level);
    if (!s && app_debug()) console.warn('Marcador sin estación válida:', id);
    return s;
  };
  if (pub.mode === 'market') {
    // Solo orientación: la caja cuando llevas compra. Nunca ingredientes, jugadores ni bolsas ajenas.
    if (priv.market?.carrying && def.market) { const s = st(def.market.checkout); if (s) out.push({ x: s.x, y: s.y, color: '#3ddc97', shape: 'checkout', label: 'Caja' }); }
    return out;
  }
  for (const t of priv.tasks) {
    if (t.done || !t.station) continue;
    const s = st(t.station);
    if (s) out.push({ x: s.x, y: s.y, color: '#ffd23f', shape: 'task', label: t.name });
  }
  const sab = pub.sabotage;
  if (sab && sab.kind !== 'doors') {
    const step = sab.steps[sab.step];
    for (const id of step?.stations ?? []) { const s = st(id); if (s) out.push({ x: s.x, y: s.y, color: '#ff4d5e', shape: 'repair', label: step.label }); }
  }
  // Información privada del impostor (solo en su propia interfaz)
  if (priv.team === 'impostor') {
    for (const s of priv.sabotageStations) { const real = st(s.id); if (real) out.push({ x: real.x, y: real.y, color: '#ff6b81', shape: 'sab', label: s.name }); }
    if (priv.knife) {
      for (const k of priv.knife.hints) {
        if (k.id === 'resp') { out.push({ x: k.x, y: k.y, color: '#c77dff', shape: 'knife', label: k.name }); continue; }
        const real = st(k.id);
        if (!real) continue;
        // Si la pista solo indica la sala, se resalta la sala; nunca el punto exacto.
        const room = def.rooms.find((r) => r.name === k.name && r.level === level);
        if (room && (k.x !== real.x || k.y !== real.y)) out.push({ x: room.rect.x, y: room.rect.y, w: room.rect.w, h: room.rect.h, color: '#c77dff', shape: 'area', label: room.name });
        else out.push({ x: real.x, y: real.y, color: '#c77dff', shape: 'knife', label: real.name });
      }
    }
  }
  const gt = store.gtNow();
  if (priv.tracker) for (const r of priv.tracker.readings) if (!r.none) out.push({ x: r.x, y: r.y, color: '#5cc8ff', shape: 'track', age: Math.round((gt - r.gt) / 1000) });
  if (priv.sensor) out.push({ x: priv.sensor.x, y: priv.sensor.y, color: '#3ddc97', shape: 'sensor', label: priv.sensor.noSignal ? 'Sensor SIN SEÑAL' : `Sensor: ${priv.sensor.passes.length} pasos` });
  return out;
}

function app_debug(): boolean { return !!(globalThis as { __twtDebug?: boolean }).__twtDebug; }

function drawMarkers(ctx: CanvasRenderingContext2D, def: MapDef, w: number, hh: number, scale: number, now: number) {
  const X = xformFor(def, w, hh);
  for (const m of collectMarkers(def)) {
    const p = toScreen(X, m.x, m.y);
    ctx.save();
    ctx.fillStyle = m.color;
    ctx.strokeStyle = '#1d1830';
    ctx.lineWidth = 2;
    const r = 6 * scale;
    ctx.beginPath();
    if (m.shape === 'area') {
      ctx.globalAlpha = 0.35 + Math.sin(now / 300) * 0.1;
      ctx.fillRect(p.x, p.y, (m.w ?? 0) * X.s, (m.h ?? 0) * X.s);
      ctx.globalAlpha = 1; ctx.setLineDash([6, 4]); ctx.strokeStyle = m.color; ctx.strokeRect(p.x, p.y, (m.w ?? 0) * X.s, (m.h ?? 0) * X.s);
      ctx.restore();
      continue;
    }
    if (m.shape === 'task') { ctx.moveTo(p.x, p.y - r * 1.3); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r * 1.3); ctx.lineTo(p.x - r, p.y); ctx.closePath(); }
    else if (m.shape === 'repair') { const k = 1 + Math.sin(now / 300) * 0.12; ctx.arc(p.x, p.y, r * 1.2 * k, 0, Math.PI * 2); }
    else if (m.shape === 'sab') { ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.lineTo(p.x - r, p.y + r); ctx.closePath(); }
    else if (m.shape === 'knife') { ctx.rect(p.x - r * 0.8, p.y - r * 0.8, r * 1.6, r * 1.6); }
    else if (m.shape === 'checkout') { ctx.rect(p.x - r * 1.4, p.y - r * 0.9, r * 2.8, r * 1.8); }
    else ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
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

function sizeFor(def: MapDef, W: number): number {
  const X = xformFor(def, 1000, 1000);
  return Math.round(W * (X.box.h / X.box.w));
}

/**
 * Mapa ampliado de la única planta. Incluye un panel lateral con el objetivo
 * actual para que siga legible mientras el mapa está abierto.
 */
export function openMap(app: App, side?: () => HTMLElement | null) {
  if (document.querySelector('.mapview')) { document.querySelector('.mapview')!.remove(); return; }
  const def = getMap(store.gstart?.mapId ?? 'ship');
  const w = app.world;
  const W = 1600, H = Math.min(1100, sizeFor(def, W));
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  let raf = 0;
  const draw = () => {
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(levelBase(def, def.levels[0].id, W, H), 0, 0);
    drawMarkers(ctx, def, W, H, 2, now);
    const me = w.myPos();
    drawSelf(ctx, def, W, H, me.x, me.y, 2, now);
    raf = requestAnimationFrame(draw);
  };
  const imp = store.priv?.team === 'impostor' && store.pub?.mode === 'travel';
  const legend = h('div', { class: 'legend' },
    h('span', null, h('i', { style: 'background:#fff' }), 'Tú'),
    store.pub?.mode === 'market'
      ? h('span', null, h('i', { style: 'background:#3ddc97;border-radius:2px' }), 'Caja (entrega)')
      : h('span', null, h('i', { style: 'background:#ffd23f;border-radius:2px' }), 'Tus tareas pendientes'),
    store.pub?.mode === 'travel' ? h('span', null, h('i', { style: 'background:#ff4d5e' }), 'Reparación activa') : null,
    store.pub?.mode === 'travel' ? h('span', null, h('i', { style: 'background:#ffd23f;border-radius:0' }), 'Puertas cerrables') : null,
    imp ? h('span', null, h('i', { style: 'background:#ff6b81' }), 'Sabotajes (privado)') : null,
    imp && store.priv?.knife ? h('span', null, h('i', { style: 'background:#c77dff;border-radius:2px' }), 'Pista del arma (privado)') : null,
  );
  const sidePanel = side?.() ?? null;
  const back = h('div', { class: 'mapview' }, h('div', { class: `panel${sidePanel ? ' with-side' : ''}` },
    h('div', { class: 'row wrap' }, h('h2', { class: 'grow' }, `Mapa · ${def.texts.vehicle}`), h('button', { class: 'btn icon ghost', 'aria-label': 'Cerrar mapa', onclick: () => close(), html: '✕' })),
    h('div', { class: 'mapview-body' }, canvas, sidePanel), h('div', { class: 'row wrap' }, h('span', { class: 'grow' }), legend)));
  const close = () => { cancelAnimationFrame(raf); back.remove(); document.removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'm' || e.key === 'Tab') { if (!app.typing()) { e.preventDefault(); e.stopPropagation(); close(); } } };
  setTimeout(() => document.addEventListener('keydown', key), 0);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.getElementById('ui')!.append(back);
  draw();
}

/** Minimapa compacto (geometría cacheada; solo se redibujan marcadores). */
export class MiniMap {
  el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private def: MapDef;
  private collapsed = false;
  constructor(private app: App) {
    this.def = getMap(store.gstart?.mapId ?? 'ship');
    const W = 300, H = Math.min(200, sizeFor(this.def, W));
    this.el = makeCanvas(W, H);
    this.el.className = 'panel interactive minimap';
    this.el.style.cssText = `padding:0;width:${W / 1.25}px;height:${H / 1.25}px;cursor:pointer`;
    this.el.title = 'Minimapa (clic para plegar)';
    this.ctx = this.el.getContext('2d')!;
    this.el.addEventListener('click', () => { this.collapsed = !this.collapsed; this.el.classList.toggle('collapsed', this.collapsed); });
  }
  draw() {
    if (this.collapsed) return;
    const me = this.app.world.myPos();
    if (!me.level) return;
    const W = this.el.width, H = this.el.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(levelBase(this.def, this.def.levels[0].id, W, H, false), 0, 0);
    const now = performance.now();
    drawMarkers(ctx, this.def, W, H, 0.7, now);
    drawSelf(ctx, this.def, W, H, me.x, me.y, 0.7, now);
  }
  destroy() { this.el.remove(); }
}
