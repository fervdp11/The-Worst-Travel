import { PRODUCT_BY_ID } from '../../shared/market';
import { drawProductIcon } from '../art/products';
/** Utilidades DOM mínimas para la interfaz (sin dependencias). */
type Attrs = Record<string, unknown> & { class?: string; style?: string };
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k.includes('-') || k === 'role' || k === 'tabindex' || k === 'for') el.setAttribute(k, v === true ? '' : String(v));
      else if (v === true && !(k in el)) el.setAttribute(k, '');
      else (el as unknown as Record<string, unknown>)[k] = v;
    }
  }
  append(el, children);
  return el;
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function uiRoot(): HTMLElement {
  return document.getElementById('ui')!;
}

let toastBox: HTMLElement | null = null;
export function toast(text: string, tone: 'info' | 'warn' | 'ok' | 'bad' = 'info', ms = 2600) {
  if (!toastBox || !toastBox.isConnected) {
    toastBox = h('div', { id: 'toasts' });
    uiRoot().append(toastBox);
  }
  const t = h('div', { class: `toast ${tone}` }, text);
  toastBox.append(t);
  while (toastBox.children.length > 4) toastBox.firstChild!.remove();
  setTimeout(() => { t.style.transition = 'opacity 200ms'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms);
}

export function modal(title: string, body: Node, opts: { wide?: boolean; onClose?: () => void; actions?: Node[] } = {}): { el: HTMLElement; close: () => void } {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); opts.onClose?.(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey);
  const panel = h('div', { class: `panel modal${opts.wide ? ' wide' : ''}` },
    h('div', { class: 'head' }, h('h2', null, title), h('button', { class: 'btn icon ghost', title: 'Cerrar', onclick: close, html: ICONS.close })),
    h('div', { class: 'body scroll' }, body),
    opts.actions ? h('div', { class: 'row wrap', style: 'margin-top:12px;justify-content:flex-end' }, opts.actions) : null,
  );
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  back.append(panel);
  uiRoot().append(back);
  return { el: panel, close };
}

/** Convención única: segundos restantes redondeados hacia arriba y limitados a cero. */
export function fmtTime(ms: number): string {
  return fmtSecs(Math.max(0, Math.ceil(ms / 1000)));
}

export function fmtSecs(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`;
}

/** Icono de producto (cacheado por producto y tamaño). */
const productCache = new Map<string, HTMLCanvasElement>();
export function productIcon(id: string, size = 32): HTMLCanvasElement {
  const key = `${id}|${size}`;
  let base = productCache.get(key);
  if (!base) {
    base = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    base.width = base.height = Math.round(size * dpr);
    const ctx = base.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const p = PRODUCT_BY_ID[id];
    if (p) drawProductIcon(ctx, p, size / 2, size / 2, size * 0.9);
    productCache.set(key, base);
  }
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  c.style.width = c.style.height = `${size}px`;
  c.className = 'picon';
  c.getContext('2d')!.drawImage(base, 0, 0);
  return c;
}

const svg = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Familia única de iconos de trazo. */
export const ICONS: Record<string, string> = {
  play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
  practice: svg('<path d="M4 20l4-12 4 6 4-10 4 16"/><circle cx="12" cy="4" r="1.5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17h.01"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  map: svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
  hand: svg('<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.6L8 15"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  locker: svg('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 6h6M9 9h6M14 14v2"/>'),
  vent: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 9v6M11 9v6M15 9v6M19 9v6"/>'),
  sabotage: svg('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
  knife: svg('<path d="M3 21l8-8M11 13l9-9c1 3 0 6-3 8l-4 3z"/>'),
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0121.5 19"/>'),
  crown: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
  wifi: svg('<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19" r="1"/>'),
  task: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  alarm: svg('<path d="M12 4a7 7 0 017 7v5l2 3H3l2-3v-5a7 7 0 017-7zM10 21h4"/>'),
  camera: svg('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  door: svg('<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M15 12h.01"/>'),
  emergency: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'),
  market: svg('<path d="M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>'),
  cart: svg('<path d="M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>'),
  bag: svg('<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>'),
  scan: svg('<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 12h10"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  ship: svg('<path d="M3 15l2 5h14l2-5zM6 15V9h12v6M10 9V5h4v4"/>'),
  plane: svg('<path d="M2 13l8-2 4-8 2 1-2 8 7 3v2l-8-1-3 6h-2l1-6-7-1z"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  vote: svg('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M9 10V4h6v6M10 15h4"/>'),
  skip: svg('<path d="M5 5l9 7-9 7zM17 5v14"/>'),
  attack: svg('<path d="M14 4l6 6M18 2l4 4M4 20l10-10M3 14l7 7"/>'),
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9zM17 8a5 5 0 010 8M19.5 5.5a8.5 8.5 0 010 13"/>'),
  pad: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/>'),
  sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  // Roles
  ingeniero: svg('<path d="M14 7l3-3 3 3-3 3M4 20l9-9M11 7l6 6"/><rect x="2" y="16" width="6" height="6" rx="1"/>'),
  analista: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M6 13l3-3 3 2 5-5M8 21h8"/>'),
  rastreador: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  observador: svg('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/><circle cx="9.5" cy="12" r="2"/>'),
  tecnico: svg('<path d="M14.5 6.5a4 4 0 015 5L13 18l-3 3-4-4 3-3 6.5-6.5z"/><path d="M5 19l-2 2"/>'),
  explorador: svg('<path d="M13 4a2 2 0 11-4 0 2 2 0 014 0zM7 21l3-7 3 3v5M10 14l-1-5 4-1 3 4 3 1M4 12l3-3 2 0"/>'),
  vigilante: svg('<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  camuflador: svg('<circle cx="8" cy="9" r="4"/><circle cx="16" cy="9" r="4" stroke-dasharray="2 2"/><path d="M2 21a6 6 0 0112 0M10 21a6 6 0 0112 0" />'),
  espectro: svg('<path d="M5 21V11a7 7 0 0114 0v10l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2z"/><path d="M9.5 11h.01M14.5 11h.01"/>'),
  saboteador: svg('<path d="M10 14l-6 6M14 4l6 6-4 4-6-6z"/><path d="M13 13l2 2"/>'),
  interferente: svg('<path d="M12 12v10M8 6a6 6 0 018 0M5 3a10 10 0 0114 0"/><path d="M3 21l18-18" stroke-dasharray="3 2"/>'),
  escapista: svg('<rect x="3" y="14" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><path d="M7 14c0-5 4-7 10-4" stroke-dasharray="3 2"/>'),
  senuelo: svg('<circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0112 0"/><circle cx="16" cy="8" r="4" opacity=".4"/><path d="M14 15a6 6 0 017 6" opacity=".4"/>'),
};

export function iconEl(name: string, cls = ''): HTMLElement {
  return h('span', { class: `ico ${cls}`, html: ICONS[name] ?? ICONS.help, style: 'display:inline-flex' });
}
