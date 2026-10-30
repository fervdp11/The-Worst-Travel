import { COLORS } from '../../shared/constants';
import type { MapId } from '../../shared/maps/types';
import type { EndResult } from '../../shared/protocol';
import { fillStroke, makeCanvas, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { h, uiRoot } from './dom';
import { portrait } from './Portrait';

/** Sprites laterales de los vehículos (se pintan una vez y luego solo se transforman). */
function vehicle(map: MapId): HTMLCanvasElement {
  if (map === 'train') {
    const c = makeCanvas(900, 110); const g = c.getContext('2d')!; g.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 148;
      rr(g, x, 18, 138, 62, 10); fillStroke(g, vgrad(g, 18, 80, i === 0 ? '#e04b58' : '#8c3443', i === 0 ? '#9e2531' : '#5d1f2b'), INK, 3);
      g.fillStyle = '#d9a441'; g.fillRect(x + 4, 58, 130, 4);
      for (let k = 0; k < 4; k++) { rr(g, x + 12 + k * 31, 28, 22, 18, 4); fillStroke(g, '#bfe3ff', INK, 1.5); }
      for (const wx of [x + 26, x + 112]) { g.beginPath(); g.arc(wx, 88, 12, 0, Math.PI * 2); fillStroke(g, '#2b2d42', INK, 2.5); }
    }
    return c;
  }
  if (map === 'ship') {
    const c = makeCanvas(620, 230); const g = c.getContext('2d')!; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(10, 130); g.lineTo(610, 130); g.lineTo(550, 214); g.lineTo(70, 214); g.closePath(); fillStroke(g, '#20375c', INK, 3);
    g.fillStyle = '#e63946'; g.fillRect(48, 190, 520, 9);
    rr(g, 100, 70, 380, 62, 8); fillStroke(g, '#f1ede4', INK, 3);
    rr(g, 170, 26, 240, 46, 8); fillStroke(g, '#f1ede4', INK, 3);
    for (let k = 0; k < 11; k++) { g.beginPath(); g.arc(130 + k * 32, 100, 9, 0, Math.PI * 2); fillStroke(g, '#5fa8d3', INK, 1.5); }
    rr(g, 370, 0, 50, 30, 5); fillStroke(g, '#d62828', INK, 3);
    return c;
  }
  const c = makeCanvas(600, 220); const g = c.getContext('2d')!; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(250, 110); g.lineTo(380, 10); g.lineTo(420, 10); g.lineTo(350, 110); g.closePath(); fillStroke(g, '#c3ccd8', INK, 3);
  rr(g, 10, 90, 560, 68, 34); fillStroke(g, vgrad(g, 90, 158, '#ffffff', '#c9d2de'), INK, 3);
  g.beginPath(); g.moveTo(480, 94); g.lineTo(570, 24); g.lineTo(590, 24); g.lineTo(565, 104); g.closePath(); fillStroke(g, '#2f6fb3', INK, 3);
  for (let k = 0; k < 18; k++) { rr(g, 110 + k * 20, 106, 10, 13, 4); fillStroke(g, '#2f4f75', INK, 1); }
  g.fillStyle = '#2f6fb3'; g.fillRect(16, 136, 548, 6);
  g.beginPath(); g.moveTo(250, 150); g.lineTo(330, 200); g.lineTo(370, 200); g.lineTo(330, 150); g.closePath(); fillStroke(g, '#c3ccd8', INK, 3);
  return c;
}

