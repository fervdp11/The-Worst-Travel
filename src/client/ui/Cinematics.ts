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

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** Progreso local de un tramo [a, b] de la secuencia. */
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Sprites laterales de los mapas (se pintan una vez y luego solo se transforman). */
function vehicle(map: MapId): HTMLCanvasElement {
  if (map === 'ship') {
    const c = makeCanvas(620, 230); const g = c.getContext('2d')!; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(10, 130); g.lineTo(610, 130); g.lineTo(550, 214); g.lineTo(70, 214); g.closePath(); fillStroke(g, '#20375c', INK, 3);
    g.fillStyle = '#e63946'; g.fillRect(48, 190, 520, 9);
    rr(g, 100, 70, 380, 62, 8); fillStroke(g, '#f1ede4', INK, 3);
    for (let k = 0; k < 11; k++) { g.beginPath(); g.arc(130 + k * 32, 100, 9, 0, Math.PI * 2); fillStroke(g, '#5fa8d3', INK, 1.5); }
    rr(g, 370, 30, 50, 42, 5); fillStroke(g, '#d62828', INK, 3);
    return c;
  }
  if (map === 'market') {
    const c = makeCanvas(620, 260); const g = c.getContext('2d')!; g.lineJoin = 'round';
    rr(g, 20, 40, 580, 200, 6); fillStroke(g, '#e8e2d6', INK, 3);
    for (let x = 40; x < 580; x += 40) { g.fillStyle = (x / 40) % 2 ? '#e63946' : '#f8f3e8'; g.fillRect(x, 40, 40, 30); }
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(40, 40, 540, 30);
    rr(g, 230, 120, 160, 120, 4); fillStroke(g, 'rgba(170,220,255,0.9)', INK, 3);
    g.fillStyle = INK; g.fillRect(308, 120, 4, 120);
    g.font = '900 30px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#20375c'; g.fillText('EL CARRITO', 310, 106);
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

function bgPaint(g: CanvasRenderingContext2D, map: MapId, W: number, H: number, t: number, mood: 'happy' | 'bad' | 'calm') {
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (mood === 'bad') { sky.addColorStop(0, '#2a1830'); sky.addColorStop(1, '#5a2a2a'); }
  else if (map === 'plane') { sky.addColorStop(0, '#5aa5ec'); sky.addColorStop(1, '#ffd6a5'); }
  else if (map === 'market') { sky.addColorStop(0, '#2b3a55'); sky.addColorStop(1, '#f6b38a'); }
  else { sky.addColorStop(0, '#6cb6ef'); sky.addColorStop(1, '#ffe8c2'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (map === 'ship') { g.fillStyle = mood === 'bad' ? '#16324a' : '#1f78ad'; g.fillRect(0, H * 0.62, W, H); g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(((i * 97 - t * 60) % W + W) % W, H * 0.66 + (i % 6) * 22, 50, 3); }
  else if (map === 'market') {
    g.fillStyle = '#4a5563'; g.fillRect(0, H * 0.72, W, H);
    g.fillStyle = '#7a8796'; g.fillRect(0, H * 0.7, W, H * 0.04);
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = 40; x < W; x += 160) g.fillRect(x, H * 0.86, 80, 6);
  } else { g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 8; i++) { const x = ((i * 260 - t * 120) % (W + 300) + W + 300) % (W + 300) - 150; g.beginPath(); g.ellipse(x, H * (0.2 + (i % 4) * 0.18), 110, 34, 0, 0, Math.PI * 2); g.fill(); } }
}

/** Dibuja el personaje compuesto (mismo compositor que el mundo) con aplastamiento y giro. */
function drawActor(g: CanvasRenderingContext2D, who: HTMLCanvasElement, x: number, y: number, size: number, rot: number, sx: number, sy: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sx, sy);
  g.drawImage(who, -size / 2, -size, size, size);
  g.restore();
}

export interface EjectActor { color: number; acc: number }

/**
 * Secuencia de resultados de CADA votación. Con expulsado: anticipación, salida
 * con trayectoria y reacción. Sin expulsado (`actor` nulo): la misma escena,
 * cámara, luces y ambiente, pero vacía, con el texto de la causa.
 */
export function ejectionScene(host: HTMLElement, map: MapId, actor: EjectActor | null, text: string, sub: string, durMs: number): () => void {
  const c = makeCanvas(10, 10);
  host.append(c);
  const g = c.getContext('2d')!;
  const who = actor ? portrait(actor.color, actor.acc, 80) : null;
  const t0 = performance.now();
  let raf = 0;
  if (actor) audio.sfx('eject'); else audio.sfx('close');
  const reduce = store.prefs.reduceMotion;
  const total = durMs / 1000;
  const frame = () => {
    const W = host.clientWidth || 800, H = host.clientHeight || 450;
    if (c.width !== W) { c.width = W; c.height = H; }
    const t = (performance.now() - t0) / 1000;
    // Cámara contenida: ligero acercamiento al principio.
    const zoom = reduce ? 1 : 1 + 0.06 * ease(seg(t, 0, 1.2));
    g.save();
    g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
    bgPaint(g, map, W, H, t, 'calm');
    const doorX = W * 0.2, doorTop = H * 0.26, doorH = H * 0.44, doorW = Math.min(150, W * 0.16);
    const open = ease(seg(t, 0.5, 1.2)) * (1 - ease(seg(t, total - 1.3, total - 0.6)));
    // Marco y hoja de la puerta / compuerta
    rr(g, doorX - doorW / 2 - 10, doorTop - 10, doorW + 20, doorH + 20, 10);
    fillStroke(g, map === 'plane' ? '#e9eef5' : map === 'ship' ? '#f1ede4' : '#2bb24c', INK, 4);
    g.fillStyle = '#10131f'; rr(g, doorX - doorW / 2, doorTop, doorW, doorH, 6); g.fill();
    // Luz que sale al abrir
    if (open > 0.05) {
      const lg = g.createRadialGradient(doorX, doorTop + doorH / 2, 10, doorX, doorTop + doorH / 2, doorW * 2.2);
      lg.addColorStop(0, `rgba(255,236,190,${0.35 * open})`); lg.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = lg; g.fillRect(doorX - doorW * 2.5, doorTop - doorH * 0.4, doorW * 5, doorH * 1.8);
    }
    g.save();
    rr(g, doorX - doorW / 2, doorTop, doorW * (1 - open * 0.92), doorH, 6);
    fillStroke(g, vgrad(g, doorTop, doorTop + doorH, '#c3ccd8', '#8a96a8'), INK, 3);
    g.restore();
    if (map === 'market') { g.fillStyle = '#ffffff'; g.font = `900 ${Math.round(doorW * 0.13)}px "Baloo 2", sans-serif`; g.textAlign = 'center'; g.fillText('SALIDA', doorX, doorTop - 18); }
    // Dispositivo cómico propio del mapa
    const floorY = H * 0.7;
    if (map === 'ship') {
      // Tobogán de evacuación hacia el mar
      const k = ease(seg(t, 1.0, 1.6));
      g.strokeStyle = '#ff8a3d'; g.lineWidth = 16 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(doorX + doorW / 2, floorY - 8); g.quadraticCurveTo(W * 0.5, floorY + 10, W * 0.72, H * 0.66); g.stroke();
    } else if (map === 'plane') {
      const k = ease(seg(t, 1.0, 1.6));
      g.fillStyle = '#ffd23f'; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.moveTo(doorX + doorW / 2, floorY - 6); g.lineTo(doorX + doorW / 2 + W * 0.4 * k, floorY + H * 0.2 * k); g.lineTo(doorX + doorW / 2 + W * 0.4 * k, floorY + H * 0.2 * k + 18); g.lineTo(doorX + doorW / 2, floorY + 12); g.closePath(); g.fill(); g.stroke();
    }
    // Actor
    if (who) {
      const size = Math.min(150, H * 0.3);
      const walk = ease(seg(t, 1.2, 2.2));
      const antic = seg(t, 2.2, 2.6);
      const fly = seg(t, 2.6, 4.4);
      let x = W * 0.62 - walk * (W * 0.62 - doorX - doorW * 0.2), y = floorY, rot = 0, sx = 1, sy = 1;
      if (t < 2.2) { y -= Math.abs(Math.sin(t * 9)) * 6 * walk; sx = -1; }
      else if (t < 2.6) { sy = 1 - 0.18 * Math.sin(antic * Math.PI); sx = -(1 + 0.12 * Math.sin(antic * Math.PI)); }
      else {
        if (map === 'market') {
          // Un carrito llega, lo recoge y se lo lleva por la salida.
          const cartX = W * 0.9 - ease(seg(t, 2.0, 2.6)) * (W * 0.9 - (doorX + doorW * 0.3)) - ease(fly) * W * 0.25;
          drawCart(g, cartX, floorY, size * 0.9);
          x = cartX; y = floorY - size * 0.28; sx = -1; rot = reduce ? 0 : Math.sin(fly * 8) * 0.08;
        } else if (map === 'ship') {
          x = doorX + doorW / 2 + ease(fly) * (W * 0.72 - doorX - doorW / 2);
          y = floorY + Math.sin(fly * Math.PI) * -H * 0.06 + ease(fly) * (H * 0.66 - floorY);
          rot = reduce ? 0 : fly * 5;
        } else {
          x = doorX + doorW / 2 + fly * W * 0.5;
          y = floorY + fly * H * 0.24;
          rot = reduce ? 0 : -0.4 + fly * 0.6;
        }
      }
      const fade = 1 - seg(t, 4.2, 4.9);
      if (fade > 0) { g.globalAlpha = fade; drawActor(g, who, x, y, size, rot, sx, sy); g.globalAlpha = 1; }
      // Reacción: gotas de sudor en la anticipación, chapuzón o paracaídas al final
      if (t > 2.2 && t < 2.8) { g.fillStyle = '#9ad1ff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x + 30 + i * 10, y - size * 0.9 + i * 6, 4, 7, 0.3, 0, Math.PI * 2); g.fill(); } }
      if (map === 'ship' && fly >= 1) {
        const s = seg(t, 4.4, 5.2);
        g.strokeStyle = '#ff4d5e'; g.lineWidth = 10; g.beginPath(); g.arc(W * 0.72, H * 0.66, 30, 0, Math.PI * 2); g.stroke();
        g.fillStyle = `rgba(255,255,255,${0.8 * (1 - s)})`; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W * 0.72 - 40 + i * 16, H * 0.64 - s * 30 - (i % 2) * 8, 7, 0, Math.PI * 2); g.fill(); }
      }
      if (map === 'plane' && fly > 0.55) {
        g.save(); g.translate(x, y - size - 30); g.fillStyle = '#ff8a3d'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 54, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-50, 0); g.lineTo(0, 30); g.lineTo(50, 0); g.stroke(); g.restore();
      }
    } else if (map === 'market') {
      // Sin expulsado: el carrito pasa vacío y la puerta se cierra.
      const cartX = W * 0.95 - ease(seg(t, 1.4, total - 1.2)) * W * 0.9;
      drawCart(g, cartX, floorY, Math.min(140, H * 0.27));
    }
    g.restore();
    // Texto de resultado con causa explícita
    const ta = clamp01((t - (who ? 3.0 : 1.4)) * 2);
    g.globalAlpha = ta;
    g.font = `800 ${Math.max(22, Math.min(48, W / 22))}px "Baloo 2", sans-serif`;
    g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = INK; g.fillStyle = '#fff';
    g.strokeText(text, W / 2, H * 0.86); g.fillText(text, W / 2, H * 0.86);
    if (sub) { g.font = `700 ${Math.max(14, Math.min(24, W / 44))}px "Nunito", sans-serif`; g.lineWidth = 5; g.strokeText(sub, W / 2, H * 0.93); g.fillText(sub, W / 2, H * 0.93); }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => { cancelAnimationFrame(raf); c.remove(); };
}

