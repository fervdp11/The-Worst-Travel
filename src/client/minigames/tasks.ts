import { COOK_STEPS } from '../../shared/minigames';
import { fillStroke, led, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { MG } from './base';
import { Drag, paper, screenBox, Scrub, sponge } from './common';
import { btn, C, dial, food, FOOD_NAMES, inRect, lever, plate, screwHead, suitcaseIcon, symbol, text, wheel } from './kit';

const T = (theme: string, ship: string, plane: string) => (theme === 'plane' ? plane : ship);

// ------------------------------------------------------------ Pedidos (recoger)
export class OrdersPick extends MG {
  sel: string[] = [];
  override init() { this.sel = []; this.hint = 'Lee la comanda y pon en la bandeja los tres platos pedidos.'; }
  private slots() { return (this.puzzle.options as string[]).map((f, i) => ({ f, x: 300 + (i % 3) * 130, y: 90 + Math.floor(i / 3) * 120 })); }
  override render(ctx: C) {
    paper(ctx, 40, 70, 210, 260, -0.03);
    text(ctx, 'COMANDA', 145, 100, 22, INK);
    text(ctx, `${T(this.theme, 'Mesa', 'Fila')} ${this.puzzle.table ?? ''}`, 145, 128, 18, '#c8323f');
    (this.puzzle.want as string[]).forEach((f, i) => { food(ctx, f, 95, 175 + i * 50, 36); text(ctx, FOOD_NAMES[f], 170, 175 + i * 50, 18, INK); });
    for (const s of this.slots()) {
      const on = this.sel.includes(s.f);
      plate(ctx, s.x, s.y, 110, 100, on ? '#3ddc97' : '#e9ecef');
      food(ctx, s.f, s.x + 55, s.y + 42, 46);
      text(ctx, FOOD_NAMES[s.f], s.x + 55, s.y + 84, 15, INK);
    }
    // bandeja
    ctx.beginPath(); ctx.ellipse(470, 375, 170, 30, 0, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 345, 405, '#e9ecef', '#adb5bd'), INK, 3);
    this.sel.forEach((f, i) => food(ctx, f, 380 + i * 90, 366, 40));
  }
  override down(x: number, y: number) {
    for (const s of this.slots()) if (inRect(x, y, s.x, s.y, 110, 100)) {
      if (this.sel.includes(s.f)) this.sel = this.sel.filter((q) => q !== s.f);
      else if (this.sel.length < 3) this.sel.push(s.f);
      this.sink.sfx('click');
      if (this.sel.length === 3) {
        if ([...this.sel].sort().join() === [...this.puzzle.want].sort().join()) this.submit({ items: this.sel });
        else { this.badFlash = 1; this.sink.sfx('bad'); setTimeout(() => (this.sel = []), 250); }
      }
    }
  }
}

// ------------------------------------------------------------ Pedidos (servir)
export class OrdersServe extends MG {
  override init() { this.hint = 'Entrega la bandeja al pasajero cuyo pedido coincide con tu comanda.'; }
  private diners() { const n = this.puzzle.diners.length; return (this.puzzle.diners as string[][]).map((d, i) => ({ d, x: 250 + i * (440 / n), w: 440 / n - 14 })); }
  override render(ctx: C) {
    paper(ctx, 32, 70, 190, 240, 0.02);
    text(ctx, 'TU COMANDA', 127, 100, 20, INK);
    (this.puzzle.want as string[]).forEach((f, i) => food(ctx, f, 127, 150 + i * 52, 38));
    this.diners().forEach((p, i) => {
      const hov = inRect(this.ptr.x, this.ptr.y, p.x, 60, p.w, 320);
      plate(ctx, p.x, 70, p.w, 300, hov ? '#ffe8a3' : '#f1ede4');
      // pasajero sencillo
      ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, 300, 34, 44, 0, 0, Math.PI * 2); fillStroke(ctx, ['#5e8c61', '#c06c84', '#457b9d', '#e9c46a'][i % 4], INK, 3);
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, 245, 26, 0, Math.PI * 2); fillStroke(ctx, '#f2c9a0', INK, 3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.x + p.w / 2 - 8, 242, 3, 0, Math.PI * 2); ctx.arc(p.x + p.w / 2 + 8, 242, 3, 0, Math.PI * 2); ctx.fill();
      rr(ctx, p.x + 10, 84, p.w - 20, 120, 14); fillStroke(ctx, '#fff', INK, 2.5);
      p.d.forEach((f, k) => food(ctx, f, p.x + p.w / 2, 110 + k * 36, 28));
    });
  }
  override down(x: number, y: number) { this.diners().forEach((p, i) => { if (inRect(x, y, p.x, 60, p.w, 320)) this.submit({ diner: i }); }); }
}

