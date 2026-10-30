import type { Product } from '../../shared/market';
import { Ctx, fillStroke, rr } from './draw';
import { INK, shade } from './palette';

/**
 * Iconos de producto dibujados por código (forma + colores del catálogo).
 * Se usan en las estanterías, el selector de compra, la caja y el historial.
 */
export function drawProductIcon(ctx: Ctx, p: Product, cx: number, cy: number, s: number) {
  const k = s / 32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = 1.8;
  const c1 = p.c1, c2 = p.c2;
  switch (p.shape) {
    case 'round':
      ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, -2, 3.5, 2.5, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(3, -10, 5, 2.5, -0.5, 0, Math.PI * 2); fillStroke(ctx, c2, INK, 1.2);
      break;
    case 'banana':
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.quadraticCurveTo(-4, 16, 13, 4); ctx.quadraticCurveTo(-2, 8, -8, -8); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; ctx.fillRect(-13, -9, 4, 4);
      break;
    case 'long':
      ctx.save(); ctx.rotate(-0.6); rr(ctx, -14, -5, 28, 10, 5); fillStroke(ctx, c1, INK, lw); ctx.fillStyle = c2; ctx.fillRect(-16, -2, 4, 4); ctx.restore();
      break;
    case 'leafy':
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 6, 2 + Math.sin(a) * 6, 7, 9, a, 0, Math.PI * 2); fillStroke(ctx, i % 2 ? c1 : c2, INK, 1.3); }
      break;
    case 'bunch':
      for (const [x, y] of [[-6, -6], [0, -7], [6, -6], [-3, 0], [3, 0], [0, 6], [-6, 1], [6, 1]]) { ctx.beginPath(); ctx.arc(x, y + 2, 4.5, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.2); }
      ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -14); ctx.stroke();
      break;
    case 'berry':
      for (const [x, y] of [[-6, 3], [5, 4], [0, -3], [-2, 8]]) { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.2); ctx.fillStyle = c2; ctx.fillRect(x - 1, y - 7, 2, 3); }
      break;
    case 'melon':
      ctx.beginPath(); ctx.ellipse(0, 2, 13, 10, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = shade(c1, -0.3); ctx.lineWidth = 1.5; for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.quadraticCurveTo(x * 1.4, 2, x, 11); ctx.stroke(); }
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(13, 2); ctx.lineTo(9, 9); ctx.closePath(); ctx.fill();
      break;
    case 'pepper':
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-11, 12, 0, 12); ctx.quadraticCurveTo(11, 12, 9, -4); ctx.quadraticCurveTo(0, -9, -9, -4); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; rr(ctx, -2, -11, 4, 6, 2); ctx.fill();
      break;
    case 'root':
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(1, 13); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = c2; ctx.lineWidth = 2.5; for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(Math.sin(a) * 8, -14); ctx.stroke(); }
      break;
    case 'bulb':
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(12, 0, 8, 8); ctx.quadraticCurveTo(0, 14, -8, 8); ctx.quadraticCurveTo(-12, 0, 0, -12); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = c2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(1, -15); ctx.stroke();
      break;
    case 'mushroom':
      ctx.beginPath(); ctx.ellipse(0, -2, 12, 8, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, c2, INK, lw);
      rr(ctx, -4, -2, 8, 12, 3); fillStroke(ctx, c1, INK, 1.4);
      break;
    case 'meat':
      rr(ctx, -14, -9, 28, 20, 4); fillStroke(ctx, '#f8f9fa', INK, 1.4);
      ctx.beginPath(); ctx.ellipse(0, 1, 10, 7, 0.2, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.3);
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(3, -1, 4, 2, 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'sausage':
      for (const y of [-5, 4]) { rr(ctx, -13, y - 4, 26, 9, 4.5); fillStroke(ctx, c1, INK, 1.3); }
      ctx.fillStyle = c2; ctx.fillRect(-14, -1, 3, 2);
      break;
    case 'fish':
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(0, -10, 8, 0); ctx.quadraticCurveTo(0, 10, -12, 0); fillStroke(ctx, c1, INK, lw);
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(14, -6); ctx.lineTo(14, 6); ctx.closePath(); fillStroke(ctx, c2, INK, 1.3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-6, -1.5, 1.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'shell':
      for (const x of [-6, 6]) { ctx.beginPath(); ctx.ellipse(x, 2, 7, 10, x > 0 ? 0.3 : -0.3, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.4); ctx.strokeStyle = c2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, 10); ctx.stroke(); }
      break;
    case 'shrimp':
      ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI * 0.1, Math.PI * 1.4); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = c1; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = c2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-13, -13); ctx.stroke();
      break;
    case 'octopus':
      ctx.beginPath(); ctx.ellipse(0, -4, 9, 8, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = c1; ctx.lineWidth = 3.5; for (const x of [-7, -2, 3, 8]) { ctx.beginPath(); ctx.moveTo(x * 0.8, 2); ctx.quadraticCurveTo(x, 10, x + 3, 12); ctx.stroke(); }
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(-3, -5, 1.6, 0, Math.PI * 2); ctx.arc(3, -5, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'carton':
      ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(0, -14); ctx.lineTo(9, -6); ctx.lineTo(9, 13); ctx.lineTo(-9, 13); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; ctx.fillRect(-9, 0, 18, 6);
      break;
    case 'bottle':
      rr(ctx, -3, -14, 6, 7, 2); fillStroke(ctx, c2, INK, 1.2);
      ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(-8, -2); ctx.lineTo(-8, 13); ctx.lineTo(8, 13); ctx.lineTo(8, -2); ctx.lineTo(3, -7); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.7; ctx.fillRect(-6, 2, 12, 6); ctx.globalAlpha = 1;
      break;
    case 'jar':
      rr(ctx, -9, -12, 18, 5, 2); fillStroke(ctx, c2, INK, 1.2);
      rr(ctx, -10, -7, 20, 20, 5); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-7, -1, 14, 7);
      break;
    case 'can':
      rr(ctx, -10, -11, 20, 23, 3); fillStroke(ctx, '#ced4da', INK, lw);
      ctx.fillStyle = c1; ctx.fillRect(-10, -6, 20, 13);
      ctx.fillStyle = c2; ctx.fillRect(-10, -1, 20, 3);
      break;
    case 'box':
      rr(ctx, -11, -12, 22, 25, 2); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; ctx.fillRect(-11, -4, 22, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-7, 6, 14, 3);
      break;
    case 'bag':
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(12, 13); ctx.lineTo(-12, 13); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; ctx.fillRect(-11, -3, 22, 6);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.stroke();
      break;
    case 'bread':
      ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(-12, -2); ctx.quadraticCurveTo(-12, -12, 0, -12); ctx.quadraticCurveTo(12, -12, 12, -2); ctx.lineTo(12, 12); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; rr(ctx, -9, -4, 18, 14, 3); ctx.fill();
      break;
    case 'loaf':
      ctx.save(); ctx.rotate(-0.35); ctx.beginPath(); ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = c2; ctx.lineWidth = 1.6; for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(x - 3, -3); ctx.lineTo(x + 3, 3); ctx.stroke(); } ctx.restore();
      break;
    case 'egg':
      rr(ctx, -14, -2, 28, 14, 3); fillStroke(ctx, '#c9b79c', INK, 1.4);
      for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.ellipse(x, -3, 4.5, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.2); }
      break;
    case 'cheese':
      ctx.beginPath(); ctx.moveTo(-13, 10); ctx.lineTo(13, 10); ctx.lineTo(13, -2); ctx.lineTo(-13, -10); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = shade(c1, -0.15); for (const [x, y] of [[-4, 3], [6, 5], [2, -1]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = c2; ctx.fillRect(-13, 7, 26, 3);
      break;
    case 'tub':
      ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(11, -8); ctx.lineTo(8, 12); ctx.lineTo(-8, 12); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      rr(ctx, -12, -11, 24, 5, 2); fillStroke(ctx, c2, INK, 1.2);
      break;
    case 'spice':
      rr(ctx, -6, -13, 12, 6, 2); fillStroke(ctx, c2, INK, 1.2);
      rr(ctx, -7, -7, 14, 20, 3); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-5, -1, 10, 6);
      break;
    case 'tube':
      ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(7, -9); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.closePath(); fillStroke(ctx, c1, INK, lw);
      rr(ctx, -4, -14, 8, 5, 2); fillStroke(ctx, c2, INK, 1.2);
      ctx.fillStyle = c2; ctx.fillRect(-7, 2, 14, 4);
      break;
    case 'block':
      rr(ctx, -13, -7, 26, 16, 3); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = shade(c1, -0.25); ctx.lineWidth = 1; for (const x of [-4, 4]) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x, 9); ctx.stroke(); }
      ctx.fillStyle = c2; ctx.fillRect(-13, -2, 26, 3);
      break;
    case 'herb':
      ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, -4); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 7, -2 + Math.sin(a) * 6, 4, 6, a, 0, Math.PI * 2); fillStroke(ctx, c1, INK, 1.1); }
      break;
    case 'cone':
      ctx.beginPath(); ctx.ellipse(0, 3, 9, 11, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.strokeStyle = shade(c1, -0.3); ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4 - 4, -6); ctx.lineTo(i * 4 + 4, 12); ctx.stroke(); }
      for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.ellipse(Math.sin(a) * 4, -11, 3, 6, a, 0, Math.PI * 2); fillStroke(ctx, c2, INK, 1); }
      break;
    case 'corn':
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 13, 0.3, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = shade(c1, -0.15); for (let y = -8; y < 10; y += 4) ctx.fillRect(-4 + y * 0.3, y, 8, 1.5);
      ctx.beginPath(); ctx.moveTo(4, 8); ctx.quadraticCurveTo(14, 4, 10, -10); ctx.quadraticCurveTo(8, 2, 2, 10); fillStroke(ctx, c2, INK, 1.2);
      break;
    case 'pod':
      ctx.save(); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c1, INK, lw);
      ctx.fillStyle = c2; for (const x of [-8, -2, 4, 10]) { ctx.beginPath(); ctx.arc(x - 1, 0, 2.6, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      break;
  }
  ctx.restore();
}
