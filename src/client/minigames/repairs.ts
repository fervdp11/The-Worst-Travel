import { fillStroke, led, rr, vgrad } from '../art/draw';
import { INK } from '../art/palette';
import { MG } from './base';
import { Drag, Hold, screenBox } from './common';
import { btn, C, dial, inRect, knob, lever, screwHead, slider, text, toggleSwitch, wheel } from './kit';

// ------------------------------------------------------------ Apagón: cuadro general
export class RepLights extends MG {
  s: boolean[] = []; hold!: Hold;
  override init() { this.s = [...this.puzzle.switches]; this.hold = new Hold(250, 320, 220, 60, 'REARMAR', '#ff8a3d'); this.hint = this.part === 0 ? 'Sube todos los interruptores del cuadro general.' : 'Mantén REARMAR mientras el cuadro se reinicia.'; }
  override render(ctx: C, dt: number) {
    rr(ctx, 70, 50, 580, 250, 14); fillStroke(ctx, vgrad(ctx, 50, 300, '#495057', '#2b2d42'), INK, 3);
    this.s.forEach((on, i) => toggleSwitch(ctx, 140 + i * 110, 180, this.part === 1 || on, `L${i + 1}`));
    if (this.part === 1) { this.hold.draw(ctx); if (this.hold.tick(dt, 2.1)) this.submit({ hold: true }); }
  }
  override down(x: number, y: number) {
    if (this.part === 1) { this.hold.down(x, y); return; }
    this.s.forEach((_, i) => { if (inRect(x, y, 140 + i * 110 - 30, 120, 60, 120)) { this.s[i] = !this.s[i]; this.sink.sfx('click'); } });
    if (this.s.every(Boolean)) this.submit({ states: this.s });
  }
  override up() { this.hold?.up(); }
}

// ------------------------------------------------------------ Comunicaciones: sintonía
export class RepComms extends MG {
  f = 0.05; drag = false; sync = 0;
  override init() { this.f = this.puzzle.target > 0.5 ? 0.05 : 0.95; this.sync = 0; this.hint = this.part === 0 ? 'Gira el dial hasta que tu onda coincida con la de la emisora.' : 'Sincronizando con la central…'; }
  override render(ctx: C, dt: number) {
    screenBox(ctx, 60, 50, 600, 180, '#0b1a12');
    const wave = (freq: number, color: string, amp: number) => { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 70; x <= 650; x += 4) { const y = 140 + Math.sin((x / 600) * Math.PI * 2 * (2 + freq * 8) + this.t * 3) * amp; if (x === 70) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); };
    wave(this.puzzle.target, 'rgba(255,210,63,0.75)', 50);
    wave(this.f, '#3ddc97', 50);
    text(ctx, `${(88 + this.f * 20).toFixed(1)} MHz`, 360, 70, 18, '#3ddc97');
    if (this.part === 0) {
      knob(ctx, 230, 330, 70, this.f * Math.PI * 4);
      btn(ctx, 420, 300, 200, 70, 'FIJAR', '#22a06b');
    } else {
      this.sync = Math.min(1, this.sync + dt / 2.6);
      rr(ctx, 160, 320, 400, 30, 15); fillStroke(ctx, '#11151f', INK, 3);
      rr(ctx, 162, 322, 396 * this.sync, 26, 13); ctx.fillStyle = '#3ddc97'; ctx.fill();
      text(ctx, 'SINCRONIZANDO…', 360, 380, 20, '#fff', true);
      if (this.sync >= 1) this.submit({ synced: true });
    }
  }
  override down(x: number, y: number) {
    if (this.part !== 0) return;
    if (inRect(x, y, 420, 300, 200, 70)) { if (Math.abs(this.f - this.puzzle.target) <= 0.03) this.submit({ freq: this.f }); else { this.badFlash = 1; this.sink.sfx('bad'); } return; }
    if (Math.hypot(x - 230, y - 330) < 90) this.drag = true;
  }
  override up() { this.drag = false; }
  override dragBy(dx: number, dy: number) { if (this.drag) this.f = Math.max(0, Math.min(1, this.f + (dx - dy) / 1400)); }
}

