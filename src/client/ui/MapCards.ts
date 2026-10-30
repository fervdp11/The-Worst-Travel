import { getMap } from '../../shared/maps';
import type { MapId } from '../../shared/maps/types';
import { makeCanvas } from '../art/draw';
import { h } from './dom';
import { levelBase } from './MapDraw';

const ORDER: MapId[] = ['train', 'ship', 'plane'];
const BG: Record<MapId, [string, string]> = {
  train: ['#6a9a52', '#3f6b35'],
  ship: ['#1f78ad', '#134d70'],
  plane: ['#8ec5ff', '#4b8fd6'],
};

/** Ilustración de tarjeta: niveles del plano real superpuestos sobre el entorno del mapa. */
export function mapThumb(id: MapId, w = 480, h2 = 270): HTMLCanvasElement {
  const def = getMap(id);
  const c = makeCanvas(w, h2);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h2);
  g.addColorStop(0, BG[id][0]); g.addColorStop(1, BG[id][1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h2);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#fff';
    if (id === 'ship') { ctx.fillRect((i * 97) % w, (i * 53) % h2, 30, 3); }
    else if (id === 'plane') { ctx.beginPath(); ctx.ellipse((i * 131) % w, (i * 71) % h2, 40, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#2d6a4f'; ctx.beginPath(); ctx.arc((i * 89) % w, (i * 61) % h2, 14, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  const n = def.levels.length;
  const sorted = [...def.levels].sort((a, b) => a.index - b.index);
  sorted.forEach((lv, i) => {
    const bh = id === 'train' ? h2 * 0.42 : h2 * 0.8;
    const base = levelBase(def, lv.id, w - 30, Math.round(bh), false);
    const off = id === 'train' ? (i - (n - 1) / 2) * h2 * 0.32 : (i - (n - 1) / 2) * 14;
    ctx.globalAlpha = i === n - 1 || id === 'train' ? 1 : 0.55;
    ctx.drawImage(base, 15 + (id === 'train' ? 0 : i * 6), (h2 - bh) / 2 + off);
  });
  ctx.globalAlpha = 1;
  return c;
}

export function mapCards(selected: MapId, onPick: ((id: MapId) => void) | null): { el: HTMLElement; set: (id: MapId) => void } {
  const cards = new Map<MapId, HTMLElement>();
  const el = h('div', { class: 'maps' });
  for (const id of ORDER) {
    const def = getMap(id);
    const card = h('button', {
      class: `mapcard${onPick ? '' : ' readonly'}`, type: 'button', 'aria-label': def.name,
      onclick: () => onPick?.(id),
    }, mapThumb(id), h('div', { class: 'info' },
      h('h3', null, `${def.texts.short} · ${def.texts.vehicle}`),
      h('p', null, def.texts.description),
      h('p', null, `${def.levels.length} niveles: ${[...def.levels].sort((a, b) => a.index - b.index).map((l) => l.name).join(' / ')}. ${def.texts.routes}`),
    ));
    cards.set(id, card);
    el.append(card);
  }
  const set = (id: MapId) => { for (const [k, c] of cards) c.classList.toggle('sel', k === id); };
  set(selected);
  return { el, set };
}
