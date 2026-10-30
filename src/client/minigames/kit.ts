import type { MapId } from '../../shared/maps/types';
import { fillStroke, led, rr, screw, star, vgrad } from '../art/draw';
import { INK, shade } from '../art/palette';

export type C = CanvasRenderingContext2D;

export interface Mat { base: string; dark: string; trim: string; screen: string; accent: string }

/** Materiales de las carcasas por vehículo: latón/madera, acero pintado, plástico claro. */
export const MATS: Record<MapId, Mat> = {
  train: { base: '#7b4a2e', dark: '#4e2d1b', trim: '#d9a441', screen: '#1d2b22', accent: '#c8323f' },
  ship: { base: '#3a5378', dark: '#22334f', trim: '#e63946', screen: '#0f2233', accent: '#f1ede4' },
  plane: { base: '#d6dde8', dark: '#9aa7b8', trim: '#2f6fb3', screen: '#132235', accent: '#2f6fb3' },
};

export function casing(ctx: C, x: number, y: number, w: number, h: number, m: Mat) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = m.dark;
  ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, 18);
  fillStroke(ctx, vgrad(ctx, y, y + h, shade(m.base, 0.12), m.base), INK, 4);
  rr(ctx, x + 14, y + 14, w - 28, h - 28, 12);
  fillStroke(ctx, vgrad(ctx, y, y + h, shade(m.dark, 0.1), shade(m.dark, -0.15)), INK, 2.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 22, y + 5); ctx.lineTo(x + w - 22, y + 5); ctx.stroke();
  for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) screw(ctx, sx, sy, 4);
}

export function plate(ctx: C, x: number, y: number, w: number, h: number, fill: string, r = 10) {
  rr(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  rr(ctx, x, y, w, h, r); fillStroke(ctx, vgrad(ctx, y, y + h, shade(fill, 0.15), shade(fill, -0.1)), INK, 2.5);
}

export function btn(ctx: C, x: number, y: number, w: number, h: number, label: string, color: string, pressed = false, icon?: (cx: number, cy: number) => void) {
  const off = pressed ? 4 : 0;
  rr(ctx, x, y + 6, w, h, 12); ctx.fillStyle = shade(color, -0.45); ctx.fill();
  rr(ctx, x, y + off, w, h, 12); fillStroke(ctx, vgrad(ctx, y, y + h, shade(color, 0.22), color), INK, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 6, y + off + 4, w - 12, h * 0.3, 8); ctx.fill();
  if (icon) icon(x + w / 2, y + off + h / 2 - (label ? 8 : 0));
  if (label) text(ctx, label, x + w / 2, y + off + h / 2 + (icon ? 18 : 2), Math.min(20, h * 0.36), '#fff', true);
}

export function text(ctx: C, t: string, x: number, y: number, size: number, color = '#fff', outline = false, align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${size}px "Baloo 2", "Nunito", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = INK; ctx.strokeText(t, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}

export function knob(ctx: C, cx: number, cy: number, r: number, angle: number, color = '#c9ced8') {
  ctx.beginPath(); ctx.arc(cx, cy + 5, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, shade(color, 0.4)); g.addColorStop(1, shade(color, -0.25));
  fillStroke(ctx, g, INK, 3);
  for (let i = 0; i < 12; i++) {
    const a = angle + (i / 12) * Math.PI * 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95); ctx.stroke();
  }
  ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * r * 0.2, cy + Math.sin(angle) * r * 0.2); ctx.lineTo(cx + Math.cos(angle) * r * 0.75, cy + Math.sin(angle) * r * 0.75); ctx.stroke();
}

export function wheel(ctx: C, cx: number, cy: number, r: number, angle: number, color = '#d64545') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath(); ctx.arc(0, 6, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 12; ctx.stroke();
  ctx.rotate(angle);
  ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 9; ctx.strokeStyle = color; ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = shade(color, 0.15); ctx.stroke();
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 8, 0, Math.PI * 2); fillStroke(ctx, shade(color, 0.25), INK, 2);
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); fillStroke(ctx, '#c9ced8', INK, 3);
  ctx.restore();
}