// ------------------------------------------------------------ Frenos: mecanismo (palancas en orden)
export class CritLevers extends MG {
  pulled: number[] = [];
  override init() { this.pulled = []; this.hint = 'Acciona las palancas en el orden que indican los pilotos numerados.'; }
  override render(ctx: C) {
    rr(ctx, 80, 50, 560, 330, 14); fillStroke(ctx, vgrad(ctx, 50, 380, '#c8323f', '#7f1621'), INK, 3);
    (this.puzzle.order as number[]).forEach((lv, k) => { led(ctx, 160 + lv * 130, 90, this.pulled.includes(lv) ? '#3ddc97' : '#ffd23f', 12); text(ctx, String(k + 1), 160 + lv * 130, 90, 14, INK); });
    for (let i = 0; i < 4; i++) lever(ctx, 160 + i * 130, 140, 170, this.pulled.includes(i) ? 0 : 1, '#ffd23f', `P${i + 1}`);
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      if (!inRect(x, y, 120 + i * 130, 120, 80, 220) || this.pulled.includes(i)) continue;
      if (this.puzzle.order[this.pulled.length] !== i) { this.badFlash = 1; this.sink.sfx('bad'); this.pulled = []; return; }
      this.pulled.push(i); this.sink.sfx('click');
      if (this.pulled.length === 4) this.submit({ order: this.pulled });
    }
  }
}

// ------------------------------------------------------------ Confirmación con llave
export class CritKeyConfirm extends MG {
  key!: Drag; turn = 0; inserted = false; hold!: Hold; drag = false;
  override init() { this.key = new Drag(520, 300, 120, 50, null); this.turn = 0; this.inserted = false; this.hold = new Hold(220, 300, 280, 66, 'CONFIRMAR', '#22a06b'); this.hint = this.part === 0 ? 'Introduce la llave y gírala.' : 'Mantén CONFIRMAR para validar desde el puesto.'; }
  override render(ctx: C, dt: number) {
    if (this.part === 0) {
      ctx.beginPath(); ctx.arc(260, 200, 90, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 110, 290, '#adb5bd', '#495057'), INK, 4);
      ctx.save(); ctx.translate(260, 200); ctx.rotate(this.turn * Math.PI / 2);
      rr(ctx, -10, -40, 20, 80, 8); fillStroke(ctx, '#1f2533', INK, 3);
      if (this.inserted) { rr(ctx, -14, -60, 28, 50, 8); fillStroke(ctx, '#ffd23f', INK, 3); }
      ctx.restore();
      text(ctx, 'OFF', 170, 200, 16, '#fff', true); text(ctx, 'ON', 260, 100, 16, '#3ddc97', true);
      if (!this.inserted) { const k = this.key; rr(ctx, k.x, k.y + 14, 70, 22, 8); fillStroke(ctx, '#ffd23f', INK, 3); ctx.beginPath(); ctx.arc(k.x + 92, k.y + 25, 24, 0, Math.PI * 2); fillStroke(ctx, '#ffd23f', INK, 3); }
      else text(ctx, 'Arrastra para girar ⤾', 470, 200, 18, '#fff', true);
    } else {
      screenBox(ctx, 160, 60, 400, 180, this.mat.screen);
      text(ctx, 'SISTEMA LISTO', 360, 120, 26, '#3ddc97');
      text(ctx, 'Confirma desde el puesto de mando', 360, 170, 18, '#a8b1c8');
      this.hold.draw(ctx);
      if (this.hold.tick(dt, 1.6)) this.submit({ hold: true });
    }
  }
  override down(x: number, y: number) { if (this.part === 1) { this.hold.down(x, y); return; } if (!this.inserted && this.key.hit(x, y)) this.key.start(x, y); else if (this.inserted) this.drag = true; }
  override move(x: number, y: number) { this.key.move(x, y); }
  override up() {
    this.hold?.up(); this.drag = false;
    if (this.key.dragging) { this.key.dragging = false; if (Math.hypot(this.key.cx() - 260, this.key.cy() - 200) < 80) { this.inserted = true; this.sink.sfx('click'); } else this.key.home(); }
  }
  override dragBy(dx: number, dy: number) { if (this.drag && this.inserted && this.part === 0) { this.turn = Math.max(0, Math.min(1, this.turn + (dx - dy) / 300)); if (this.turn >= 1) { this.drag = false; this.submit({ key: true }); } } }
}

