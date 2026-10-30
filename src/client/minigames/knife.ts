import { fillStroke, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { MG } from './base';
import { Drag, Hold, paper, screenBox } from './common';
import { btn, C, inRect, text } from './kit';

const DOC: Record<string, { title: string; lines: string[] }[]> = {
  ship: [
    { title: 'Manifiesto de pasaje', lines: ['Camarote 1: familia Ruiz', 'Camarote 3: viajero solo', 'Vehículos en bodega: 4', 'Mercancía frágil: popa', 'Tripulación de guardia: 6'] },
    { title: 'Tablón de turnos', lines: ['Puente: capitana Arrieta', 'Máquinas: dos operarios', 'Cocina: turno de tarde', 'Taller: inventario pendiente', 'Botes: revisión semanal'] },
    { title: 'Diario de navegación', lines: ['Rumbo 245°, mar en calma', 'Lastre: equilibrado', 'Bombas: prueba superada', 'Radio: canal 16 a la escucha', 'Llegada prevista: 18:20'] },
  ],
  plane: [
    { title: 'Parte de vuelo', lines: ['Combustible: según plan', 'Altitud de crucero: FL360', 'Presurización: nominal', 'Turbulencia ligera prevista', 'Tripulación: 1 piloto, 5 TCP'] },
    { title: 'Registro de cabina', lines: ['Carros asegurados en despegue', 'Aseo norte: revisar', 'Fila 18: pasajero en silla', 'Comidas especiales: 3', 'Precintos de bar: 12'] },
    { title: 'Hoja de carga', lines: ['Bodega delantera: 5 ULD', 'Bodega trasera: carga suelta', 'Mercancía peligrosa: ninguna', 'Peso total en límites', 'Contenedor de mantenimiento: precintado'] },
  ],
};

// ------------------------------------------------------------ Documentación manipulada
export class KDocs extends MG {
  page = 0; found = false;
  override init() { this.page = 0; this.hint = 'Revisa las páginas y localiza la anotación manipulada.'; }
  override render(ctx: C) {
    const pages = DOC[this.theme] ?? DOC.ship;
    for (let i = 0; i < 3; i++) btn(ctx, 40, 70 + i * 90, 150, 70, `Pág. ${i + 1}`, i === this.page ? '#ff8a3d' : '#3d405b', i === this.page);
    paper(ctx, 220, 40, 460, 360, 0.01);
    const pg = pages[this.page];
    text(ctx, pg.title, 450, 76, 22, INK);
    pg.lines.forEach((l, i) => {
      const fake = this.page === this.puzzle.page && i === this.puzzle.line;
      const y = 120 + i * 52;
      if (fake) {
        text(ctx, l, 250, y, 17, '#4b3b8f', false, 'left');
        ctx.strokeStyle = 'rgba(75,59,143,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(248, y + 12); ctx.bezierCurveTo(350, y + 18, 450, y + 6, 560, y + 14); ctx.stroke();
        text(ctx, `→ ${this.puzzle.codeA ?? '??'}…`, 600, y, 15, '#4b3b8f');
      } else text(ctx, l, 250, y, 17, '#2b2d42', false, 'left');
    });
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 3; i++) if (inRect(x, y, 40, 70 + i * 90, 150, 70)) { this.page = i; this.sink.sfx('click'); return; }
    for (let i = 0; i < 5; i++) if (inRect(x, y, 230, 120 + i * 52 - 22, 440, 44)) {
      if (this.page === this.puzzle.page && i === this.puzzle.line) this.submit({ page: this.page, line: i });
      else { this.badFlash = 0.5; this.sink.sfx('bad'); }
    }
  }
}

// ------------------------------------------------------------ Registro de un escondite
export class KSearch extends MG {
  hold = new Hold(250, 310, 220, 60, 'REGISTRAR', '#a66cff');
  override init() { this.hold = new Hold(250, 310, 220, 60, 'REGISTRAR', '#a66cff'); this.hint = 'Mantén pulsado para registrar con discreción.'; }
  override render(ctx: C, dt: number) {
    rr(ctx, 160, 60, 400, 220, 14); fillStroke(ctx, vgrad(ctx, 60, 280, '#a0663b', '#6e4325'), INK, 4);
    const open = this.hold.p;
    ctx.save(); ctx.translate(360, 170); ctx.scale(1, 1 - open * 0.6);
    rr(ctx, -180, -90, 360, 180, 10); fillStroke(ctx, vgrad(ctx, -90, 90, '#b07a4a', '#8a5a33'), INK, 3);
    rr(ctx, -30, -10, 60, 20, 6); fillStroke(ctx, '#d9a441', INK, 2);
    ctx.restore();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ecae6', '#f4a261', '#b5838d'][i]; rr(ctx, 190 + i * 58, 230 - open * 60 + Math.sin(this.t * 6 + i) * open * 4, 44, 34, 6); ctx.fill(); }
    this.hold.draw(ctx);
    if (this.hold.tick(dt, (this.puzzle.hold ?? 2500) / 1000)) this.submit({ done: true });
  }
  override down(x: number, y: number) { this.hold.down(x, y); }
  override up() { this.hold.up(); }
}