/** Indicador de aguja con banda segura. */
export function dial(ctx: C, cx: number, cy: number, r: number, v: number, lo: number, hi: number, label = '') {
  ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 3);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); fillStroke(ctx, '#f6f3ea', INK, 2);
  const a0 = Math.PI * 0.8, span = Math.PI * 1.4;
  ctx.lineWidth = r * 0.18;
  ctx.strokeStyle = '#ffd2d2'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, a0, a0 + span); ctx.stroke();
  ctx.strokeStyle = '#3ddc97'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, a0 + span * lo, a0 + span * hi); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) { const a = a0 + span * (i / 10); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  const a = a0 + span * Math.max(0, Math.min(1, v));
  ctx.lineWidth = 5; ctx.strokeStyle = '#d62828';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 2);
  if (label) text(ctx, label, cx, cy + r * 0.45, Math.max(12, r * 0.18), '#2b2d42');
}

export function lever(ctx: C, x: number, y: number, h: number, v: number, color = '#ffd23f', label = '') {
  rr(ctx, x - 9, y, 18, h, 9); fillStroke(ctx, '#1f2533', INK, 3);
  const ky = y + h - v * h;
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x, ky); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = '#aeb6c4'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, ky, 16, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, ky - 16, ky + 16, shade(color, 0.3), color), INK, 3);
  if (label) text(ctx, label, x, y + h + 22, 16, '#fff', true);
}

export function slider(ctx: C, x: number, y: number, w: number, v: number, lo: number | null, hi: number | null, color = '#5cc8ff') {
  rr(ctx, x, y - 10, w, 20, 10); fillStroke(ctx, '#11151f', INK, 2.5);
  if (lo !== null && hi !== null) { ctx.fillStyle = 'rgba(61,220,151,0.55)'; rr(ctx, x + w * lo, y - 8, w * (hi - lo), 16, 8); ctx.fill(); }
  const kx = x + w * v;
  rr(ctx, kx - 14, y - 22, 28, 44, 8); fillStroke(ctx, vgrad(ctx, y - 22, y + 22, shade(color, 0.3), color), INK, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(kx - 6, y - 8, 12, 2); ctx.fillRect(kx - 6, y - 2, 12, 2); ctx.fillRect(kx - 6, y + 4, 12, 2);
}

export function toggleSwitch(ctx: C, x: number, y: number, on: boolean, label = '') {
  rr(ctx, x - 24, y - 40, 48, 80, 10); fillStroke(ctx, '#2b2d42', INK, 3);
  led(ctx, x, y - 52, on ? '#3ddc97' : '#ff4d5e', 5);
  const ty = on ? y - 18 : y + 18;
  rr(ctx, x - 14, ty - 14, 28, 28, 7); fillStroke(ctx, vgrad(ctx, ty - 14, ty + 14, '#f1f3f5', '#adb5bd'), INK, 3);
  if (label) text(ctx, label, x, y + 58, 16, '#fff', true);
}

export function screwHead(ctx: C, x: number, y: number, r: number, turned: number) {
  ctx.beginPath(); ctx.arc(x, y + 3, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, vgrad(ctx, y - r, y + r, '#e9ecef', '#868e96'), INK, 3);
  ctx.save(); ctx.translate(x, y); ctx.rotate(turned);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  ctx.restore();
}

/** Iconos de comida (comandas y cocina). */
export function food(ctx: C, name: string, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 40, s / 40);
  ctx.lineJoin = 'round';
  switch (name) {
    case 'sopa': ctx.beginPath(); ctx.arc(0, 2, 18, 0, Math.PI); ctx.closePath(); fillStroke(ctx, '#f4f1e8', INK, 3); ctx.fillStyle = '#e76f51'; ctx.fillRect(-15, 1, 30, 5); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (const k of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(k, -4); ctx.quadraticCurveTo(k + 4, -10, k, -16); ctx.stroke(); } break;
    case 'ensalada': ctx.beginPath(); ctx.arc(0, 4, 18, 0, Math.PI); ctx.closePath(); fillStroke(ctx, '#8ecae6', INK, 3); for (const [lx, c] of [[-8, '#52b788'], [0, '#95d5b2'], [8, '#40916c']] as [number, string][]) { ctx.beginPath(); ctx.ellipse(lx, 0, 8, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c, INK, 2); } ctx.beginPath(); ctx.arc(4, -3, 4, 0, Math.PI * 2); fillStroke(ctx, '#e63946', INK, 2); break;
    case 'bocadillo': rr(ctx, -20, -8, 40, 18, 9); fillStroke(ctx, '#d4a373', INK, 3); ctx.fillStyle = '#52b788'; ctx.fillRect(-18, -1, 36, 3); ctx.fillStyle = '#e76f51'; ctx.fillRect(-18, 2, 36, 3); break;
    case 'tarta': ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, 12); ctx.lineTo(0, -16); ctx.closePath(); fillStroke(ctx, '#f6bd60', INK, 3); ctx.fillStyle = '#f28482'; ctx.fillRect(-12, 2, 24, 4); ctx.beginPath(); ctx.arc(0, -16, 4, 0, Math.PI * 2); fillStroke(ctx, '#e63946', INK, 2); break;
    case 'cafe': rr(ctx, -13, -10, 24, 24, 5); fillStroke(ctx, '#f4f1e8', INK, 3); ctx.fillStyle = '#6f4518'; ctx.fillRect(-10, -7, 18, 5); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(13, 2, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke(); break;
    case 'zumo': rr(ctx, -10, -16, 20, 32, 4); fillStroke(ctx, 'rgba(255,190,11,0.85)', INK, 3); ctx.fillStyle = '#fff'; ctx.fillRect(2, -24, 3, 14); ctx.beginPath(); ctx.arc(-10, -14, 6, 0, Math.PI * 2); fillStroke(ctx, '#ffbe0b', INK, 2); break;
    case 'fruta': ctx.beginPath(); ctx.arc(0, 2, 15, 0, Math.PI * 2); fillStroke(ctx, '#e63946', INK, 3); ctx.beginPath(); ctx.ellipse(6, -14, 7, 3, -0.5, 0, Math.PI * 2); fillStroke(ctx, '#52b788', INK, 2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-5, -4, 4, 0, Math.PI * 2); ctx.fill(); break;
    case 'pan': ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); fillStroke(ctx, '#d4a373', INK, 3); ctx.strokeStyle = '#a0663b'; ctx.lineWidth = 2.5; for (const k of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(k - 3, -6); ctx.lineTo(k + 3, 6); ctx.stroke(); } break;
    case 'queso': ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, 12); ctx.lineTo(18, -4); ctx.lineTo(-18, -12); ctx.closePath(); fillStroke(ctx, '#ffd23f', INK, 3); ctx.fillStyle = '#e9b100'; for (const [hx, hy] of [[-6, 2], [6, 5], [10, -2]]) { ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill(); } break;
    case 'pasta': ctx.beginPath(); ctx.arc(0, 4, 18, 0, Math.PI); ctx.closePath(); fillStroke(ctx, '#f4f1e8', INK, 3); ctx.strokeStyle = '#f6bd60'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-6 + i * 4, 0, 6, Math.PI, 0); ctx.stroke(); } ctx.beginPath(); ctx.arc(2, -3, 4, 0, Math.PI * 2); fillStroke(ctx, '#e63946', INK, 2); break;
    default: ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); fillStroke(ctx, '#ccc', INK, 3);
  }
  ctx.restore();
}

