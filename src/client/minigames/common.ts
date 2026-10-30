import { fillStroke, rr, vgrad } from '../art/draw';
import { INK, shade } from '../art/palette';
import { btn, C, inRect, text } from './kit';

/** Botón de mantener pulsado con progreso visible. */
export class Hold {
  p = 0;
  held = false;
  constructor(public x: number, public y: number, public w: number, public h: number, public label: string, public color = '#22a06b') {}
  down(px: number, py: number) { if (inRect(px, py, this.x, this.y, this.w, this.h)) this.held = true; }
  up() { this.held = false; }
  /** Avanza; devuelve true al completar. Si se suelta, vuelve a cero (sin castigo). */
  tick(dt: number, dur: number, decay = true): boolean {
    if (this.held) this.p = Math.min(1, this.p + dt / dur);
    else if (decay) this.p = Math.max(0, this.p - dt * 2);
    return this.p >= 1;
  }
  draw(ctx: C) {
    btn(ctx, this.x, this.y, this.w, this.h, this.label, this.color, this.held);
    rr(ctx, this.x + 10, this.y + this.h + 12, this.w - 20, 12, 6); fillStroke(ctx, '#11151f', INK, 2);
    if (this.p > 0) { rr(ctx, this.x + 11, this.y + this.h + 13, (this.w - 22) * this.p, 10, 5); ctx.fillStyle = '#3ddc97'; ctx.fill(); }
  }
}

/** Zonas a frotar con arrastre (manchas, suciedad). */
export class Scrub {
  spots: { x: number; y: number; r: number; a: number }[] = [];
  last: { x: number; y: number } | null = null;
  constructor(spots: { x: number; y: number; r: number }[]) { this.spots = spots.map((s) => ({ ...s, a: 1 })); }
  rub(x: number, y: number, power = 1) {
    const moved = this.last ? Math.hypot(x - this.last.x, y - this.last.y) : 0;
    this.last = { x, y };
    for (const s of this.spots) if (Math.hypot(s.x - x, s.y - y) < s.r + 18) s.a = Math.max(0, s.a - Math.min(0.25, moved / 120) * power);
  }
  release() { this.last = null; }
  clean() { return this.spots.filter((s) => s.a < 0.08).length; }
  done() { return this.spots.every((s) => s.a < 0.08); }
  draw(ctx: C, color = 'rgba(110,80,40,') {
    for (const s of this.spots) {
      if (s.a <= 0.01) continue;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `${color}${0.85 * s.a})`); g.addColorStop(1, `${color}0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function sponge(ctx: C, x: number, y: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 20) * 0.08);
  rr(ctx, -26, -16, 52, 32, 8); fillStroke(ctx, vgrad(ctx, -16, 16, '#ffe066', '#f4c430'), INK, 3);
  rr(ctx, -26, 6, 52, 10, 4); fillStroke(ctx, '#52b788', INK, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-14 + i * 9 + Math.sin(t * 8 + i) * 3, -22 - Math.abs(Math.sin(t * 6 + i)) * 10, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** Objeto arrastrable con regreso a su origen si no encaja. */
export class Drag<T = unknown> {
  x: number; y: number; dragging = false; ox = 0; oy = 0; placed = false;
  constructor(public homeX: number, public homeY: number, public w: number, public h: number, public data: T) { this.x = homeX; this.y = homeY; }
  hit(px: number, py: number) { return inRect(px, py, this.x, this.y, this.w, this.h); }
  start(px: number, py: number) { this.dragging = true; this.ox = px - this.x; this.oy = py - this.y; }
  move(px: number, py: number) { if (this.dragging) { this.x = px - this.ox; this.y = py - this.oy; } }
  home() { this.x = this.homeX; this.y = this.homeY; this.placed = false; }
  cx() { return this.x + this.w / 2; }
  cy() { return this.y + this.h / 2; }
}

export function screenBox(ctx: C, x: number, y: number, w: number, h: number, color = '#0f2233') {
  rr(ctx, x - 6, y - 6, w + 12, h + 12, 12); fillStroke(ctx, '#20232c', INK, 3);
  rr(ctx, x, y, w, h, 8); fillStroke(ctx, vgrad(ctx, y, y + h, shade(color, 0.12), color), INK, 2);
  ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip();
  ctx.strokeStyle = 'rgba(92,200,255,0.08)'; ctx.lineWidth = 1;
  for (let yy = y; yy < y + h; yy += 4) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.restore();
}

export function paper(ctx: C, x: number, y: number, w: number, h: number, rot = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fillStyle = '#fbf6e9'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,110,170,0.25)'; ctx.lineWidth = 1;
  for (let yy = -h / 2 + 30; yy < h / 2 - 8; yy += 20) { ctx.beginPath(); ctx.moveTo(-w / 2 + 10, yy); ctx.lineTo(w / 2 - 10, yy); ctx.stroke(); }
  ctx.restore();
}

export function title(ctx: C, t: string, x = 360, y = 44) { text(ctx, t, x, y, 22, '#fff', true); }