// ------------------------------------------------------------ Refrigeración (válvulas a abrir)
export class CritCoolant extends MG {
  open: boolean[] = [];
  override init() { this.open = [false, false, false, false, false]; this.hint = 'Abre solo las válvulas marcadas con baja presión (ámbar) y purga.'; }
  override render(ctx: C) {
    ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(60, 200); ctx.lineTo(660, 200); ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = '#5cc8ff'; ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 120;
      const need = (this.puzzle.open as number[]).includes(i);
      ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x, 320); ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = this.open[i] ? '#5cc8ff' : '#495057'; ctx.stroke();
      led(ctx, x, 120, need ? '#ffbe0b' : '#3ddc97', 10);
      text(ctx, need ? 'BAJA' : 'OK', x, 92, 14, need ? '#ffd23f' : '#3ddc97', true);
      wheel(ctx, x, 200, 34, this.open[i] ? 1.2 : 0, this.open[i] ? '#3ddc97' : '#d64545');
    }
    btn(ctx, 260, 350, 200, 60, 'PURGAR', '#2a7fc0');
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 5; i++) if (Math.hypot(x - (120 + i * 120), y - 200) < 46) { this.open[i] = !this.open[i]; this.sink.sfx('click'); }
    if (inRect(x, y, 260, 350, 200, 60)) {
      const sel = this.open.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
      if (sel.join() === [...this.puzzle.open].sort().join()) this.submit({ open: sel }); else { this.badFlash = 1; this.sink.sfx('bad'); }
    }
  }
}

// ------------------------------------------------------------ Válvula de alivio (rueda a la banda)
export class CritRelief extends MG {
  v = 0; drag = false; stable = 0;
  override init() { this.v = 0; this.stable = 0; this.hint = 'Gira la rueda hasta la banda verde y mantenla un instante.'; }
  override render(ctx: C, dt: number) {
    wheel(ctx, 250, 225, 140, this.v * Math.PI * 5);
    dial(ctx, 540, 200, 110, this.v, this.puzzle.target - this.puzzle.tol, this.puzzle.target + this.puzzle.tol, 'ALIVIO');
    if (!this.drag && Math.abs(this.v - this.puzzle.target) <= this.puzzle.tol * 0.9) { this.stable += dt; if (this.stable > 0.7) this.submit({ angle: this.v }); } else this.stable = 0;
    text(ctx, '⤾ arrastra para girar', 250, 400, 18, '#fff', true);
  }
  override down(x: number, y: number) { if (Math.hypot(x - 250, y - 225) < 170) this.drag = true; }
  override up() { this.drag = false; }
  override dragBy(dx: number, dy: number) { if (this.drag) this.v = Math.max(0, Math.min(1, this.v + (dx - dy) / 1100)); }
}