function bgPaint(g: CanvasRenderingContext2D, map: MapId, W: number, H: number, t: number, mood: 'happy' | 'bad') {
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (mood === 'bad') { sky.addColorStop(0, '#2a1830'); sky.addColorStop(1, '#5a2a2a'); }
  else if (map === 'plane') { sky.addColorStop(0, '#5aa5ec'); sky.addColorStop(1, '#ffd6a5'); }
  else { sky.addColorStop(0, '#6cb6ef'); sky.addColorStop(1, '#ffe8c2'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (map === 'ship') { g.fillStyle = mood === 'bad' ? '#16324a' : '#1f78ad'; g.fillRect(0, H * 0.62, W, H); g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(((i * 97 - t * 120) % W + W) % W, H * 0.66 + (i % 6) * 22, 50, 3); }
  else if (map === 'train') { g.fillStyle = mood === 'bad' ? '#3b4a2f' : '#6a9a52'; g.fillRect(0, H * 0.7, W, H); g.fillStyle = '#6b4f35'; for (let x = -((t * 400) % 40); x < W; x += 40) g.fillRect(x, H * 0.78, 14, 18); g.fillStyle = '#c9ced8'; g.fillRect(0, H * 0.78, W, 4); }
  else { g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 8; i++) { const x = ((i * 260 - t * 200) % (W + 300) + W + 300) % (W + 300) - 150; g.beginPath(); g.ellipse(x, H * (0.2 + (i % 4) * 0.18), 110, 34, 0, 0, Math.PI * 2); g.fill(); } }
}

/** Expulsión cómica: puerta lateral, pasarela con chapuzón o compuerta de servicio. */
export function ejectionScene(host: HTMLElement, map: MapId, color: number, acc: number, text: string, durMs: number): () => void {
  const c = makeCanvas(10, 10);
  host.append(c);
  const g = c.getContext('2d')!;
  const who = portrait(color, acc, 64);
  const t0 = performance.now();
  let raf = 0;
  audio.sfx('eject');
  const frame = () => {
    const W = host.clientWidth || 800, H = host.clientHeight || 450;
    if (c.width !== W) { c.width = W; c.height = H; }
    const t = (performance.now() - t0) / 1000;
    const k = Math.min(1, t / (durMs / 1000));
    bgPaint(g, map, W, H, t, 'happy');
    const reduce = store.prefs.reduceMotion;
    // Puerta / dispositivo del vehículo
    g.save();
    const doorX = W * 0.18, doorY = H * 0.28;
    rr(g, doorX - 60, doorY, 120, H * 0.42, 10); fillStroke(g, map === 'plane' ? '#e9eef5' : map === 'ship' ? '#f1ede4' : '#8c3443', INK, 4);
    g.fillStyle = '#10131f'; rr(g, doorX - 44, doorY + 16, 88, H * 0.42 - 32, 8); g.fill();
    // Bota mecánica
    const kick = Math.min(1, Math.max(0, (t - 0.6) / 0.25));
    g.translate(doorX - 70 + kick * 60, doorY + H * 0.22);
    g.rotate(-0.5 + kick * 0.9);
    rr(g, -10, -70, 22, 70, 6); fillStroke(g, '#5c677d', INK, 3);
    rr(g, -14, -8, 56, 26, 10); fillStroke(g, '#2b2d42', INK, 3);
    g.restore();
    // Personaje expulsado
    const ft = Math.max(0, t - 0.8);
    let px = doorX + 10 + ft * W * 0.32, py = doorY + H * 0.2 - Math.sin(Math.min(ft, 2.2) * 1.4) * H * 0.22 + ft * ft * (map === 'ship' ? 60 : 20);
    if (map === 'ship') py = Math.min(py, H * 0.64);
    g.save();
    g.translate(px, py);
    if (!reduce) g.rotate(ft * 7);
    g.drawImage(who, -48, -48, 96, 96);
    g.restore();
    if (map === 'ship' && py >= H * 0.64 - 1) {
      g.strokeStyle = '#ff4d5e'; g.lineWidth = 10; g.beginPath(); g.arc(px, H * 0.64, 34, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(px - 40 + i * 16, H * 0.62 - Math.abs(Math.sin(t * 6 + i)) * 20, 7, 0, Math.PI * 2); g.fill(); }
    }
    if (map === 'plane' && ft > 1.2) { // paraguas cómico
      g.save(); g.translate(px, py - 70); g.fillStyle = '#ff8a3d'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 50, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 40); g.stroke(); g.restore();
    }
    // Texto de revelación
    g.globalAlpha = Math.min(1, Math.max(0, (k - 0.45) * 3));
    g.font = `800 ${Math.max(22, Math.min(48, W / 22))}px "Baloo 2", sans-serif`;
    g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = INK; g.fillStyle = '#fff';
    g.strokeText(text, W / 2, H * 0.88); g.fillText(text, W / 2, H * 0.88);
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => { cancelAnimationFrame(raf); c.remove(); };
}

/** Desenlace propio de cada mapa (estilizado, sin gore). */
export function playCinematic(app: App, r: EndResult): Promise<void> {
  if (r.cause === 'ejected' || r.cause === 'abandon' || r.cause === 'cancelled') return Promise.resolve();
  const map = (store.gstart?.mapId ?? 'train') as MapId;
  const happy = r.winner === 'workers';
  const root = h('div', { class: 'cine' });
  const c = makeCanvas(10, 10);
  root.append(c, h('div', { class: 'txt' }, r.title));
  uiRoot().append(root);
  const g = c.getContext('2d')!;
  const v = vehicle(map);
  const t0 = performance.now();
  const dur = 4200;
  audio.sfx(happy ? 'win' : 'crash');
  const scene = r.scene;
  return new Promise((resolve) => {
    let raf = 0;
    const skip = () => { cancelAnimationFrame(raf); root.remove(); resolve(); };
    root.addEventListener('pointerdown', skip);
    const frame = () => {
      const W = window.innerWidth, H = window.innerHeight;
      if (c.width !== W) { c.width = W; c.height = H; }
      const t = (performance.now() - t0) / 1000;
      const k = Math.min(1, t / (dur / 1000));
      bgPaint(g, map, W, H, happy ? t * (1 - k) : t, happy ? 'happy' : 'bad');
      const vw = Math.min(W * 0.8, v.width), vh = vw * (v.height / v.width);
      let x = W / 2 - vw / 2, y = map === 'train' ? H * 0.78 - vh + 6 : map === 'ship' ? H * 0.64 - vh * 0.85 : H * 0.4 - vh / 2;
      let rot = 0;
      if (happy) {
        if (map === 'train') { g.fillStyle = '#bfb6a8'; g.fillRect(W * 0.55, H * 0.66, W * 0.45, H * 0.1); g.fillStyle = '#ffd23f'; g.fillRect(W * 0.55, H * 0.66, W * 0.45, 6); x -= (1 - k) * W * 0.4; }
        if (map === 'ship') { g.fillStyle = '#8d6e52'; g.fillRect(0, H * 0.58, W * 0.25, H * 0.08); x -= (1 - k) * W * 0.3 - W * 0.05; }
        if (map === 'plane') { g.fillStyle = '#4a4e57'; g.fillRect(0, H * 0.8, W, H * 0.1); g.fillStyle = '#fff'; for (let i = 0; i < 10; i++) g.fillRect(i * W / 10, H * 0.85, W / 20, 5); y = H * 0.4 + k * (H * 0.4 - vh * 0.75); rot = -0.12 * (1 - k); }
      } else {
        if (scene === 'derail' || (map === 'train' && scene === 'murder')) { rot = Math.min(0.5, k * 0.7); y += k * 40; x += k * 80; }
        else if (scene === 'explode') { const s = Math.sin(t * 40) * 6 * (1 - k); x += s; for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(80,80,90,${0.5 * k})`; g.beginPath(); g.arc(W / 2 + Math.cos(i) * 120 * k, y - 20 - i * 18 * k, 60 * k + 20, 0, Math.PI * 2); g.fill(); } }
        else if (scene === 'sink') { rot = k * 0.35; y += k * vh * 0.7; }
        else if (scene === 'reef' || (map === 'ship' && scene === 'murder')) { g.fillStyle = '#5c5f6b'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.7 + i * 50, H * 0.66); g.lineTo(W * 0.72 + i * 50, H * 0.5); g.lineTo(W * 0.76 + i * 50, H * 0.66); g.fill(); } x += k * W * 0.15; rot = Math.sin(t * 3) * 0.1 * k; }
        else { rot = k * 0.9; y += k * H * 0.5; x += k * W * 0.2; for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(60,60,70,${0.4})`; g.beginPath(); g.arc(x + vw * 0.2 - i * 30, y + vh / 2 - i * 20, 18 + i * 6, 0, Math.PI * 2); g.fill(); } }
      }
      if (store.prefs.reduceMotion) rot *= 0.3;
      g.save();
      g.translate(x + vw / 2, y + vh / 2);
      g.rotate(rot);
      g.drawImage(v, -vw / 2, -vh / 2, vw, vh);
      g.restore();
      if (map === 'ship' && !happy && scene === 'sink') { g.fillStyle = 'rgba(31,120,173,0.85)'; g.fillRect(0, H * 0.64, W, H); }
      if (t * 1000 >= dur) { skip(); return; }
      raf = requestAnimationFrame(frame);
    };
    frame();
  });
}

export function colorName(c: number) { return COLORS[c]?.name ?? ''; }