// ------------------------------------------------------------ Compartimento técnico (llave + tapa)
export class KCompartment extends MG {
  key!: Drag; lid = 0; drag = false;
  override init() { this.key = new Drag(540, 320, 130, 50, null); this.lid = 0; this.hint = this.part === 0 ? 'Usa la llave en la cerradura.' : 'Levanta la tapa del compartimento.'; }
  override render(ctx: C) {
    rr(ctx, 120, 80, 380, 280, 12); fillStroke(ctx, vgrad(ctx, 80, 360, '#6c788a', '#3a4456'), INK, 4);
    if (this.part === 1) {
      ctx.save(); ctx.translate(310, 80); ctx.scale(1, Math.max(0.05, 1 - this.lid));
      rr(ctx, -190, 0, 380, 280, 12); fillStroke(ctx, vgrad(ctx, 0, 280, '#9aa5b1', '#6c788a'), INK, 3);
      ctx.restore();
      text(ctx, '⇡ arrastra hacia arriba', 310, 390, 18, '#fff', true);
    } else {
      ctx.beginPath(); ctx.arc(310, 220, 34, 0, Math.PI * 2); fillStroke(ctx, '#d9a441', INK, 3);
      rr(ctx, 304, 200, 12, 40, 4); ctx.fillStyle = INK; ctx.fill();
      const k = this.key; rr(ctx, k.x, k.y + 14, 80, 22, 8); fillStroke(ctx, '#ffd23f', INK, 3); ctx.beginPath(); ctx.arc(k.x + 102, k.y + 25, 24, 0, Math.PI * 2); fillStroke(ctx, '#ffd23f', INK, 3);
    }
  }
  override down(x: number, y: number) { if (this.part === 0 && this.key.hit(x, y)) this.key.start(x, y); if (this.part === 1) this.drag = true; }
  override move(x: number, y: number) { this.key.move(x, y); }
  override up() { this.drag = false; if (this.key.dragging) { this.key.dragging = false; if (Math.hypot(this.key.x - 300, this.key.cy() - 220) < 60) this.submit({ key: true }); else this.key.home(); } }
  override dragBy(_dx: number, dy: number) { if (this.drag && this.part === 1) { this.lid = Math.max(0, Math.min(1, this.lid - dy / 220)); if (this.lid >= 1) { this.drag = false; this.submit({ open: true }); } } }
}

// ------------------------------------------------------------ Teclado de combinación
export class KKeypad extends MG {
  code = '';
  override init() { this.code = ''; this.hint = 'Introduce la combinación de cuatro cifras reunida con las pistas.'; }
  private K() { const ks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']; return ks.map((k, i) => ({ k, x: 250 + (i % 3) * 80, y: 130 + Math.floor(i / 3) * 70 })); }
  override render(ctx: C) {
    screenBox(ctx, 250, 50, 220, 56, '#1d2b22');
    text(ctx, this.code.padEnd(4, '·'), 360, 78, 34, '#3ddc97');
    for (const b of this.K()) btn(ctx, b.x, b.y, 70, 58, b.k, b.k === 'OK' ? '#22a06b' : b.k === 'C' ? '#d93545' : '#3d405b');
  }
  override down(x: number, y: number) {
    for (const b of this.K()) {
      if (!inRect(x, y, b.x, b.y, 70, 58)) continue;
      this.sink.sfx('click');
      if (b.k === 'C') this.code = '';
      else if (b.k === 'OK') { if (this.code.length === 4) this.submit({ code: this.code }); }
      else if (this.code.length < 4) this.code += b.k;
    }
  }
}

// ------------------------------------------------------------ Autorización (puentes)
export class KAuth extends MG {
  links: (number | null)[] = [null, null, null]; drag: { from: number; x: number; y: number } | null = null;
  override init() { this.links = [null, null, null]; this.hint = 'Replica el esquema de puentes para engañar al control de acceso.'; }
  override render(ctx: C) {
    screenBox(ctx, 60, 50, 230, 160, '#1d1030');
    const pat = this.puzzle.pattern as number[];
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(90, 80 + i * 45); ctx.lineTo(260, 80 + pat[i] * 45); ctx.stroke(); ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(90, 80 + i * 45, 6, 0, Math.PI * 2); ctx.arc(260, 80 + pat[i] * 45, 6, 0, Math.PI * 2); ctx.fill(); }
    text(ctx, 'ESQUEMA', 175, 196, 14, '#c77dff');
    rr(ctx, 330, 60, 340, 320, 14); fillStroke(ctx, vgrad(ctx, 60, 380, '#2b2d42', '#1d1f2b'), INK, 3);
    const L = (i: number) => ({ x: 380, y: 120 + i * 100 }), R = (i: number) => ({ x: 620, y: 120 + i * 100 });
    for (let i = 0; i < 3; i++) { for (const p of [L(i), R(i)]) { ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); fillStroke(ctx, '#ffd23f', INK, 3); } }
    const wire = (a: { x: number; y: number }, b: { x: number; y: number }) => { ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + 100, a.y, b.x - 100, b.y, b.x, b.y); ctx.stroke(); ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 7; ctx.stroke(); };
    this.links.forEach((r, i) => { if (r !== null) wire(L(i), R(r)); });
    if (this.drag) wire(L(this.drag.from), { x: this.drag.x, y: this.drag.y });
  }
  override down(x: number, y: number) { for (let i = 0; i < 3; i++) if (Math.hypot(x - 380, y - (120 + i * 100)) < 34 && this.links[i] === null) this.drag = { from: i, x, y }; }
  override move(x: number, y: number) { if (this.drag) { this.drag.x = x; this.drag.y = y; } }
  override up(x: number, y: number) {
    if (!this.drag) return;
    for (let r = 0; r < 3; r++) if (Math.hypot(x - 620, y - (120 + r * 100)) < 40 && !this.links.includes(r)) { this.links[this.drag.from] = r; this.sink.sfx('click'); }
    this.drag = null;
    if (this.links.every((l) => l !== null)) {
      if (this.links.every((r, i) => r === this.puzzle.pattern[i])) this.submit({ map: this.links });
      else { this.badFlash = 1; this.sink.sfx('bad'); this.links = [null, null, null]; }
    }
  }
}
