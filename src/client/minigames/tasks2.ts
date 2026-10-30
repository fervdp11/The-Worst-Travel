import { fillStroke, led, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { MG } from './base';
import { Drag, Hold, screenBox } from './common';
import { btn, C, inRect, screwHead, slider, suitcaseIcon, text, wheel } from './kit';

// ------------------------------------------------------------ Achique (barco)
export class Bilge extends MG {
  water = 1; strokes = 0; handle = 0; dir = 0; valve = 0; drag = false;
  override init() { this.water = 1; this.strokes = 0; this.handle = 0; this.valve = 0; this.hint = this.part === 0 ? 'Bombea con la palanca arriba y abajo hasta bajar el agua de la línea.' : 'Cierra la válvula de achique.'; }
  override render(ctx: C) {
    rr(ctx, 60, 60, 260, 330, 14); fillStroke(ctx, '#2b2d42', INK, 3);
    ctx.save(); rr(ctx, 68, 68, 244, 314, 10); ctx.clip();
    const wl = 382 - 300 * (this.part === 0 ? this.water : 0.15);
    ctx.fillStyle = vgrad(ctx, wl, 382, '#3a86ff', '#1d4e89'); ctx.fillRect(68, wl + Math.sin(this.t * 3) * 3, 244, 400);
    ctx.restore();
    ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([10, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 330); ctx.lineTo(320, 330); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'LÍNEA', 190, 316, 14, '#ffd23f', true);
    if (this.part === 0) {
      rr(ctx, 420, 120, 120, 240, 16); fillStroke(ctx, vgrad(ctx, 120, 360, '#1d7874', '#0e3b39'), INK, 3);
      const hy = 140 + this.handle * 180;
      ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(480, 250); ctx.lineTo(600, hy); ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = '#adb5bd'; ctx.stroke();
      ctx.beginPath(); ctx.arc(600, hy, 26, 0, Math.PI * 2); fillStroke(ctx, '#ff4d5e', INK, 3);
      text(ctx, `${this.strokes}/${this.puzzle.strokes}`, 480, 390, 20, '#fff', true);
    } else {
      wheel(ctx, 520, 230, 90, this.valve * Math.PI * 3, '#d64545');
      text(ctx, this.valve >= 1 ? 'CERRADA' : 'Gira para cerrar', 520, 360, 18, '#fff', true);
    }
  }
  override down(x: number, y: number) { this.drag = true; void x; void y; }
  override up() { this.drag = false; }
  override dragBy(_dx: number, dy: number) {
    if (!this.drag) return;
    if (this.part === 0) {
      const prev = this.handle;
      this.handle = Math.max(0, Math.min(1, this.handle + dy / 200));
      if (prev < 0.95 && this.handle >= 0.95 && this.dir !== 1) { this.dir = 1; }
      if (prev > 0.05 && this.handle <= 0.05 && this.dir === 1) {
        this.dir = 0; this.strokes++; this.sink.sfx('step');
        this.water = Math.max(0.1, 1 - this.strokes / (this.puzzle.strokes + 0.5));
        if (this.strokes >= this.puzzle.strokes) this.submit({ strokes: this.strokes });
      }
    } else {
      this.valve = Math.min(1, this.valve + Math.abs(dy + _dx) / 500);
      if (this.valve >= 1) this.submit({ valve: true });
    }
  }
}

// ------------------------------------------------------------ Junta estanca (barco)
export class Seal extends MG {
  done: number[] = [];
  override init() { this.done = []; this.hint = 'Aprieta las abrazaderas en estrella, siguiendo la numeración.'; }
  private P(i: number) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return { x: 360 + Math.cos(a) * 150, y: 225 + Math.sin(a) * 150 }; }
  override render(ctx: C) {
    ctx.beginPath(); ctx.arc(360, 225, 170, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 55, 395, '#9aa5b1', '#5f6b7e'), INK, 5);
    ctx.beginPath(); ctx.arc(360, 225, 120, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 105, 345, '#495057', '#343a40'), INK, 3);
    ctx.strokeStyle = this.done.length === 6 ? '#3ddc97' : '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(360, 225, 132, 0, Math.PI * 2); ctx.stroke();
    (this.puzzle.order as number[]).forEach((clampIdx, k) => {
      const p = this.P(clampIdx);
      const tight = this.done.includes(clampIdx);
      screwHead(ctx, p.x, p.y, 26, tight ? 0.8 : 0);
      text(ctx, String(k + 1), p.x + (p.x > 360 ? 40 : -40), p.y, 22, tight ? '#3ddc97' : '#ffd23f', true);
    });
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const p = this.P(i);
      if (Math.hypot(x - p.x, y - p.y) > 34 || this.done.includes(i)) continue;
      const expected = this.puzzle.order[this.done.length];
      if (i !== expected) { this.badFlash = 1; this.sink.sfx('bad'); this.done = []; return; }
      this.done.push(i);
      this.sink.sfx('click');
      if (this.done.length === 6) this.submit({ order: this.done });
    }
  }
}