// ------------------------------------------------------------ Vía de agua (parche + pernos)
export class CritPatch extends MG {
  patch!: Drag; bolts = [false, false, false, false];
  override init() { this.patch = new Drag(520, 300, 150, 110, null); this.bolts = [false, false, false, false]; this.hint = this.part === 0 ? 'Coloca el parche sobre la vía de agua.' : 'Aprieta los cuatro pernos del parche.'; }
  private lx() { return 100 + this.puzzle.leak[0] * 300; }
  private ly() { return 80 + this.puzzle.leak[1] * 260; }
  override render(ctx: C) {
    rr(ctx, 50, 50, 420, 340, 10); fillStroke(ctx, vgrad(ctx, 50, 390, '#6c788a', '#3a4456'), INK, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; for (let x = 90; x < 470; x += 60) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 390); ctx.stroke(); }
    if (this.part === 0) {
      for (let i = 0; i < 10; i++) { const k = ((this.t * 2 + i / 10) % 1); ctx.fillStyle = `rgba(150,210,255,${1 - k})`; ctx.beginPath(); ctx.arc(this.lx() + k * 120 + Math.sin(i) * 10, this.ly() + Math.sin(i * 3) * 20 * k, 8 * (1 - k) + 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(this.lx(), this.ly(), 18, 10, 0.3, 0, Math.PI * 2); ctx.fillStyle = '#0b0f18'; ctx.fill();
      const p = this.patch; rr(ctx, p.x, p.y, p.w, p.h, 10); fillStroke(ctx, vgrad(ctx, p.y, p.y + p.h, '#ffd23f', '#d4a017'), INK, 3);
    } else {
      rr(ctx, this.lx() - 75, this.ly() - 55, 150, 110, 10); fillStroke(ctx, vgrad(ctx, this.ly() - 55, this.ly() + 55, '#ffd23f', '#d4a017'), INK, 3);
      this.boltPos().forEach(([x, y], i) => screwHead(ctx, x, y, 14, this.bolts[i] ? 0.8 : 0));
    }
  }
  private boltPos() { return [[-55, -36], [55, -36], [-55, 36], [55, 36]].map(([dx, dy]) => [this.lx() + dx, this.ly() + dy]); }
  override down(x: number, y: number) {
    if (this.part === 0) { if (this.patch.hit(x, y)) this.patch.start(x, y); return; }
    this.boltPos().forEach(([bx, by], i) => { if (Math.hypot(x - bx, y - by) < 26 && !this.bolts[i]) { this.bolts[i] = true; this.sink.sfx('click'); } });
    if (this.bolts.every(Boolean)) this.submit({ bolts: 4 });
  }
  override move(x: number, y: number) { this.patch.move(x, y); }
  override up() { if (this.patch.dragging) { this.patch.dragging = false; if (Math.hypot(this.patch.cx() - this.lx(), this.patch.cy() - this.ly()) < 40) this.submit({ patched: true }); else this.patch.home(); } }
}

// ------------------------------------------------------------ Bombas (interruptores en orden + palanca)
export class CritPumps extends MG {
  on: number[] = []; lv = 1; drag = false;
  override init() { this.on = []; this.lv = 1; this.hint = 'Ceba las bombas en el orden indicado y baja la palanca de arranque.'; }
  override render(ctx: C) {
    (this.puzzle.order as number[]).forEach((p, k) => text(ctx, `${k + 1}º`, 140 + p * 130, 84, 18, '#ffd23f', true));
    for (let i = 0; i < 3; i++) toggleSwitch(ctx, 140 + i * 130, 200, this.on.includes(i), `BOMBA ${i + 1}`);
    lever(ctx, 590, 100, 220, this.lv, '#ff4d5e', 'ARRANQUE');
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 3; i++) if (inRect(x, y, 110 + i * 130, 140, 60, 120) && !this.on.includes(i)) {
      if (this.puzzle.order[this.on.length] !== i) { this.badFlash = 1; this.sink.sfx('bad'); this.on = []; return; }
      this.on.push(i); this.sink.sfx('click');
    }
    if (inRect(x, y, 550, 80, 80, 260) && this.on.length === 3) this.drag = true;
  }
  override up() { this.drag = false; }
  override dragBy(_dx: number, dy: number) { if (this.drag) { this.lv = Math.max(0, Math.min(1, this.lv - dy / 200)); if (this.lv <= 0) { this.drag = false; this.submit({ order: this.on, lever: true }); } } }
}