// ------------------------------------------------------------ Cocina
export class Cooking extends MG {
  sel: string[] = [];
  seq: string[] = [];
  action: { name: string; t: number } | null = null;
  override init() {
    this.sel = []; this.seq = []; this.action = null;
    this.hint = this.part === 0 ? 'Elige los tres ingredientes de la receta.' : 'Sigue la secuencia de preparación en orden.';
  }
  override render(ctx: C, dt: number) {
    paper(ctx, 36, 60, 200, 300, -0.02);
    text(ctx, 'RECETA', 136, 88, 22, INK);
    if (this.part === 0) {
      (this.puzzle.ingredients as string[]).forEach((f, i) => food(ctx, f, 136, 140 + i * 62, 40));
      (this.puzzle.options as string[]).forEach((f, i) => {
        const x = 280 + (i % 3) * 140, y = 80 + Math.floor(i / 3) * 140;
        const on = this.sel.includes(f);
        rr(ctx, x, y, 120, 120, 16); fillStroke(ctx, vgrad(ctx, y, y + 120, on ? '#b7f7d6' : '#e3f2fd', on ? '#3ddc97' : '#90caf9'), INK, 3);
        rr(ctx, x + 18, y - 10, 84, 20, 6); fillStroke(ctx, '#adb5bd', INK, 2);
        food(ctx, f, x + 60, y + 58, 52);
        text(ctx, FOOD_NAMES[f], x + 60, y + 104, 14, INK);
      });
    } else {
      (this.puzzle.steps as string[]).forEach((s, i) => { text(ctx, `${i + 1}. ${s.toUpperCase()}`, 136, 140 + i * 50, 20, i < this.seq.length ? '#2b9348' : INK); });
      // olla con vapor animado
      ctx.beginPath(); ctx.ellipse(470, 330, 120, 30, 0, 0, Math.PI * 2); fillStroke(ctx, '#495057', INK, 3);
      rr(ctx, 360, 250, 220, 80, 14); fillStroke(ctx, vgrad(ctx, 250, 330, '#ced4da', '#868e96'), INK, 3);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(400 + i * 45, 230 - ((this.t * 40 + i * 20) % 60), 12, 0, Math.PI * 2); ctx.fill(); }
      COOK_STEPS.forEach((s, i) => btn(ctx, 260 + i * 88, 90, 80, 70, s.slice(0, 7).toUpperCase(), ['#ff8a3d', '#5cc8ff', '#a66cff', '#ff4d5e', '#3ddc97'][i], this.action?.name === s));
      if (this.action) {
        this.action.t += dt;
        rr(ctx, 360, 190, 220, 16, 8); fillStroke(ctx, '#11151f', INK, 2);
        rr(ctx, 361, 191, 218 * Math.min(1, this.action.t / 0.6), 14, 7); ctx.fillStyle = '#ffd23f'; ctx.fill();
        if (this.action.t >= 0.6) {
          this.seq.push(this.action.name);
          this.action = null;
          const want = this.puzzle.steps as string[];
          if (this.seq[this.seq.length - 1] !== want[this.seq.length - 1]) { this.badFlash = 1; this.sink.sfx('bad'); this.seq = []; }
          else if (this.seq.length === want.length) this.submit({ steps: this.seq });
          else this.sink.sfx('ok');
        }
      }
    }
  }
  override down(x: number, y: number) {
    if (this.part === 0) {
      (this.puzzle.options as string[]).forEach((f, i) => {
        const bx = 280 + (i % 3) * 140, by = 80 + Math.floor(i / 3) * 140;
        if (!inRect(x, y, bx, by, 120, 120)) return;
        this.sel = this.sel.includes(f) ? this.sel.filter((q) => q !== f) : this.sel.length < 3 ? [...this.sel, f] : this.sel;
        this.sink.sfx('click');
        if (this.sel.length === 3) {
          if ([...this.sel].sort().join() === [...this.puzzle.ingredients].sort().join()) this.submit({ items: this.sel });
          else { this.badFlash = 1; this.sink.sfx('bad'); this.sel = []; }
        }
      });
    } else if (!this.action) {
      COOK_STEPS.forEach((s, i) => { if (inRect(x, y, 260 + i * 88, 90, 80, 70)) { this.action = { name: s, t: 0 }; this.sink.sfx('click'); } });
    }
  }
}