function drawCart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y);
  g.strokeStyle = INK; g.lineWidth = 4;
  rr(g, -s * 0.45, -s * 0.45, s * 0.9, s * 0.38, 6); g.fillStyle = 'rgba(200,210,220,0.85)'; g.fill(); g.stroke();
  g.strokeStyle = '#c0c8d4'; g.lineWidth = 2; for (let k = -0.4; k < 0.45; k += 0.1) { g.beginPath(); g.moveTo(k * s, -s * 0.44); g.lineTo(k * s, -s * 0.08); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(s * 0.45, -s * 0.45); g.lineTo(s * 0.6, -s * 0.62); g.stroke();
  g.fillStyle = '#e63946'; g.fillRect(-s * 0.46, -s * 0.48, s * 0.92, 6);
  g.fillStyle = INK; for (const wx of [-0.32, 0.32]) { g.beginPath(); g.arc(wx * s, 0, s * 0.07, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** Desenlace propio de cada mapa (estilizado, sin gore). */
export function playCinematic(app: App, r: EndResult): Promise<void> {
  void app;
  if (r.cause === 'ejected' || r.cause === 'abandon' || r.cause === 'cancelled') return Promise.resolve();
  const map = (store.gstart?.mapId ?? 'ship') as MapId;
  const happy = r.winner === 'workers';
  const root = h('div', { class: 'cine' });
  const c = makeCanvas(10, 10);
  root.append(c, h('div', { class: 'txt' }, r.title));
  uiRoot().append(root);
  const g = c.getContext('2d')!;
  const v = vehicle(map);
  const t0 = performance.now();
  const dur = 4200;
  audio.sfx(happy ? 'win' : map === 'market' ? 'lose' : 'crash');
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
      let x = W / 2 - vw / 2, y = map === 'ship' ? H * 0.64 - vh * 0.85 : map === 'market' ? H * 0.72 - vh : H * 0.4 - vh / 2;
      let rot = 0;
      if (happy) {
        if (map === 'ship') { g.fillStyle = '#8d6e52'; g.fillRect(0, H * 0.58, W * 0.25, H * 0.08); x -= (1 - k) * W * 0.3 - W * 0.05; }
        if (map === 'plane') { g.fillStyle = '#4a4e57'; g.fillRect(0, H * 0.8, W, H * 0.1); g.fillStyle = '#fff'; for (let i = 0; i < 10; i++) g.fillRect(i * W / 10, H * 0.85, W / 20, 5); y = H * 0.4 + k * (H * 0.4 - vh * 0.75); rot = -0.12 * (1 - k); }
      } else if (map !== 'market') {
        if (scene === 'sink') { rot = k * 0.35; y += k * vh * 0.7; }
        else if (scene === 'reef' || (map === 'ship' && scene === 'murder')) { g.fillStyle = '#5c5f6b'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(W * 0.7 + i * 50, H * 0.66); g.lineTo(W * 0.72 + i * 50, H * 0.5); g.lineTo(W * 0.76 + i * 50, H * 0.66); g.fill(); } x += k * W * 0.15; rot = Math.sin(t * 3) * 0.1 * k; }
        else { rot = k * 0.9; y += k * H * 0.5; x += k * W * 0.2; for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(60,60,70,0.4)'; g.beginPath(); g.arc(x + vw * 0.2 - i * 30, y + vh / 2 - i * 20, 18 + i * 6, 0, Math.PI * 2); g.fill(); } }
      }
      if (store.prefs.reduceMotion) rot *= 0.3;
      g.save();
      g.translate(x + vw / 2, y + vh / 2);
      g.rotate(rot);
      g.drawImage(v, -vw / 2, -vh / 2, vw, vh);
      g.restore();
      if (map === 'market' && !happy) { g.fillStyle = `rgba(20,14,40,${0.45 * k})`; g.fillRect(0, 0, W, H); }
      if (map === 'ship' && !happy && scene === 'sink') { g.fillStyle = 'rgba(31,120,173,0.85)'; g.fillRect(0, H * 0.64, W, H); }
      if (t * 1000 >= dur) { skip(); return; }
      raf = requestAnimationFrame(frame);
    };
    frame();
  });
}

export function colorName(c: number) { return COLORS[c]?.name ?? ''; }