// ------------------------------------------------------------ Estabilizar propulsión (3 deslizadores)
export class CritStabilize extends MG {
  v: number[] = []; drag = -1;
  override init() { this.v = [...this.puzzle.start]; this.hint = 'Lleva los tres parámetros a sus bandas verdes y estabiliza.'; }
  override render(ctx: C) {
    ['TEMP.', 'RPM', 'ACEITE'].forEach((n, i) => {
      const y = 100 + i * 90;
      text(ctx, n, 90, y, 18, '#fff', true);
      slider(ctx, 150, y, 400, this.v[i], this.puzzle.bands[i][0], this.puzzle.bands[i][1], ['#ff8a3d', '#5cc8ff', '#ffd23f'][i]);
      const ok = this.v[i] >= this.puzzle.bands[i][0] && this.v[i] <= this.puzzle.bands[i][1];
      led(ctx, 600, y, ok ? '#3ddc97' : '#ff4d5e', 10);
    });
    btn(ctx, 260, 350, 200, 56, 'ESTABILIZAR', '#22a06b');
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 3; i++) if (inRect(x, y, 130, 70 + i * 90, 440, 60)) this.drag = i;
    if (inRect(x, y, 260, 350, 200, 56)) {
      if (this.v.every((v, i) => v >= this.puzzle.bands[i][0] && v <= this.puzzle.bands[i][1])) this.submit({ v: this.v }); else { this.badFlash = 1; this.sink.sfx('bad'); }
    }
  }
  override move(x: number) { if (this.drag >= 0) this.v[this.drag] = Math.max(0, Math.min(1, (x - 150) / 400)); }
  override up() { this.drag = -1; }
}

// ------------------------------------------------------------ Telégrafo de máquinas
const NOTCHES = ['ATRÁS', 'PARADA', 'POCA', 'MEDIA', 'AVANTE'];
export class CritTelegraph extends MG {
  a = 1; drag = false;
  override init() { this.a = 1; this.hint = `Lleva el telégrafo a «${NOTCHES[this.puzzle.notch]}» y confirma la orden.`; }
  private notchAt() { return Math.round(this.a); }
  override render(ctx: C) {
    ctx.beginPath(); ctx.arc(300, 280, 200, Math.PI, 0); ctx.closePath(); fillStroke(ctx, vgrad(ctx, 80, 280, '#d9a441', '#8a6a1f'), INK, 4);
    ctx.beginPath(); ctx.arc(300, 280, 170, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#f6f3ea', INK, 3);
    NOTCHES.forEach((n, i) => { const ang = Math.PI + 0.2 + (i / 4) * (Math.PI - 0.4); text(ctx, n, 300 + Math.cos(ang) * 118, 272 + Math.sin(ang) * 118, 15, i === this.puzzle.notch ? '#c8323f' : INK); });
    led(ctx, 300, 120, '#ff4d5e', 10);
    const ang = Math.PI + 0.2 + (this.a / 4) * (Math.PI - 0.4);
    ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(300, 280); ctx.lineTo(300 + Math.cos(ang) * 175, 280 + Math.sin(ang) * 175); ctx.stroke();
    ctx.lineWidth = 8; ctx.strokeStyle = '#495057'; ctx.stroke();
    ctx.beginPath(); ctx.arc(300 + Math.cos(ang) * 175, 280 + Math.sin(ang) * 175, 20, 0, Math.PI * 2); fillStroke(ctx, '#d64545', INK, 3);
    btn(ctx, 530, 300, 150, 70, 'CONFIRMAR', '#22a06b');
  }
  override down(x: number, y: number) {
    if (inRect(x, y, 530, 300, 150, 70)) { if (this.notchAt() === this.puzzle.notch) this.submit({ notch: this.notchAt(), confirm: true }); else { this.badFlash = 1; this.sink.sfx('bad'); } return; }
    this.drag = true;
  }
  override move(x: number, y: number) { if (!this.drag) return; const ang = Math.atan2(y - 280, x - 300); const k = Math.max(0, Math.min(1, (ang < 0 ? ang + Math.PI : ang > Math.PI / 2 ? Math.PI : 0) / Math.PI)); this.a = k * 4; }
  override up() { if (this.drag) { this.drag = false; this.a = this.notchAt(); this.sink.sfx('click'); } }
}

// ------------------------------------------------------------ Válvulas de descarga (cerrar todas)
export class CritValves extends MG {
  open: boolean[] = []; rot: number[] = [];
  override init() { this.open = [...this.puzzle.open]; this.rot = [0, 0, 0, 0]; this.hint = 'Cierra las cuatro válvulas de descarga (indicador en rojo = abierta).'; }
  override render(ctx: C, dt: number) {
    for (let i = 0; i < 4; i++) {
      const x = 130 + i * 155;
      if (!this.open[i]) this.rot[i] = Math.min(1, this.rot[i] + dt * 3);
      wheel(ctx, x, 210, 56, this.rot[i] * Math.PI * 2, this.open[i] ? '#d64545' : '#2a9d8f');
      led(ctx, x, 110, this.open[i] ? '#ff4d5e' : '#3ddc97', 10);
      text(ctx, this.open[i] ? 'ABIERTA' : 'CERRADA', x, 300, 16, this.open[i] ? '#ff4d5e' : '#3ddc97', true);
    }
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 4; i++) if (Math.hypot(x - (130 + i * 155), y - 210) < 70 && this.open[i]) { this.open[i] = false; this.sink.sfx('click'); }
    if (this.open.every((o) => !o)) this.submit({ open: this.open });
  }
}