// ------------------------------------------------------------ Lastre (barco)
export class Ballast extends MG {
  a = 0.3; b = 0.7; moving: 'ab' | 'ba' | null = null;
  override init() { this.a = this.puzzle.a; this.b = this.puzzle.b; this.hint = 'Transfiere agua entre tanques hasta nivelar el barco y confirma.'; }
  override render(ctx: C, dt: number) {
    if (this.moving === 'ab') { const d = Math.min(this.a, dt * 0.12); this.a -= d; this.b = Math.min(1, this.b + d); }
    if (this.moving === 'ba') { const d = Math.min(this.b, dt * 0.12); this.b -= d; this.a = Math.min(1, this.a + d); }
    const tank = (x: number, v: number, lbl: string) => {
      rr(ctx, x, 70, 120, 260, 12); fillStroke(ctx, '#2b2d42', INK, 3);
      ctx.save(); rr(ctx, x + 6, 76, 108, 248, 8); ctx.clip();
      ctx.fillStyle = vgrad(ctx, 76, 324, '#5cc8ff', '#1d4e89'); ctx.fillRect(x + 6, 324 - 248 * v, 108, 248 * v);
      ctx.restore();
      text(ctx, `${lbl} ${Math.round(v * 100)} %`, x + 60, 350, 18, '#fff', true);
    };
    tank(70, this.a, 'BABOR');
    tank(530, this.b, 'ESTRIBOR');
    const tilt = (this.b - this.a) * 0.6;
    ctx.save(); ctx.translate(360, 170); ctx.rotate(tilt);
    ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.lineTo(90, 40); ctx.lineTo(-90, 40); ctx.closePath(); fillStroke(ctx, '#20375c', INK, 3);
    rr(ctx, -50, -36, 100, 36, 6); fillStroke(ctx, '#f1ede4', INK, 3);
    ctx.restore();
    ctx.fillStyle = Math.abs(this.a - this.b) <= 0.05 ? '#3ddc97' : '#ff4d5e';
    text(ctx, Math.abs(this.a - this.b) <= 0.05 ? 'NIVELADO' : 'ESCORADO', 360, 240, 22, ctx.fillStyle as string, true);
    btn(ctx, 220, 280, 130, 56, 'BABOR →', '#2a7fc0', this.moving === 'ab');
    btn(ctx, 370, 280, 130, 56, '← ESTRIBOR', '#2a7fc0', this.moving === 'ba');
    btn(ctx, 280, 360, 160, 52, 'CONFIRMAR', '#22a06b');
  }
  override down(x: number, y: number) {
    if (inRect(x, y, 220, 280, 130, 56)) this.moving = 'ab';
    else if (inRect(x, y, 370, 280, 130, 56)) this.moving = 'ba';
    else if (inRect(x, y, 280, 360, 160, 52)) {
      if (Math.abs(this.a - this.b) <= 0.05 && this.a > 0.2 && this.a < 0.8) this.submit({ a: this.a, b: this.b });
      else { this.badFlash = 1; this.sink.sfx('bad'); }
    }
  }
  override up() { this.moving = null; }
}

export class BallastTrim extends MG {
  hold = new Hold(260, 300, 200, 64, 'CONFIRMAR TRIMADO');
  override init() { this.hold = new Hold(260, 300, 200, 64, 'CONFIRMAR TRIMADO'); this.hint = 'Mantén pulsado para registrar el trimado en el puente.'; }
  override render(ctx: C, dt: number) {
    screenBox(ctx, 160, 60, 400, 200, '#0f2233');
    ctx.strokeStyle = '#5cc8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(200, 160); ctx.lineTo(520, 160 + Math.sin(this.t * 1.5) * 4); ctx.stroke();
    text(ctx, 'INCLINÓMETRO 0,0°', 360, 100, 22, '#3ddc97');
    this.hold.draw(ctx);
    if (this.hold.tick(dt, 1.3)) this.submit({ confirm: true });
  }
  override down(x: number, y: number) { this.hold.down(x, y); }
  override up() { this.hold.up(); }
}

