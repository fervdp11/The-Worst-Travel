import { INK, shade } from './palette';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, stroke: string | null = INK, lw = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function vgrad(ctx: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

export function hgrad(ctx: Ctx, x0: number, x1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/**
 * Caja oblicua: cara superior (huella desplazada h hacia arriba) y cara frontal.
 * Coordenadas locales del sprite: (0,0) = esquina superior de la tapa.
 */
export function obliqueBox(ctx: Ctx, w: number, d: number, h: number, top: string, front: string, r = 4, lw = 2) {
  // cara frontal
  rr(ctx, 0, d - r, w, h + r, Math.min(r, 6));
  fillStroke(ctx, vgrad(ctx, d, d + h, front, shade(front, -0.18)), INK, lw);
  // tapa
  rr(ctx, 0, 0, w, d, r);
  fillStroke(ctx, vgrad(ctx, 0, d, shade(top, 0.12), top), INK, lw);
  // bisel de luz en la arista
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(r + 1, 2);
  ctx.lineTo(w - r - 1, 2);
  ctx.stroke();
}

export function screw(ctx: Ctx, x: number, y: number, r = 2.2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#c9ced8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, y - r * 0.6);
  ctx.lineTo(x + r * 0.6, y + r * 0.6);
  ctx.stroke();
}

export function led(ctx: Ctx, x: number, y: number, color: string, r = 2.4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

export function screen(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#2de2a6') {
  rr(ctx, x, y, w, h, 2);
  fillStroke(ctx, '#0f1a24', INK, 1.4);
  ctx.save();
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 1.5);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, y, y + h, shade(color, -0.55), shade(color, -0.75));
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const yy = y + 3 + i * (h - 6) / 3 + 2;
    ctx.moveTo(x + 3, yy);
    ctx.lineTo(x + 3 + (w - 6) * (0.4 + 0.5 * ((i * 37) % 10) / 10), yy);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h * 0.35);
  ctx.restore();
}

export function gauge(ctx: Ctx, x: number, y: number, r: number, v = 0.6) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, '#f6f3ea', INK, 1.4);
  ctx.strokeStyle = '#3ddc97';
  ctx.lineWidth = r * 0.25;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 0.85, Math.PI * 1.45);
  ctx.stroke();
  ctx.strokeStyle = '#ff4d5e';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 1.85, Math.PI * 2.15);
  ctx.stroke();
  const a = Math.PI * (0.8 + 1.4 * v);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
  ctx.stroke();
}

/** Sombra de contacto suave (elipse) para apoyar objetos en el suelo. */
export function contactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.32) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(18,12,34,${a})`);
  g.addColorStop(0.7, `rgba(18,12,34,${a * 0.55})`);
  g.addColorStop(1, 'rgba(18,12,34,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function label(ctx: Ctx, text: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px "Baloo 2", "Nunito", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Ruido fino determinista para desgaste y textura. */
export function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, color: string, seed = 1, size = 1.2) {
  ctx.fillStyle = color;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    ctx.fillRect(x + rnd() * w, y + rnd() * h, size * (0.5 + rnd()), size * (0.5 + rnd()));
  }
}

export function star(ctx: Ctx, cx: number, cy: number, r: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}