// ------------------------------------------------------------ Sellado de puerta (indicadores + manilla)
export class CritSeal extends MG {
  checked: number[] = []; handle = 0; drag = false;
  override init() { this.checked = []; this.handle = 0; this.hint = this.part === 0 ? 'Pulsa los indicadores en rojo para recomprobar el sellado.' : 'Baja la manilla para bloquear la puerta.'; }
  private P(i: number) { const a = (i / 6) * Math.PI * 2; return { x: 300 + Math.cos(a) * 150, y: 220 + Math.sin(a) * 140 }; }
  override render(ctx: C) {
    rr(ctx, 170, 70, 260, 300, 50); fillStroke(ctx, vgrad(ctx, 70, 370, '#e3e9f1', '#c3cddb'), INK, 4);
    rr(ctx, 240, 110, 120, 70, 30); fillStroke(ctx, '#9fd3ea', INK, 3);
    for (let i = 0; i < 6; i++) { const p = this.P(i); const bad = (this.puzzle.bad as number[]).includes(i) && !this.checked.includes(i); led(ctx, p.x, p.y, bad ? '#ff4d5e' : '#3ddc97', 14); }
    if (this.part === 1) {
      ctx.save(); ctx.translate(560, 140); ctx.rotate(this.handle * 1.3);
      rr(ctx, -12, -12, 140, 26, 12); fillStroke(ctx, '#495057', INK, 3); ctx.restore();
      text(ctx, 'BLOQUEO ⤵', 600, 320, 18, '#fff', true);
    }
  }
  override down(x: number, y: number) {
    if (this.part === 1) { this.drag = true; return; }
    for (let i = 0; i < 6; i++) { const p = this.P(i); if (Math.hypot(x - p.x, y - p.y) < 30) { if ((this.puzzle.bad as number[]).includes(i)) { if (!this.checked.includes(i)) { this.checked.push(i); this.sink.sfx('click'); } } else { this.badFlash = 0.6; this.sink.sfx('bad'); } } }
    if (this.checked.length === this.puzzle.bad.length) this.submit({ checked: this.checked });
  }
  override up() { this.drag = false; }
  override dragBy(_dx: number, dy: number) { if (this.drag && this.part === 1) { this.handle = Math.max(0, Math.min(1, this.handle + dy / 200)); if (this.handle >= 1) { this.drag = false; this.submit({ locked: true }); } } }
}