// ------------------------------------------------------------ Carros de servicio (avión)
export class Carts extends MG {
  carts: Drag<number>[] = []; latched = [false, false, false]; placed = [false, false, false];
  override init() {
    this.carts = [0, 1, 2].map((i) => new Drag(80 + i * 120, 290, 90, 110, i));
    this.latched = [false, false, false]; this.placed = [false, false, false];
    if (this.part === 1) this.carts.forEach((c, i) => { c.x = this.bay(i).x; c.y = 80; c.placed = true; this.placed[i] = true; });
    this.hint = this.part === 0 ? 'Empuja cada carro a su hueco (el número coincide).' : 'Bloquea los tres pestillos.';
  }
  private bay(i: number) { return { x: 380 + i * 105, y: 70 }; }
  override render(ctx: C) {
    rr(ctx, 370, 60, 320, 140, 10); fillStroke(ctx, vgrad(ctx, 60, 200, '#cdd5e1', '#aeb9c9'), INK, 3);
    for (let i = 0; i < 3; i++) { const b = this.bay(i); rr(ctx, b.x, b.y + 10, 95, 120, 6); fillStroke(ctx, 'rgba(0,0,0,0.2)', '#2f6fb3', 2); text(ctx, String(i + 1), b.x + 47, b.y + 70, 28, 'rgba(255,255,255,0.4)'); }
    for (const c of this.carts) {
      rr(ctx, c.x, c.y, c.w, c.h, 8); fillStroke(ctx, vgrad(ctx, c.y, c.y + c.h, '#f1f3f5', '#ced4da'), INK, 3);
      ctx.fillStyle = '#2f6fb3'; ctx.fillRect(c.x + 8, c.y + 14, c.w - 16, 6);
      text(ctx, String(c.data + 1), c.cx(), c.cy(), 30, '#2f6fb3');
      if (this.part === 1) { const lx = c.cx(), ly = c.y + c.h + 26; rr(ctx, lx - 22, ly - 12, 44, 24, 8); fillStroke(ctx, this.latched[c.data] ? '#3ddc97' : '#ff4d5e', INK, 3); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(40, 250, 320, 4);
  }
  override down(x: number, y: number) {
    if (this.part === 0) { for (const c of this.carts) if (!c.placed && c.hit(x, y)) c.start(x, y); return; }
    for (const c of this.carts) { const lx = c.cx(), ly = c.y + c.h + 26; if (inRect(x, y, lx - 30, ly - 20, 60, 40) && !this.latched[c.data]) { this.latched[c.data] = true; this.sink.sfx('click'); } }
    if (this.latched.every(Boolean)) this.submit({ latched: 3 });
  }
  override move(x: number, y: number) { for (const c of this.carts) c.move(x, y); }
  override up() {
    for (const c of this.carts) {
      if (!c.dragging) continue;
      c.dragging = false;
      const b = this.bay(c.data);
      if (inRect(c.cx(), c.cy(), b.x - 20, b.y - 20, 135, 180)) { c.x = b.x; c.y = 80; c.placed = true; this.placed[c.data] = true; this.sink.sfx('ok'); }
      else c.home();
    }
    if (this.part === 0 && this.placed.every(Boolean)) this.submit({ placed: 3 });
  }
}

// ------------------------------------------------------------ Clasificar equipaje (avión)
export class Sorting extends MG {
  idx = 0; bins: number[] = []; bag: Drag | null = null; off = 0;
  override init() { this.idx = 0; this.bins = []; this.newBag(); this.hint = 'Arrastra cada maleta al contenedor de su destino.'; }
  private newBag() { this.bag = new Drag(-120, 120, 110, 80, null); this.off = 0; }
  override render(ctx: C, dt: number) {
    rr(ctx, 30, 150, 660, 60, 8); fillStroke(ctx, '#2b2d42', INK, 3);
    ctx.strokeStyle = '#495057'; ctx.lineWidth = 3; for (let x = 30 + ((this.t * 60) % 30); x < 690; x += 30) { ctx.beginPath(); ctx.moveTo(x, 152); ctx.lineTo(x, 208); ctx.stroke(); }
    (this.puzzle.bins as string[]).forEach((b, i) => { const x = 90 + i * 200; rr(ctx, x, 270, 160, 130, 12); fillStroke(ctx, vgrad(ctx, 270, 400, '#c0c8d4', '#8692a4'), INK, 3); text(ctx, b, x + 80, 300, 30, '#2f6fb3', true); });
    if (this.bag && this.idx < this.puzzle.bags.length) {
      if (!this.bag.dragging) { this.bag.x = Math.min(300, this.bag.x + dt * 220); this.bag.y = 110; }
      suitcaseIcon(ctx, this.bag.x, this.bag.y, this.bag.w, this.bag.h, ['#e76f51', '#457b9d', '#2a9d8f', '#e9c46a', '#9d4edd'][this.idx % 5], this.puzzle.bags[this.idx]);
    }
    text(ctx, `${this.idx}/${this.puzzle.bags.length}`, 620, 120, 20, '#fff', true);
  }
  override down(x: number, y: number) { if (this.bag?.hit(x, y)) this.bag.start(x, y); }
  override move(x: number, y: number) { this.bag?.move(x, y); }
  override up() {
    const b = this.bag;
    if (!b || !b.dragging) return;
    b.dragging = false;
    const bi = [0, 1, 2].find((i) => inRect(b.cx(), b.cy(), 90 + i * 200, 250, 160, 160));
    if (bi === undefined) { b.x = 300; return; }
    if (this.puzzle.bins[bi] !== this.puzzle.bags[this.idx]) { this.badFlash = 0.8; this.sink.sfx('bad'); b.x = 300; return; }
    this.bins.push(bi);
    this.idx++;
    this.sink.sfx('ok');
    if (this.idx >= this.puzzle.bags.length) this.submit({ bins: this.bins });
    else this.newBag();
  }
}

// ------------------------------------------------------------ Presurización (avión)
export class CabinPressure extends MG {
  a = 0.1; b = 0.9; drag: 'a' | 'b' | null = null;
  override init() { this.a = 0.1; this.b = 0.9; this.hint = 'Ajusta flujo y válvula hasta que la curva coincida con la consigna, y calibra.'; }
  private val() { return this.puzzle.ka * this.a + (1 - this.puzzle.ka) * this.b; }
  override render(ctx: C) {
    screenBox(ctx, 60, 50, 600, 190, '#0b1a2b');
    ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
    const ty = 220 - this.puzzle.target * 150; ctx.beginPath(); ctx.moveTo(70, ty); ctx.lineTo(650, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#5cc8ff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 70; x <= 650; x += 6) { const y = 220 - this.val() * 150 + Math.sin(x / 30 + this.t * 3) * 8 * (1 - Math.min(1, Math.abs(this.val() - this.puzzle.target) * 4)); if (x === 70) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    text(ctx, `CABINA ${(this.val() * 8000).toFixed(0)} ft · CONSIGNA ${(this.puzzle.target * 8000).toFixed(0)} ft`, 360, 70, 16, '#3ddc97');
    slider(ctx, 120, 300, 300, this.a, null, null, '#5cc8ff'); text(ctx, 'FLUJO', 80, 300, 16, '#fff', true);
    slider(ctx, 120, 370, 300, this.b, null, null, '#a66cff'); text(ctx, 'VÁLVULA', 70, 370, 14, '#fff', true);
    btn(ctx, 470, 300, 180, 90, 'CALIBRAR', '#22a06b');
  }
  override down(x: number, y: number) {
    if (inRect(x, y, 100, 270, 340, 60)) this.drag = 'a';
    else if (inRect(x, y, 100, 340, 340, 60)) this.drag = 'b';
    else if (inRect(x, y, 470, 300, 180, 90)) {
      if (Math.abs(this.val() - this.puzzle.target) <= 0.035) this.submit({ a: this.a, b: this.b }); else { this.badFlash = 1; this.sink.sfx('bad'); }
    }
  }
  override move(x: number) { const v = Math.max(0, Math.min(1, (x - 120) / 300)); if (this.drag === 'a') this.a = v; if (this.drag === 'b') this.b = v; }
  override up() { this.drag = null; }
}

export class CabinPressureDoor extends MG {
  hold = new Hold(250, 320, 220, 60, 'VERIFICAR SELLADO');
  override init() { this.hold = new Hold(250, 320, 220, 60, 'VERIFICAR SELLADO'); this.hint = 'Mantén pulsado para verificar el panel de la puerta L1.'; }
  override render(ctx: C, dt: number) {
    rr(ctx, 230, 50, 260, 250, 30); fillStroke(ctx, vgrad(ctx, 50, 300, '#e3e9f1', '#c3cddb'), INK, 4);
    rr(ctx, 300, 80, 120, 80, 30); fillStroke(ctx, '#9fd3ea', INK, 3);
    for (let i = 0; i < 6; i++) led(ctx, 260 + i * 40, 250, this.hold.p > i / 6 ? '#3ddc97' : '#ff4d5e', 8);
    this.hold.draw(ctx);
    if (this.hold.tick(dt, 1.6)) this.submit({ hold: true });
  }
  override down(x: number, y: number) { this.hold.down(x, y); }
  override up() { this.hold.up(); }
}