export const FOOD_NAMES: Record<string, string> = { sopa: 'Sopa', ensalada: 'Ensalada', bocadillo: 'Bocadillo', tarta: 'Tarta', cafe: 'Café', zumo: 'Zumo', fruta: 'Fruta', pan: 'Pan', queso: 'Queso', pasta: 'Pasta' };

/** Símbolos para conectores (no dependen solo del color). */
export function symbol(ctx: C, name: string, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  switch (name) {
    case 'circulo': ctx.arc(x, y, r, 0, Math.PI * 2); break;
    case 'cuadrado': ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); break;
    case 'triangulo': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); break;
    case 'rombo': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); break;
    case 'estrella': star(ctx, x, y, r * 1.1); break;
    default: ctx.rect(x - r * 0.3, y - r, r * 0.6, r * 2); ctx.rect(x - r, y - r * 0.3, r * 2, r * 0.6);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function inRect(px: number, py: number, x: number, y: number, w: number, h: number) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

export function suitcaseIcon(ctx: C, x: number, y: number, w: number, h: number, color: string, tag?: string) {
  rr(ctx, x, y + 4, w, h, 8); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  rr(ctx, x, y, w, h, 8); fillStroke(ctx, vgrad(ctx, y, y + h, shade(color, 0.2), shade(color, -0.15)), INK, 3);
  rr(ctx, x + w / 2 - 12, y - 10, 24, 12, 5); fillStroke(ctx, '#3b3f4a', INK, 2.5);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + w * 0.3, y + 3, 4, h - 6); ctx.fillRect(x + w * 0.66, y + 3, 4, h - 6);
  if (tag) { rr(ctx, x + w - 34, y + h - 26, 30, 20, 4); fillStroke(ctx, '#fff', INK, 2); text(ctx, tag, x + w - 19, y + h - 16, 12, INK); }
}