// ------------------------------------------------------------ Distribución eléctrica de navegación
export class CritPower extends MG {
  s = [false, false, false, false];
  override init() { this.s = [false, false, false, false]; this.hint = 'Reproduce el esquema de distribución (arriba) con los interruptores y enruta la energía.'; }
  override render(ctx: C) {
    screenBox(ctx, 80, 50, 560, 120, '#0b1a2b');
    (this.puzzle.need as boolean[]).forEach((n, i) => { rr(ctx, 120 + i * 130, 80, 70, 60, 8); fillStroke(ctx, n ? 'rgba(61,220,151,0.5)' : 'rgba(255,255,255,0.08)', '#5cc8ff', 2); text(ctx, n ? 'ON' : 'OFF', 155 + i * 130, 110, 18, n ? '#3ddc97' : '#a8b1c8'); });
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(100, 260); ctx.lineTo(620, 260); ctx.stroke();
    for (let i = 0; i < 4; i++) toggleSwitch(ctx, 155 + i * 130, 290, this.s[i], `BUS ${String.fromCharCode(65 + i)}`);
    btn(ctx, 600, 360, 100, 50, 'ENRUTAR', '#22a06b');
  }
  override down(x: number, y: number) {
    for (let i = 0; i < 4; i++) if (inRect(x, y, 125 + i * 130, 230, 60, 120)) { this.s[i] = !this.s[i]; this.sink.sfx('click'); }
    if (inRect(x, y, 600, 360, 100, 50)) { if (this.s.every((v, i) => v === this.puzzle.need[i])) this.submit({ states: this.s }); else { this.badFlash = 1; this.sink.sfx('bad'); } }
  }
}

// ------------------------------------------------------------ Alineación de navegación (rumbo)
export class CritNavAlign extends MG {
  hd = 0; drag = false;
  override init() { this.hd = (this.puzzle.target + 180) % 360; this.hint = 'Gira el selector hasta alinear el rumbo con la consigna y confirma.'; }
  override render(ctx: C) {
    screenBox(ctx, 90, 50, 300, 300, '#0b1a2b');
    ctx.save(); ctx.translate(240, 200);
    ctx.strokeStyle = '#5cc8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2 - Math.PI / 2 - this.hd * Math.PI / 180; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 110, Math.sin(a) * 110); ctx.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); ctx.stroke(); }
    const ta = ((this.puzzle.target - this.hd) * Math.PI) / 180 - Math.PI / 2;
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ta) * 100, Math.sin(ta) * 100); ctx.stroke();
    ctx.strokeStyle = '#3ddc97'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -110); ctx.stroke();
    ctx.restore();
    text(ctx, `RUMBO ${Math.round(this.hd).toString().padStart(3, '0')}° · CONSIGNA ${String(this.puzzle.target).padStart(3, '0')}°`, 240, 380, 16, '#fff', true);
    knob(ctx, 560, 180, 80, (this.hd * Math.PI) / 180);
    btn(ctx, 480, 300, 170, 64, 'CONFIRMAR', '#22a06b');
  }
  override down(x: number, y: number) {
    if (inRect(x, y, 480, 300, 170, 64)) { const d = Math.abs(((this.hd - this.puzzle.target + 540) % 360) - 180); if (d <= 4) this.submit({ heading: Math.round(this.hd) }); else { this.badFlash = 1; this.sink.sfx('bad'); } return; }
    if (Math.hypot(x - 560, y - 180) < 100) this.drag = true;
  }
  override up() { this.drag = false; }
  override dragBy(dx: number, dy: number) { if (this.drag) this.hd = (this.hd + (dx - dy) * 0.4 + 360) % 360; }
}
