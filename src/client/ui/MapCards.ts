import { getMap, modeOf } from '../../shared/maps';
import type { GameMode, MapId } from '../../shared/maps/types';
import { makeCanvas } from '../art/draw';
import { h } from './dom';
import { levelBase } from './MapDraw';

const TRAVEL: MapId[] = ['ship', 'plane'];
const BG: Record<MapId, [string, string]> = {
  ship: ['#1f78ad', '#134d70'],
  plane: ['#8ec5ff', '#4b8fd6'],
  market: ['#4a5563', '#2f3742'],
};

export const MODE_INFO: Record<GameMode, { name: string; tag: string; text: string; rules: string[] }> = {
  travel: {
    name: 'VIAJE', tag: 'Barco o avión',
    text: 'Mantenimiento, servicio y sabotajes. El impostor prepara en secreto un arma para atacar al responsable del viaje.',
    rules: ['Trabajadores: expulsar al impostor o completar las tareas y llegar a destino.', 'Impostor: dejar que un crítico agote su plazo o atacar al responsable con el cuchillo.'],
  },
  market: {
    name: 'SUPERMERCADO', tag: 'Edificio propio',
    text: 'Todos los trabajadores conocen la misma comida; el impostor no. Cada uno compra un ingrediente, se revela en caja y se vota.',
    rules: ['Trabajadores: expulsar al impostor.', 'Impostor: sobrevivir hasta quedar con una sola persona más.'],
  },
};

/** Ilustración de tarjeta a partir del plano real (una sola planta) sobre su entorno. */
export function mapThumb(id: MapId, w = 480, h2 = 270): HTMLCanvasElement {
  const def = getMap(id);
  const c = makeCanvas(w, h2);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h2);
  g.addColorStop(0, BG[id][0]); g.addColorStop(1, BG[id][1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h2);
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#fff';
    if (id === 'ship') ctx.fillRect((i * 97) % w, (i * 53) % h2, 30, 3);
    else if (id === 'plane') { ctx.beginPath(); ctx.ellipse((i * 131) % w, (i * 71) % h2, 40, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#9fb3c8'; ctx.fillRect((i * 89) % w, (i * 61) % h2, 46, 22); }
  }
  ctx.globalAlpha = 1;
  const bh = Math.round(h2 * 0.82);
  const base = levelBase(def, def.levels[0].id, w - 30, bh, false);
  ctx.drawImage(base, 15, (h2 - bh) / 2);
  return c;
}

/** Ilustración del modo: compone sus mapas. */
function modeThumb(mode: GameMode, w = 480, h2 = 220): HTMLCanvasElement {
  const c = makeCanvas(w, h2);
  const ctx = c.getContext('2d')!;
  if (mode === 'travel') {
    const a = mapThumb('ship', w, h2), b = mapThumb('plane', w, h2);
    ctx.drawImage(a, 0, 0, w, h2, 0, 0, w, h2);
    ctx.save(); ctx.beginPath(); ctx.moveTo(w * 0.55, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h2); ctx.lineTo(w * 0.45, h2); ctx.closePath(); ctx.clip();
    ctx.drawImage(b, 0, 0, w, h2, 0, 0, w, h2); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.55, 0); ctx.lineTo(w * 0.45, h2); ctx.stroke();
  } else ctx.drawImage(mapThumb('market', w, h2), 0, 0);
  return c;
}

export function modeCards(selected: GameMode, onPick: ((m: GameMode) => void) | null): { el: HTMLElement; set: (m: GameMode) => void } {
  const cards = new Map<GameMode, HTMLElement>();
  const el = h('div', { class: 'maps modes' });
  for (const m of ['travel', 'market'] as GameMode[]) {
    const info = MODE_INFO[m];
    const card = h('button', { class: `mapcard${onPick ? '' : ' readonly'}`, type: 'button', 'aria-label': info.name, 'aria-pressed': String(m === selected), onclick: () => onPick?.(m) },
      modeThumb(m),
      h('div', { class: 'info' }, h('h3', null, info.name, h('span', { class: 'muted small' }, ` · ${info.tag}`)), h('p', null, info.text)));
    cards.set(m, card);
    el.append(card);
  }
  const set = (m: GameMode) => { for (const [k, c] of cards) { c.classList.toggle('sel', k === m); c.setAttribute('aria-pressed', String(k === m)); } };
  set(selected);
  return { el, set };
}

/** Tarjetas de mapa del modo elegido (Viaje: barco/avión; Supermercado: su edificio). */
export function mapCards(selected: MapId, onPick: ((id: MapId) => void) | null, mode: GameMode = modeOf(selected)): { el: HTMLElement; set: (id: MapId) => void } {
  const cards = new Map<MapId, HTMLElement>();
  const el = h('div', { class: 'maps' });
  const ids: MapId[] = mode === 'market' ? ['market'] : TRAVEL;
  for (const id of ids) {
    const def = getMap(id);
    const card = h('button', {
      class: `mapcard${onPick ? '' : ' readonly'}`, type: 'button', 'aria-label': def.name, 'aria-pressed': String(id === selected),
      onclick: () => onPick?.(id),
    }, mapThumb(id), h('div', { class: 'info' },
      h('h3', null, `${def.texts.short} · ${def.texts.vehicle}`),
      h('p', null, def.texts.description),
      h('p', { class: 'muted small' }, `Una sola planta. ${def.texts.routes}`),
    ));
    cards.set(id, card);
    el.append(card);
  }
  const set = (id: MapId) => { for (const [k, c] of cards) { c.classList.toggle('sel', k === id); c.setAttribute('aria-pressed', String(k === id)); } };
  set(selected);
  return { el, set };
}