// ------------------------------------------------------------ Bebida
export class Drink extends MG {
  level = 0; pouring = false; cup!: Drag; filled = false; spilled = 0;
  override init() { this.level = 0; this.filled = false; this.cup = new Drag(250, 230, 90, 110, null); this.hint = 'Mantén pulsado para servir hasta la marca y lleva la taza a la bandeja.'; }
  override render(ctx: C, dt: number) {
    // máquina
    rr(ctx, 160, 50, 280, 150, 16); fillStroke(ctx, vgrad(ctx, 50, 200, '#3d405b', '#2b2d42'), INK, 3);
    screenBox(ctx, 190, 70, 120, 40, '#1d2b22');
    text(ctx, this.filled ? 'LISTO' : this.pouring ? 'SIRVIENDO' : 'PULSA', 250, 90, 16, '#ffd23f');
    rr(ctx, 275, 190, 50, 26, 6); fillStroke(ctx, '#868e96', INK, 2);
    btn(ctx, 330, 74, 90, 80, 'VERTER', '#ff8a3d', this.pouring);
    if (this.pouring && !this.filled && !this.cup.dragging && Math.abs(this.cup.cx() - 300) < 30) {
      this.level = Math.min(1.1, this.level + dt * 0.38);
      ctx.fillStyle = '#6f4518'; ctx.fillRect(296, 216, 8, this.cup.y + 20 - 216);
      if (this.level > 1) { this.spilled = 1; this.level = 0; this.pouring = false; this.sink.sfx('bad'); this.badFlash = 1; }
    }
    // taza con marca
    const c = this.cup;
    if (!this.cup.dragging && !this.filled) { c.x = 255; c.y = 240; }
    rr(ctx, c.x, c.y, c.w, c.h, 10); fillStroke(ctx, '#f8f9fa', INK, 3);
    ctx.save(); rr(ctx, c.x + 4, c.y + 4, c.w - 8, c.h - 8, 8); ctx.clip();
    const lh = (c.h - 8) * Math.min(1, this.level);
    ctx.fillStyle = vgrad(ctx, c.y + c.h - lh, c.y + c.h, '#8b5a2b', '#5a3a1a'); ctx.fillRect(c.x, c.y + c.h - 4 - lh, c.w, lh + 4);
    ctx.restore();
    const ly = c.y + c.h - 4 - (c.h - 8) * this.puzzle.hi, ly2 = c.y + c.h - 4 - (c.h - 8) * this.puzzle.lo;
    ctx.fillStyle = 'rgba(61,220,151,0.35)'; ctx.fillRect(c.x - 6, ly, c.w + 12, ly2 - ly);
    ctx.strokeStyle = '#2b9348'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - 8, ly); ctx.lineTo(c.x + c.w + 8, ly); ctx.moveTo(c.x - 8, ly2); ctx.lineTo(c.x + c.w + 8, ly2); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(c.x + c.w + 10, c.y + 50, 16, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    // bandeja
    ctx.beginPath(); ctx.ellipse(570, 340, 110, 34, 0, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 306, 374, '#e9ecef', '#adb5bd'), INK, 3);
    text(ctx, 'BANDEJA', 570, 390, 16, '#fff', true);
    if (this.spilled > 0) { text(ctx, '¡Se ha desbordado! Prueba otra vez.', 360, 410, 16, '#ff4d5e', true); this.spilled = Math.max(0, this.spilled - dt * 0.6); }
  }
  override down(x: number, y: number) {
    if (inRect(x, y, 330, 74, 90, 80)) { this.pouring = true; return; }
    const inBand = this.level >= this.puzzle.lo && this.level <= this.puzzle.hi;
    if (this.cup.hit(x, y) && inBand) { this.filled = true; this.cup.start(x, y); }
  }
  override move(x: number, y: number) { this.cup.move(x, y); }
  override up() {
    this.pouring = false;
    if (this.cup.dragging) {
      this.cup.dragging = false;
      if (Math.hypot(this.cup.cx() - 570, this.cup.cy() - 320) < 110) this.submit({ level: this.level, placed: true });
      else this.cup.home();
    }
  }
}

// ------------------------------------------------------------ Fregado
export class Dishes extends MG {
  idx = 0; scrub!: Scrub;
  override init() { this.idx = 0; this.load(); this.hint = 'Frota las manchas con la esponja hasta dejar los tres platos limpios.'; }
  private load() { const pl = this.puzzle.plates[this.idx]; this.scrub = new Scrub(pl.map((s: number[]) => ({ x: 360 + (s[0] - 0.5) * 300, y: 230 + (s[1] - 0.5) * 220, r: 30 + s[2] * 120 }))); }
  override render(ctx: C) {
    rr(ctx, 120, 80, 480, 320, 30); fillStroke(ctx, vgrad(ctx, 80, 400, '#a7c7e7', '#6c9ac3'), INK, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(160 + i * 60, 110 + (i % 2) * 20, 8 + (i % 3) * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(360, 230, 170, 120, 0, 0, Math.PI * 2); fillStroke(ctx, '#fbfbf8', INK, 4);
    ctx.beginPath(); ctx.ellipse(360, 230, 110, 76, 0, 0, Math.PI * 2); ctx.strokeStyle = '#d6dde8'; ctx.lineWidth = 4; ctx.stroke();
    this.scrub.draw(ctx);
    text(ctx, `Plato ${this.idx + 1}/3`, 360, 60, 20, '#fff', true);
    if (this.ptr.down) sponge(ctx, this.ptr.x, this.ptr.y, this.t);
  }
  override down(x: number, y: number) { this.scrub.rub(x, y); }
  override move(x: number, y: number) {
    if (!this.ptr.down || this.busy) return;
    this.scrub.rub(x, y);
    if (this.scrub.done()) {
      this.sink.sfx('ok');
      this.idx++;
      if (this.idx >= 3) { this.idx = 2; this.submit({ plates: 3 }); }
      else this.load();
    }
  }
  override up() { this.scrub.release(); }
}

// ------------------------------------------------------------ Aseo
export class Toilet extends MG {
  scrub!: Scrub; roll!: Drag;
  override init() {
    if (this.part === 0) { this.scrub = new Scrub((this.puzzle.spots as number[][]).map((s) => ({ x: 120 + s[0] * 480, y: 60 + s[1] * 330, r: 34 }))); this.hint = 'Limpia las superficies frotando.'; }
    else { this.roll = new Drag(520, 300, 90, 70, null); this.hint = 'Coloca un rollo nuevo en el portarrollos.'; }
  }
  override render(ctx: C) {
    rr(ctx, 40, 40, 640, 360, 14); fillStroke(ctx, vgrad(ctx, 40, 400, '#e3f2fd', '#bbdefb'), INK, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; for (let x = 40; x < 680; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 400); ctx.stroke(); }
    // lavabo y espejo
    rr(ctx, 90, 70, 200, 120, 12); fillStroke(ctx, vgrad(ctx, 70, 190, '#dff3ff', '#9ec9e2'), INK, 3);
    ctx.beginPath(); ctx.ellipse(190, 300, 110, 50, 0, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', INK, 3);
    ctx.beginPath(); ctx.ellipse(470, 310, 80, 60, 0, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', INK, 3);
    rr(ctx, 420, 180, 100, 80, 10); fillStroke(ctx, '#ffffff', INK, 3);
    if (this.part === 0) { this.scrub.draw(ctx, 'rgba(120,140,60,'); if (this.ptr.down) sponge(ctx, this.ptr.x, this.ptr.y, this.t); }
    // portarrollos
    rr(ctx, 600, 160, 50, 14, 6); fillStroke(ctx, '#adb5bd', INK, 2);
    if (this.part === 1) {
      const r = this.roll;
      ctx.beginPath(); ctx.ellipse(r.cx(), r.cy(), 40, 30, 0, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', INK, 3);
      ctx.beginPath(); ctx.ellipse(r.cx(), r.cy(), 12, 9, 0, 0, Math.PI * 2); fillStroke(ctx, '#c8a574', INK, 2);
      text(ctx, '↑', 625, 210, 30, '#ffd23f', true);
    }
  }
  override down(x: number, y: number) { if (this.part === 1 && this.roll.hit(x, y)) this.roll.start(x, y); else if (this.part === 0) this.scrub.rub(x, y); }
  override move(x: number, y: number) {
    if (this.part === 0 && this.ptr.down && !this.busy) { this.scrub.rub(x, y); if (this.scrub.done()) this.submit({ clean: this.scrub.spots.length }); }
    if (this.part === 1) this.roll.move(x, y);
  }
  override up() {
    if (this.part === 0) this.scrub.release();
    if (this.part === 1 && this.roll.dragging) { this.roll.dragging = false; if (Math.hypot(this.roll.cx() - 625, this.roll.cy() - 175) < 70) this.submit({ paper: true }); else this.roll.home(); }
  }
}

// ------------------------------------------------------------ Cableado
const WIRE_COLORS = ['#ff4d5e', '#ffd23f', '#5cc8ff', '#a66cff'];
export class Wiring extends MG {
  links: (number | null)[] = [];
  drag: { from: number; x: number; y: number } | null = null;
  override init() { this.links = [null, null, null, null]; this.hint = 'Une cada conector con el de su mismo símbolo.'; }
  private L(i: number) { return { x: 110, y: 100 + i * 80 }; }
  private R(r: number) { return { x: 610, y: 100 + r * 80 }; }
  override render(ctx: C) {
    for (let i = 0; i < 4; i++) {
      const l = this.L(i);
      const sym = this.puzzle.symbols[i];
      plate(ctx, l.x - 70, l.y - 28, 90, 56, '#3d405b');
      symbol(ctx, sym, l.x - 32, l.y, 14, WIRE_COLORS[i]);
      ctx.beginPath(); ctx.arc(l.x, l.y, 12, 0, Math.PI * 2); fillStroke(ctx, WIRE_COLORS[i], INK, 3);
      const r = this.R(i);
      const li = this.puzzle.right[i];
      plate(ctx, r.x - 20, r.y - 28, 90, 56, '#3d405b');
      symbol(ctx, this.puzzle.symbols[li], r.x + 32, r.y, 14, WIRE_COLORS[li]);
      ctx.beginPath(); ctx.arc(r.x, r.y, 12, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 3);
    }
    const cable = (x0: number, y0: number, x1: number, y1: number, col: string) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 160, y0, x1 - 160, y1, x1, y1); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    };
    this.links.forEach((r, i) => { if (r !== null) { const a = this.L(i), b = this.R(r); cable(a.x, a.y, b.x, b.y, WIRE_COLORS[i]); } });
    if (this.drag) { const a = this.L(this.drag.from); cable(a.x, a.y, this.drag.x, this.drag.y, WIRE_COLORS[this.drag.from]); }
  }
  override down(x: number, y: number) { for (let i = 0; i < 4; i++) { const l = this.L(i); if (Math.hypot(x - l.x, y - l.y) < 40 && this.links[i] === null) this.drag = { from: i, x, y }; } }
  override move(x: number, y: number) { if (this.drag) { this.drag.x = x; this.drag.y = y; } }
  override up(x: number, y: number) {
    if (!this.drag) return;
    for (let r = 0; r < 4; r++) {
      const p = this.R(r);
      if (Math.hypot(x - p.x, y - p.y) < 44) {
        if (this.puzzle.right[r] === this.drag.from) { this.links[this.drag.from] = r; this.sink.sfx('ok'); }
        else { this.badFlash = 0.6; this.sink.sfx('bad'); }
      }
    }
    this.drag = null;
    if (this.links.every((l) => l !== null)) this.submit({ map: this.links });
  }
}

// ------------------------------------------------------------ Fusibles
export class Fuses extends MG {
  fuse!: Drag;
  override init() { this.hint = this.part === 0 ? 'Identifica el fusible averiado: piloto apagado y lectura nula.' : 'Coloca el fusible nuevo en el hueco.'; this.fuse = new Drag(560, 330, 110, 44, null); }
  override render(ctx: C) {
    rr(ctx, 70, 60, 580, 240, 16); fillStroke(ctx, vgrad(ctx, 60, 300, '#495057', '#343a40'), INK, 3);
    for (let i = 0; i < 6; i++) {
      const x = 110 + i * 92;
      const broken = i === this.puzzle.broken;
      screenBox(ctx, x - 6, 76, 76, 30, '#1d2b22');
      text(ctx, `${this.puzzle.readings[i]} A`, x + 32, 91, 16, broken ? '#ff4d5e' : '#3ddc97');
      led(ctx, x + 32, 126, broken ? '#3a3f4a' : '#3ddc97', 7);
      rr(ctx, x + 6, 150, 52, 120, 10); fillStroke(ctx, '#212529', INK, 3);
      if (!(this.part === 1 && broken)) {
        rr(ctx, x + 14, 160, 36, 100, 8); fillStroke(ctx, vgrad(ctx, 160, 260, broken ? '#6c4f3d' : '#ffe8a3', broken ? '#3d2b1f' : '#f4c430'), INK, 2.5);
        if (broken) { ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, 200); ctx.lineTo(x + 44, 215); ctx.stroke(); }
      } else { text(ctx, '?', x + 32, 210, 30, '#ffd23f', true); }
    }
    if (this.part === 1) {
      const f = this.fuse;
      rr(ctx, f.x, f.y, f.w, f.h, 10); fillStroke(ctx, vgrad(ctx, f.y, f.y + f.h, '#ffe8a3', '#f4c430'), INK, 3);
      text(ctx, 'NUEVO', f.cx(), f.cy(), 15, INK);
    }
  }
  override down(x: number, y: number) {
    if (this.part === 0) { for (let i = 0; i < 6; i++) if (inRect(x, y, 110 + i * 92, 70, 76, 210)) { if (i === this.puzzle.broken) this.submit({ fuse: i }); else { this.badFlash = 0.6; this.sink.sfx('bad'); } } }
    else if (this.fuse.hit(x, y)) this.fuse.start(x, y);
  }
  override move(x: number, y: number) { this.fuse.move(x, y); }
  override up() { if (this.part === 1 && this.fuse.dragging) { this.fuse.dragging = false; const sx = 110 + this.puzzle.broken * 92 + 32; if (Math.hypot(this.fuse.cx() - sx, this.fuse.cy() - 210) < 70) this.submit({ inserted: true }); else this.fuse.home(); } }
}

// ------------------------------------------------------------ Presión (válvulas)
export class Pressure extends MG {
  v: number[] = []; drag = -1; inBand = 0;
  override init() { this.v = [...this.puzzle.start]; this.inBand = 0; this.hint = 'Gira las válvulas hasta dejar la aguja dentro de la banda verde.'; }
  private val() { const c = this.puzzle.coef as number[]; return c.reduce((s, k, i) => s + k * this.v[i], 0) / c.reduce((s, k) => s + k, 0); }
  override render(ctx: C, dt: number) {
    dial(ctx, 360, 150, 92, this.val(), this.puzzle.lo, this.puzzle.hi, 'BAR');
    for (let i = 0; i < 3; i++) { wheel(ctx, 160 + i * 200, 330, 52, this.v[i] * Math.PI * 4, ['#d64545', '#2a9d8f', '#e9c46a'][i]); text(ctx, `${Math.round(this.v[i] * 100)} %`, 160 + i * 200, 404, 16, '#fff', true); }
    const ok = this.val() >= this.puzzle.lo && this.val() <= this.puzzle.hi;
    if (ok && this.drag < 0) { this.inBand += dt; if (this.inBand > 0.6) this.submit({ v: this.v }); } else this.inBand = 0;
  }
  override down(x: number, y: number) { for (let i = 0; i < 3; i++) if (Math.hypot(x - (160 + i * 200), y - 330) < 70) this.drag = i; }
  override move(_x: number, _y: number) {}
  override up() { this.drag = -1; }
  override dragBy(dx: number) { if (this.drag >= 0) this.v[this.drag] = Math.max(0, Math.min(1, this.v[this.drag] + dx / 400)); }
}

// ------------------------------------------------------------ Filtro del motor
export class Filter extends MG {
  screws: number[] = []; scrub!: Scrub;
  override init() {
    this.screws = [0, 0, 0, 0];
    if (this.part === 1) this.scrub = new Scrub((this.puzzle.dirt as number[][]).map((d) => ({ x: 220 + d[0] * 280, y: 100 + d[1] * 240, r: 36 })));
    this.hint = ['Afloja los cuatro tornillos de la tapa.', 'Limpia el filtro frotando la suciedad.', 'Vuelve a atornillar la tapa.'][this.part];
  }
  private sp(i: number) { return [[200, 110], [520, 110], [200, 330], [520, 330]][i]; }
  override render(ctx: C) {
    rr(ctx, 160, 70, 400, 300, 20); fillStroke(ctx, vgrad(ctx, 70, 370, '#868e96', '#495057'), INK, 4);
    if (this.part === 1) {
      rr(ctx, 210, 100, 300, 240, 12); fillStroke(ctx, '#ffe8a3', INK, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; for (let x = 225; x < 505; x += 14) { ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x, 336); ctx.stroke(); }
      this.scrub.draw(ctx, 'rgba(40,30,20,');
      if (this.ptr.down) sponge(ctx, this.ptr.x, this.ptr.y, this.t);
    } else {
      rr(ctx, 180, 90, 360, 260, 16); fillStroke(ctx, vgrad(ctx, 90, 350, '#ced4da', '#adb5bd'), INK, 3);
      text(ctx, 'FILTRO', 360, 220, 30, '#495057');
      for (let i = 0; i < 4; i++) { const [x, y] = this.sp(i); const out = this.part === 0 ? this.screws[i] : 1 - this.screws[i]; screwHead(ctx, x, y - out * 10, 20, out * 6); }
    }
  }
  override down(x: number, y: number) {
    if (this.part === 1) { this.scrub.rub(x, y); return; }
    for (let i = 0; i < 4; i++) { const [sx, sy] = this.sp(i); if (Math.hypot(x - sx, y - sy) < 34 && this.screws[i] === 0) { this.screws[i] = 1; this.sink.sfx('click'); } }
    if (this.screws.every((s) => s === 1)) this.submit({ screws: 4 });
  }
  override move(x: number, y: number) { if (this.part === 1 && this.ptr.down && !this.busy) { this.scrub.rub(x, y); if (this.scrub.done()) this.submit({ clean: true }); } }
  override up() { this.scrub?.release(); }
}

// ------------------------------------------------------------ Asistencia al responsable (secuencia)
export class Assist extends MG {
  showI = 0; showT = 0; input: number[] = []; playing = true; lit = -1; litT = 0;
  override init() { this.showI = 0; this.showT = -0.6; this.input = []; this.playing = true; this.hint = `Memoriza la secuencia del ${T(this.theme, 'radar', 'panel superior')} y repítela.`; }
  private B(i: number) { return { x: 130 + (i % 3) * 160, y: 150 + Math.floor(i / 3) * 120 }; }
  override render(ctx: C, dt: number) {
    screenBox(ctx, 220, 50, 280, 60, this.mat.screen);
    text(ctx, this.playing ? 'OBSERVA…' : `REPITE ${this.input.length}/${this.puzzle.seq.length}`, 360, 80, 22, '#3ddc97');
    if (this.playing) {
      this.showT += dt;
      if (this.showT > 0.55) { this.showT = 0; this.lit = this.puzzle.seq[this.showI]; this.litT = 0.4; this.sink.sfx('click'); this.showI++; if (this.showI > this.puzzle.seq.length) { this.playing = false; this.lit = -1; } }
    }
    this.litT -= dt;
    if (this.litT <= 0 && this.playing === false) this.lit = -1;
    for (let i = 0; i < 6; i++) {
      const b = this.B(i);
      const on = this.lit === i && this.litT > 0;
      btn(ctx, b.x, b.y, 140, 96, '', on ? '#fff3b0' : ['#ff4d5e', '#ffd23f', '#3ddc97', '#5cc8ff', '#a66cff', '#ff8a3d'][i], on, (cx, cy) => symbol(ctx, ['circulo', 'cuadrado', 'triangulo', 'rombo', 'estrella', 'cruz'][i], cx, cy, 18, '#fff'));
    }
  }
  override down(x: number, y: number) {
    if (this.playing) return;
    for (let i = 0; i < 6; i++) {
      const b = this.B(i);
      if (!inRect(x, y, b.x, b.y, 140, 96)) continue;
      this.lit = i; this.litT = 0.25;
      this.input.push(i);
      const k = this.input.length - 1;
      if (this.puzzle.seq[k] !== i) { this.badFlash = 1; this.sink.sfx('bad'); this.init(); return; }
      this.sink.sfx('click');
      if (this.input.length === this.puzzle.seq.length) this.submit({ seq: this.input });
    }
  }
}

// ------------------------------------------------------------ Equipaje
const SIZE_W: Record<string, number> = { S: 90, M: 130, L: 170 };
export class Luggage extends MG {
  bags: Drag<{ size: string; i: number }>[] = []; slotOf: (number | null)[] = [];
  override init() {
    let x = 60;
    this.bags = (this.puzzle.bags as string[]).map((s, i) => { const d = new Drag(x, 320, SIZE_W[s], 80, { size: s, i }); x += SIZE_W[s] + 14; return d; });
    this.slotOf = this.bags.map(() => null);
    this.hint = 'Coloca cada maleta en un hueco de su tamaño. El pasillo debe quedar libre.';
  }
  private slots() { let x = 40; return (this.puzzle.slots as string[]).map((s) => { const r = { x, w: SIZE_W[s] + 10, size: s }; x += r.w + 14; return r; }); }
  override render(ctx: C) {
    rr(ctx, 30, 70, 660, 130, 10); fillStroke(ctx, vgrad(ctx, 70, 200, '#6c757d', '#495057'), INK, 3);
    text(ctx, T(this.theme, 'ESTIBA', 'COMPARTIMENTO SUPERIOR'), 360, 56, 18, '#fff', true);
    this.slots().forEach((s, k) => { rr(ctx, s.x, 90, s.w, 100, 8); fillStroke(ctx, this.slotOf.includes(k) ? 'rgba(61,220,151,0.3)' : 'rgba(0,0,0,0.3)', '#ffd23f', 2); text(ctx, s.size, s.x + s.w / 2, 140, 26, 'rgba(255,255,255,0.35)'); });
    ctx.fillStyle = 'rgba(255,210,63,0.15)'; ctx.fillRect(30, 215, 660, 80);
    text(ctx, 'PASILLO · MANTENER LIBRE', 360, 255, 16, 'rgba(255,255,255,0.6)');
    for (const b of this.bags) suitcaseIcon(ctx, b.x, b.y, b.w, b.h, { S: '#e76f51', M: '#457b9d', L: '#2a9d8f' }[b.data.size]!, b.data.size);
  }
  override down(x: number, y: number) { for (const b of [...this.bags].reverse()) if (b.hit(x, y)) { b.start(x, y); this.slotOf[b.data.i] = null; break; } }
  override move(x: number, y: number) { for (const b of this.bags) b.move(x, y); }
  override up() {
    for (const b of this.bags) {
      if (!b.dragging) continue;
      b.dragging = false;
      const k = this.slots().findIndex((s, kk) => inRect(b.cx(), b.cy(), s.x, 80, s.w, 120) && s.size === b.data.size && !this.slotOf.includes(kk));
      if (k >= 0) { const s = this.slots()[k]; b.x = s.x + 5; b.y = 100; this.slotOf[b.data.i] = k; this.sink.sfx('ok'); }
      else { b.home(); if (b.cy() < 300) this.sink.sfx('bad'); }
    }
    if (this.slotOf.every((s) => s !== null)) this.submit({ map: this.slotOf });
  }
}

