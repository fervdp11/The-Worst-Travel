import type { PropDef } from '../../shared/maps/types';
import { Ctx, fillStroke, gauge, hgrad, label, led, obliqueBox, rr, screen, screw, speckle, vgrad } from './draw';
import { INK, MapPalette, rgba, shade } from './palette';
import { PRODUCT_BY_ID, SECTIONS } from '../../shared/market';
import { drawProductIcon } from './products';

export const PROP_PAD = 4;

interface TechCfg {
  color?: 'metal' | 'dark' | 'light' | 'accent' | 'red' | 'wood';
  screens?: number;
  leds?: number;
  gauges?: number;
  buttons?: number;
  levers?: number;
  wheel?: boolean;
  text?: string;
  grill?: boolean;
  stripes?: boolean;
}

const TECH: Record<string, TechCfg> = {
  cabConsole: { color: 'dark', screens: 2, buttons: 10, levers: 2, leds: 3 },
  instrumentPanel: { color: 'dark', gauges: 4, leds: 4 },
  accessPanel: { color: 'metal', leds: 3, buttons: 4, text: 'ACCESO' },
  signalPanel: { color: 'dark', leds: 6, levers: 3 },
  tempGauge: { color: 'metal', gauges: 2 },
  brakeMechanism: { color: 'red', levers: 4, gauges: 1 },
  radiatorValve: { color: 'metal', wheel: true },
  valvePanel: { color: 'metal', wheel: true, gauges: 1 },
  brakeGauge: { color: 'metal', gauges: 2, leds: 1 },
  fuseBox: { color: 'metal', leds: 6, text: 'FUS' },
  wiringPanel: { color: 'metal', buttons: 6, leds: 2, grill: true },
  breakerPanel: { color: 'metal', levers: 5, leds: 2, stripes: true },
  junctionBox: { color: 'metal', leds: 2, stripes: true, text: '⚡' },
  commsTerminal: { color: 'dark', screens: 1, buttons: 6, leds: 2 },
  cableRack: { color: 'dark', leds: 8, grill: true },
  serverRack: { color: 'dark', leds: 10, grill: true },
  monitors: { color: 'dark', screens: 4, buttons: 4 },
  occupancyPanel: { color: 'dark', screens: 1, leds: 3 },
  accessControl: { color: 'metal', screens: 1, buttons: 6, leds: 3 },
  brakeValve: { color: 'red', wheel: true, text: 'FRENO' },
  radar: { color: 'dark', screens: 1, buttons: 6 },
  telegraph: { color: 'accent', levers: 1, gauges: 1 },
  helm: { color: 'wood', wheel: true, leds: 2 },
  cockpitPanel: { color: 'dark', screens: 3, buttons: 12, levers: 2, leds: 4 },
  overheadPanel: { color: 'dark', buttons: 12, leds: 6 },
  navDisplay: { color: 'dark', screens: 2, buttons: 4 },
  doorPanel: { color: 'light', leds: 3, buttons: 2 },
  powerPanel: { color: 'metal', levers: 4, leds: 4, stripes: true },
  avionicsRack: { color: 'dark', leds: 8, grill: true },
  navComputer: { color: 'dark', screens: 1, leds: 4 },
  outflowValves: { color: 'metal', wheel: true, gauges: 2 },
  pressurePanel: { color: 'light', screens: 1, gauges: 2, buttons: 4 },
  outflowControl: { color: 'metal', levers: 2, leds: 2 },
  controlStand: { color: 'dark', screens: 1, levers: 2, gauges: 1 },
  pumpPanel: { color: 'metal', buttons: 3, levers: 1, leds: 3 },
  ballastPanel: { color: 'dark', gauges: 2, buttons: 4, leds: 2 },
  seaValve: { color: 'red', wheel: true },
  radioDesk: { color: 'wood', screens: 1, gauges: 2, buttons: 6 },
  coolant: { color: 'metal', gauges: 2, grill: true },
  pressureUnit: { color: 'light', gauges: 2 },
};

function techColor(pal: MapPalette, c?: TechCfg['color']): [string, string] {
  switch (c) {
    case 'dark': return [shade(pal.metalDark, -0.15), shade(pal.metalDark, -0.3)];
    case 'light': return [shade(pal.metal, 0.35), shade(pal.metal, 0.15)];
    case 'accent': return [pal.accent, shade(pal.accent, -0.2)];
    case 'red': return ['#c8323f', '#9e2531'];
    case 'wood': return [pal.wood, pal.woodDark];
    default: return [shade(pal.metal, 0.1), pal.metal];
  }
}

function drawTech(ctx: Ctx, w: number, d: number, h: number, pal: MapPalette, cfg: TechCfg) {
  const [top, front] = techColor(pal, cfg.color);
  obliqueBox(ctx, w, d, h, top, front, 4);
  const onTop = d >= h * 0.8;
  // Región de detalles
  const rx = 6, ry = onTop ? 6 : d + 5, rw = w - 12, rh = onTop ? d - 12 : h - 10;
  if (rw < 6 || rh < 6) return;
  let cursorX = rx;
  const rowY = ry + rh / 2;
  const screens = cfg.screens ?? 0;
  for (let i = 0; i < screens; i++) {
    const sw = Math.min(rw / Math.max(1, screens) - 4, rh * 1.6);
    screen(ctx, cursorX, ry + 1, sw, Math.min(rh - 2, sw * 0.7), i % 2 ? '#5cc8ff' : '#2de2a6');
    cursorX += sw + 4;
  }
  const gauges = cfg.gauges ?? 0;
  for (let i = 0; i < gauges; i++) {
    const r = Math.min(rh * 0.42, 9);
    if (cursorX + r * 2 > rx + rw) break;
    gauge(ctx, cursorX + r, rowY, r, 0.3 + ((i * 0.37) % 0.6));
    cursorX += r * 2 + 4;
  }
  if (cfg.wheel) {
    const r = Math.min(rh * 0.45, 12);
    const cx = Math.min(cursorX + r + 2, rx + rw - r), cy = rowY;
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d64545'; ctx.lineWidth = 2; ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); fillStroke(ctx, '#aeb6c4', INK, 1);
    cursorX = cx + r + 4;
  }
  const levers = cfg.levers ?? 0;
  for (let i = 0; i < levers; i++) {
    const lx = cursorX + 4 + i * 8;
    if (lx > rx + rw - 2) break;
    ctx.fillStyle = '#1f2533'; ctx.fillRect(lx - 1.5, ry + rh * 0.3, 3, rh * 0.6);
    ctx.beginPath(); ctx.arc(lx, ry + rh * (i % 2 ? 0.3 : 0.55), 3, 0, Math.PI * 2);
    fillStroke(ctx, i % 2 ? '#ff4d5e' : '#ffd23f', INK, 1);
  }
  if (levers) cursorX += levers * 8 + 6;
  const buttons = cfg.buttons ?? 0;
  const cols = Math.max(1, Math.floor((rx + rw - cursorX) / 7));
  for (let i = 0; i < buttons && cols > 0; i++) {
    const bx = cursorX + (i % cols) * 7 + 3, by = ry + 3 + Math.floor(i / cols) * 7;
    if (by > ry + rh - 2) break;
    rr(ctx, bx - 2.5, by - 2.5, 5, 5, 1.2);
    fillStroke(ctx, ['#ffd23f', '#5cc8ff', '#ff8a3d', '#3ddc97'][i % 4], INK, 0.8);
  }
  const leds = cfg.leds ?? 0;
  for (let i = 0; i < leds; i++) {
    const lx = rx + 3 + i * 6;
    if (lx > rx + rw - 2) break;
    led(ctx, lx, onTop ? ry + rh - 2 : ry + 1, ['#3ddc97', '#ffd23f', '#ff4d5e', '#5cc8ff'][i % 4], 1.6);
  }
  if (cfg.grill) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let yy = ry + rh * 0.55; yy < ry + rh; yy += 3) { ctx.beginPath(); ctx.moveTo(rx + rw * 0.45, yy); ctx.lineTo(rx + rw, yy); ctx.stroke(); }
  }
  if (cfg.stripes) {
    ctx.save(); rr(ctx, rx, ry + rh - 5, rw, 5, 1); ctx.clip();
    for (let xx = rx - 10; xx < rx + rw; xx += 8) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(xx, ry + rh); ctx.lineTo(xx + 4, ry + rh - 5); ctx.lineTo(xx + 8, ry + rh - 5); ctx.lineTo(xx + 4, ry + rh); ctx.fill(); }
    ctx.restore();
  }
  if (cfg.text) label(ctx, cfg.text, w - 14, onTop ? d - 6 : d + h - 7, 7, 'rgba(255,255,255,0.8)');
  screw(ctx, 4, onTop ? 4 : d + 4, 1.4); screw(ctx, w - 4, onTop ? 4 : d + 4, 1.4);
}

function seat(ctx: Ctx, w: number, d: number, h: number, fabric: string, flip: boolean, rows = 1) {
  // Asiento acolchado visto desde arriba-frente, respaldo hacia la izquierda (marcha) o derecha.
  const seatH = 14;
  const each = d / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * each;
    ctx.save();
    // base
    rr(ctx, 4, y0 + h - seatH + 6, w - 6, each - 4, 5);
    fillStroke(ctx, vgrad(ctx, y0, y0 + each + h, shade(fabric, 0.1), shade(fabric, -0.2)), INK, 1.8);
    // cojín
    rr(ctx, flip ? 4 : 10, y0 + h - seatH + 8, w - 16, each - 9, 5);
    fillStroke(ctx, shade(fabric, 0.18), INK, 1.2);
    // respaldo alto
    const bx = flip ? w - 12 : 2;
    rr(ctx, bx, y0 + 2, 10, each + h - seatH + 4, 4);
    fillStroke(ctx, vgrad(ctx, y0, y0 + h, shade(fabric, 0.2), shade(fabric, -0.15)), INK, 1.8);
    // reposacabezas
    rr(ctx, bx + 1, y0 + 2, 8, 10, 3);
    fillStroke(ctx, '#f1ede4', INK, 1);
    ctx.restore();
  }
}

function table(ctx: Ctx, w: number, d: number, h: number, top: string, legs: string, round = false) {
  // patas
  ctx.fillStyle = legs;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (const lx of [8, w - 12]) { rr(ctx, lx, d * 0.6, 4, h + d * 0.4 - 2, 1); ctx.fill(); ctx.stroke(); }
  if (round) { ctx.beginPath(); ctx.ellipse(w / 2, d / 2 + 2, w / 2 - 2, d / 2 - 1, 0, 0, Math.PI * 2); fillStroke(ctx, shade(top, -0.25), INK, 2); ctx.beginPath(); ctx.ellipse(w / 2, d / 2, w / 2 - 2, d / 2 - 2, 0, 0, Math.PI * 2); fillStroke(ctx, vgrad(ctx, 0, d, shade(top, 0.15), top), INK, 2); }
  else { obliqueBox(ctx, w, d, 7, top, shade(top, -0.2), 4); }
}

function crockery(ctx: Ctx, x: number, y: number, s = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, 7 * s, 4.5 * s, 0, 0, Math.PI * 2); fillStroke(ctx, '#f8f6f0', INK, 1);
  ctx.beginPath(); ctx.ellipse(x, y, 4 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fillStyle = '#e07a5f'; ctx.fill();
}

function locker(ctx: Ctx, w: number, d: number, h: number, color: string) {
  obliqueBox(ctx, w, d, h, shade(color, 0.1), color, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let yy = d + 6; yy < d + 18; yy += 3) { ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(w - 8, yy); ctx.stroke(); }
  rr(ctx, w - 10, d + h * 0.5, 4, 10, 1.5); fillStroke(ctx, '#d9d9d9', INK, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(3, d + 2, 3, h - 6);
}

function shelf(ctx: Ctx, w: number, d: number, h: number, pal: MapPalette, items: 'boxes' | 'jars' | 'bags' | 'books') {
  obliqueBox(ctx, w, d, h, pal.woodDark, pal.wood, 2);
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const yy = d + 4 + r * ((h - 6) / rows);
    ctx.fillStyle = shade(pal.woodDark, -0.2); ctx.fillRect(3, yy + (h - 6) / rows - 3, w - 6, 3);
    for (let x = 6; x < w - 8; x += 10) {
      const c = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ecae6', '#f4a261', '#b5838d'][(x + r * 3) % 6];
      if (items === 'jars') { rr(ctx, x, yy + 2, 7, (h - 6) / rows - 6, 2); fillStroke(ctx, rgba(c, 0.85), INK, 0.8); }
      else if (items === 'books') { ctx.fillStyle = c; ctx.fillRect(x, yy + 1, 4 + (x % 3), (h - 6) / rows - 4); }
      else { rr(ctx, x, yy + 3, 8, (h - 6) / rows - 6, 1); fillStroke(ctx, items === 'bags' ? shade(c, -0.2) : '#c8a574', INK, 0.8); }
    }
  }
}

function suitcase(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  rr(ctx, x, y, w, h, 3); fillStroke(ctx, vgrad(ctx, y, y + h, shade(c, 0.15), shade(c, -0.15)), INK, 1.4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + w * 0.3, y + 1, 2, h - 2); ctx.fillRect(x + w * 0.65, y + 1, 2, h - 2);
  rr(ctx, x + w / 2 - 4, y - 3, 8, 4, 1.5); fillStroke(ctx, '#3b3f4a', INK, 1);
}

function stairs(ctx: Ctx, w: number, d: number, h: number, pal: MapPalette, up: boolean) {
  if (up) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const sy = (i / steps) * (d + h), sh = (d + h) / steps + 1;
      rr(ctx, 2, sy, w - 4, sh, 1);
      fillStroke(ctx, vgrad(ctx, sy, sy + sh, shade(pal.metal, 0.25 - i * 0.04), shade(pal.metal, 0.05 - i * 0.04)), INK, 1.2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(4, sy + sh - 3, w - 8, 1.5);
    }
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 3, d + h); ctx.fillRect(w - 3, 0, 3, d + h);
  } else {
    rr(ctx, 0, h, w, d, 3);
    fillStroke(ctx, '#20232c', INK, 2);
    for (let i = 0; i < 5; i++) {
      const sy = h + 4 + i * (d - 8) / 5;
      ctx.fillStyle = shade(pal.metal, -0.1 - i * 0.12);
      ctx.fillRect(4, sy, w - 8, (d - 8) / 5 - 1);
    }
    const g = ctx.createLinearGradient(0, h, 0, h + d);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(2, h, w - 4, d);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect(1, h + 1, w - 2, d - 2);
  }
}

/** Dibuja un objeto del plano en un lienzo local: (0,0) = esquina superior izquierda del sprite. */
export function drawProp(ctx: Ctx, p: PropDef, pal: MapPalette, mapId: string) {
  const w = p.rect.w, d = p.rect.h, h = p.h;
  const k = p.kind;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (TECH[k]) { drawTech(ctx, w, d, h, pal, TECH[k]); return; }
  switch (k) {
    case 'emergencyButton': {
      obliqueBox(ctx, w, d, h, '#f4f1e8', '#d9d2c3', 4);
      ctx.beginPath(); ctx.arc(w / 2, d + h * 0.5, Math.min(w, h) * 0.3, 0, Math.PI * 2);
      fillStroke(ctx, '#e63946', INK, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(w / 2 - 3, d + h * 0.5 - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.save(); rr(ctx, 2, d + h - 7, w - 4, 5, 1); ctx.clip();
      for (let x = -6; x < w; x += 6) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, d + h - 7, 3, 5); ctx.fillStyle = INK; ctx.fillRect(x + 3, d + h - 7, 3, 5); }
      ctx.restore();
      return;
    }
    case 'pilotSeat': case 'chair': case 'jumpSeat':
      seat(ctx, w, d, h, k === 'pilotSeat' ? '#3b3f4a' : pal.fabric, false); return;
    case 'seat': seat(ctx, w, d, h, pal.fabric, !!p.flip); return;
    case 'seatRow': seat(ctx, w, d, h, pal.fabric, false, p.variant ?? 2); return;
    case 'armchairSet': {
      seat(ctx, 34, d, h, pal.fabricAlt, false);
      ctx.save(); ctx.translate(w - 34, 0); seat(ctx, 34, d, h, pal.fabricAlt, true); ctx.restore();
      ctx.save(); ctx.translate(36, h - 4); table(ctx, w - 72, d - 16, 18, pal.wood, pal.woodDark); ctx.restore();
      crockery(ctx, w / 2, h + 4, 0.8);
      return;
    }
    case 'bench': case 'sofa': {
      const c = k === 'sofa' ? pal.fabricAlt : pal.wood;
      obliqueBox(ctx, w, d, h, shade(c, 0.1), shade(c, -0.1), 6);
      if (w > d) for (let x = 8; x < w - 8; x += 18) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, 4, 2, d - 8); }
      return;
    }
    case 'deckChair': {
      rr(ctx, 4, h * 0.4, w - 8, d + h * 0.5, 6); fillStroke(ctx, '#f4f1e8', INK, 1.8);
      ctx.fillStyle = pal.fabricAlt; for (let y = h * 0.4 + 6; y < d + h; y += 12) ctx.fillRect(6, y, w - 12, 6);
      rr(ctx, 4, 0, w - 8, h * 0.6, 6); fillStroke(ctx, '#e9e2cf', INK, 1.8);
      return;
    }
    case 'bed': case 'crewBunk': case 'medBed': {
      obliqueBox(ctx, w, d, h, '#f4f1e8', pal.woodDark, 5);
      rr(ctx, 4, 4, w * 0.25, d - 8, 4); fillStroke(ctx, '#ffffff', INK, 1.2);
      rr(ctx, w * 0.35, 3, w * 0.62, d - 6, 4); fillStroke(ctx, k === 'medBed' ? '#a8dadc' : ['#e07a5f', '#81b29a', '#3d405b', '#f2cc8f', '#9d4edd'][(p.variant ?? 0) % 5], INK, 1.2);
      return;
    }
    case 'diningSet': {
      obliqueBox(ctx, 22, d, h - 6, pal.fabricAlt, shade(pal.fabricAlt, -0.25), 4);
      ctx.save(); ctx.translate(w - 22, 0); obliqueBox(ctx, 22, d, h - 6, pal.fabricAlt, shade(pal.fabricAlt, -0.25), 4); ctx.restore();
      ctx.save(); ctx.translate(26, 2); table(ctx, w - 52, d - 6, h - 4, '#f4ece0', pal.woodDark); ctx.restore();
      crockery(ctx, 48, 12); crockery(ctx, w - 48, 14);
      rr(ctx, w / 2 - 3, 4, 6, 12, 2); fillStroke(ctx, '#8ecae6', INK, 1);
      return;
    }
    case 'roundTable': table(ctx, w, d, h, '#f4ece0', pal.woodDark, true); crockery(ctx, w / 2 - 10, d / 2); crockery(ctx, w / 2 + 12, d / 2 + 2); return;
    case 'meetingTable': {
      table(ctx, w, d, h, pal.wood, pal.woodDark);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 8, 6, w - 16, d - 12, 6); ctx.fill();
      for (let x = 16; x < w - 10; x += 34) { rr(ctx, x, 8, 14, 10, 2); fillStroke(ctx, '#f8f6f0', INK, 0.8); }
      return;
    }
    case 'counter': case 'barCounter': case 'receptionDesk': case 'deskDrawer': case 'routeDesk': case 'chartTable': case 'workbench': case 'minibar': case 'cafeKiosk': {
      const topC = k === 'barCounter' || k === 'receptionDesk' || k === 'minibar' || k === 'cafeKiosk' ? pal.woodDark : k === 'workbench' ? '#7c6f64' : '#e8e3d8';
      const frontC = k === 'counter' ? '#c9ced8' : pal.wood;
      obliqueBox(ctx, w, d, h, topC, frontC, 4);
      if (k === 'receptionDesk' || k === 'cafeKiosk') { label(ctx, k === 'cafeKiosk' ? 'CAFÉ' : 'RECEPCIÓN', w / 2, d + h / 2, 9, pal.accent); screen(ctx, w - 40, 4, 26, 16); }
      if (k === 'barCounter') for (let y = 10; y < d - 8; y += 24) { rr(ctx, 8, y, 10, 14, 3); fillStroke(ctx, rgba('#8ecae6', 0.8), INK, 1); }
      if (k === 'routeDesk' || k === 'chartTable') { ctx.fillStyle = '#f4f1e8'; ctx.save(); ctx.translate(w / 2, d / 2); ctx.rotate(-0.15); ctx.fillRect(-w * 0.3, -d * 0.3, w * 0.6, d * 0.6); ctx.restore(); ctx.strokeStyle = '#457b9d'; ctx.beginPath(); ctx.moveTo(w * 0.3, d * 0.4); ctx.lineTo(w * 0.7, d * 0.6); ctx.stroke(); }
      if (k === 'workbench') { ctx.fillStyle = '#adb5bd'; ctx.fillRect(10, 8, 30, 4); ctx.fillRect(50, 10, 18, 3); }
      if (k === 'deskDrawer' || k === 'minibar') { for (let x = 6; x < w - 14; x += 22) { rr(ctx, x, d + 5, 18, h - 12, 2); fillStroke(ctx, shade(frontC, 0.1), INK, 1); ctx.fillStyle = '#e8c15a'; ctx.fillRect(x + 7, d + h / 2, 4, 2); } }
      if (k === 'cafeKiosk') { ctx.save(); ctx.translate(20, -6); ctx.restore(); }
      return;
    }
    case 'stove': {
      obliqueBox(ctx, w, d, h, '#2b2d42', '#c9ced8', 4);
      for (const [x, y] of [[w * 0.3, d * 0.35], [w * 0.7, d * 0.35], [w * 0.3, d * 0.72], [w * 0.7, d * 0.72]]) {
        ctx.beginPath(); ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2); ctx.strokeStyle = '#ff7b00'; ctx.lineWidth = 2; ctx.stroke();
      }
      rr(ctx, w * 0.2, d * 0.15, 16, 10, 3); fillStroke(ctx, '#adb5bd', INK, 1);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(10 + i * (w - 20) / 3, d + h * 0.4, 2.5, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 0.8); }
      return;
    }
    case 'sink': case 'washbasin': {
      obliqueBox(ctx, w, d, h, '#e8edf2', '#c9ced8', 4);
      rr(ctx, 6, 5, w - 12, d - 10, 6); fillStroke(ctx, vgrad(ctx, 5, d, '#a7b3c0', '#d7dee6'), INK, 1.4);
      ctx.fillStyle = 'rgba(120,190,255,0.5)'; rr(ctx, 9, d / 2, w - 18, d / 2 - 8, 4); ctx.fill();
      rr(ctx, w / 2 - 2, 1, 4, 8, 1.5); fillStroke(ctx, '#aeb6c4', INK, 1);
      return;
    }
    case 'passWindow': case 'trayRack': case 'galleyUnit': {
      obliqueBox(ctx, w, d, h, '#d9dee5', '#b6bfcb', 3);
      for (let x = 6; x < w - 10; x += 16) { rr(ctx, x, d + 4, 12, h - 10, 2); fillStroke(ctx, '#e9eef5', INK, 1); ctx.fillStyle = '#5c677d'; ctx.fillRect(x + 4, d + h / 2 - 1, 4, 2); }
      if (k === 'passWindow') { crockery(ctx, w * 0.3, d * 0.5, 0.9); crockery(ctx, w * 0.65, d * 0.5, 0.9); }
      return;
    }
    case 'fridge': obliqueBox(ctx, w, d, h, '#f1f3f5', '#dee2e6', 5); rr(ctx, w - 10, d + 8, 4, h * 0.4, 2); fillStroke(ctx, '#adb5bd', INK, 1); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(3, d + h * 0.35, w - 6, 2); return;
    case 'coffeeMachine': {
      obliqueBox(ctx, w, d, h, '#2b2d42', '#3d405b', 4);
      screen(ctx, 6, d + 4, w * 0.4, 9, '#ffd23f');
      rr(ctx, w * 0.55, d + 6, w * 0.3, h - 14, 2); fillStroke(ctx, '#161925', INK, 1);
      ctx.beginPath(); ctx.ellipse(w * 0.7, d + h - 8, 5, 3, 0, 0, Math.PI * 2); fillStroke(ctx, '#f8f6f0', INK, 1);
      return;
    }
    case 'knifeDrawer': case 'toolChest': case 'crewBinder': case 'crewLog': case 'barBox': case 'deckBox': {
      const c = k === 'toolChest' ? '#c8323f' : k === 'deckBox' ? pal.wood : k === 'barBox' ? '#3d405b' : pal.wood;
      obliqueBox(ctx, w, d, h, shade(c, 0.12), c, 4);
      for (let x = 6; x < w - 12; x += 26) { rr(ctx, x, d + 5, 22, h - 11, 2); fillStroke(ctx, shade(c, 0.08), INK, 1); ctx.fillStyle = '#e8c15a'; ctx.fillRect(x + 9, d + h / 2 - 1, 5, 2.5); }
      if (k === 'crewBinder' || k === 'crewLog') { rr(ctx, 8, 4, w - 16, d - 8, 2); fillStroke(ctx, '#1d3557', INK, 1); ctx.fillStyle = '#f1faee'; ctx.fillRect(12, 8, w - 26, d - 16); }
      return;
    }
    case 'locker': case 'cleanLocker': case 'wardrobe': case 'medCabinet':
      locker(ctx, w, d, h, k === 'cleanLocker' ? '#2a9d8f' : k === 'wardrobe' ? pal.wood : k === 'medCabinet' ? '#f1f3f5' : ['#5c677d', '#4a6fa5', '#6b705c', '#7d5ba6', '#5c677d'][(p.variant ?? 0) % 5]);
      if (k === 'medCabinet') { ctx.fillStyle = '#e63946'; ctx.fillRect(w / 2 - 6, d + h / 2 - 2, 12, 4); ctx.fillRect(w / 2 - 2, d + h / 2 - 6, 4, 12); }
      return;
    case 'shelf': shelf(ctx, w, d, h, pal, mapId === 'ship' ? 'jars' : 'jars'); return;
    case 'bookShelf': shelf(ctx, w, d, h, pal, 'books'); return;
    case 'luggageShelf': case 'luggageRack': shelf(ctx, w, d, h, pal, 'bags'); return;
    case 'barShelf': return;
    case 'luggage': case 'suitcase': {
      suitcase(ctx, 2, h * 0.3 + 2, w * 0.55, d + h * 0.6, '#e76f51');
      suitcase(ctx, w * 0.45, h * 0.1 + 4, w * 0.5, d + h * 0.8 - 4, '#457b9d');
      return;
    }
    case 'crate': case 'container': case 'uld': {
      const c = k === 'uld' ? '#c0c8d4' : k === 'container' ? ['#e76f51', '#2a9d8f', '#e9c46a'][(p.variant ?? 0) % 3] : '#c8a574';
      obliqueBox(ctx, w, d, h, shade(c, 0.15), c, k === 'uld' ? 6 : 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
      if (k === 'crate') { ctx.beginPath(); ctx.moveTo(4, d + 4); ctx.lineTo(w - 4, d + h - 4); ctx.moveTo(w - 4, d + 4); ctx.lineTo(4, d + h - 4); ctx.stroke(); }
      else for (let x = 8; x < w - 4; x += 8) { ctx.beginPath(); ctx.moveTo(x, d + 3); ctx.lineTo(x, d + h - 3); ctx.stroke(); }
      if (k === 'uld') label(ctx, `AKE${120 + (p.variant ?? 0)}`, w / 2, d + h / 2, 9, '#2f6fb3');
      return;
    }
    case 'cargoNet': ctx.strokeStyle = '#6b705c'; ctx.lineWidth = 2; for (let x = 0; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 10, d + h); ctx.moveTo(x + 10, h); ctx.lineTo(x, d + h); ctx.stroke(); } suitcase(ctx, 10, h - 10, 40, 30, '#9d4edd'); suitcase(ctx, 60, h - 6, 36, 28, '#e9c46a'); suitcase(ctx, 104, h - 12, 40, 34, '#2a9d8f'); return;
    case 'truck': {
      obliqueBox(ctx, w * 0.7, d, h, '#e9eef5', '#ced4da', 6);
      ctx.save(); ctx.translate(w * 0.72, 10); obliqueBox(ctx, w * 0.28, d - 10, h - 10, '#e63946', '#b51d2a', 6); ctx.restore();
      screen(ctx, w * 0.78, h + 8, w * 0.16, 14, '#8ecae6');
      for (const x of [w * 0.15, w * 0.55, w * 0.85]) { ctx.beginPath(); ctx.arc(x, d + h, 9, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 2); }
      label(ctx, 'TRANSPORTES DEL SUR', w * 0.35, d + h / 2, 10, '#457b9d');
      return;
    }
    case 'conveyor': {
      obliqueBox(ctx, w, d, h, '#3d405b', '#2b2d42', 3);
      ctx.strokeStyle = '#6c757d'; ctx.lineWidth = 2; for (let x = 6; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, d - 4); ctx.stroke(); }
      suitcase(ctx, 20, 6, 30, d - 14, '#e76f51'); suitcase(ctx, 110, 8, 28, d - 16, '#2a9d8f');
      return;
    }
    case 'engine': case 'generator': case 'airPack': case 'bilgePump': case 'pump': {
      const c = k === 'engine' ? '#4f5d75' : k === 'generator' ? '#d4a017' : k === 'bilgePump' ? '#1d7874' : k === 'airPack' ? '#8d99ae' : '#3a86ff';
      obliqueBox(ctx, w, d, h, shade(c, 0.15), c, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 10; x < w - 10; x += 14) { rr(ctx, x, 5, 8, d - 10, 3); ctx.fill(); }
      for (let x = 8; x < w - 8; x += 20) { screw(ctx, x, d + h - 6, 1.6); }
      if (k === 'engine') { gauge(ctx, w - 18, d + h / 2, 8, 0.7); ctx.fillStyle = '#ffd23f'; ctx.fillRect(8, d + h - 12, w * 0.4, 4); }
      speckle(ctx, 2, d, w - 4, h, 30, 'rgba(0,0,0,0.12)', w);
      return;
    }
    case 'tank': case 'coolantTank': obliqueBox(ctx, w, d, h, '#8ecae6', '#219ebc', d / 2); gauge(ctx, w / 2, d + h / 2, 10, 0.4); return;
    case 'pipes': case 'steamPipe': {
      ctx.lineWidth = 6; ctx.strokeStyle = INK;
      for (let i = 0; i < Math.max(1, Math.floor(w / 18)); i++) { const x = 6 + i * 18; ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, d + h - 2); ctx.stroke(); }
      ctx.lineWidth = 4; ctx.strokeStyle = '#b08968';
      for (let i = 0; i < Math.max(1, Math.floor(w / 18)); i++) { const x = 6 + i * 18; ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, d + h - 2); ctx.stroke(); }
      return;
    }
    case 'watertightDoor': {
      rr(ctx, 4, 0, w - 8, d + h, 14); fillStroke(ctx, vgrad(ctx, 0, d + h, '#9aa5b1', '#6c788a'), INK, 2.5);
      ctx.beginPath(); ctx.arc(w / 2, (d + h) / 2, 10, 0, Math.PI * 2); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; screw(ctx, w / 2 + Math.cos(a) * ((w - 14) / 2), (d + h) / 2 + Math.sin(a) * ((d + h - 10) / 2), 2); }
      return;
    }
    case 'hullPatch': rr(ctx, 0, h, w, d, 3); fillStroke(ctx, 'rgba(30,60,90,0.6)', INK, 1.5); ctx.fillStyle = 'rgba(150,210,255,0.5)'; ctx.beginPath(); ctx.ellipse(w / 2, h + d / 2, w * 0.25, d * 0.3, 0, 0, Math.PI * 2); ctx.fill(); return;
    case 'brakeWheel': {
      obliqueBox(ctx, w, d, h * 0.4, pal.metal, pal.metalDark, 3);
      ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.4, w * 0.48, 10, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d64545'; ctx.lineWidth = 2.2; ctx.stroke();
      return;
    }
    case 'toilet': {
      rr(ctx, w * 0.15, 0, w * 0.7, h * 0.6, 4); fillStroke(ctx, '#f8f9fa', INK, 1.6);
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6 + d * 0.5, w * 0.45, d * 0.48, 0, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', INK, 1.6);
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6 + d * 0.5, w * 0.28, d * 0.28, 0, 0, Math.PI * 2); ctx.fillStyle = '#a9d6e5'; ctx.fill();
      return;
    }
    case 'plant': {
      obliqueBox(ctx, w, w * 0.5, h * 0.3, '#b5651d', '#8b4513', 6);
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.4; ctx.beginPath(); ctx.ellipse(w / 2 + Math.cos(a) * 9, h * 0.25 + Math.sin(a) * 12, 5, 11, a + Math.PI / 2, 0, Math.PI * 2); fillStroke(ctx, i % 2 ? '#2d6a4f' : '#40916c', INK, 1.2); }
      return;
    }
    case 'trash': obliqueBox(ctx, w, d, h, '#495057', '#6c757d', w / 2); return;
    case 'extinguisher': rr(ctx, 3, 4, w - 6, d + h - 4, 5); fillStroke(ctx, vgrad(ctx, 0, d + h, '#ff4d5e', '#b51d2a'), INK, 1.6); ctx.fillStyle = '#2b2d42'; ctx.fillRect(w / 2 - 2, 0, 4, 6); ctx.fillStyle = '#fff'; ctx.fillRect(4, d + h * 0.4, w - 8, 5); return;
    case 'lifeVests': for (let x = 2; x < w - 12; x += 16) { rr(ctx, x, 2, 14, d + h - 4, 5); fillStroke(ctx, '#ff7b00', INK, 1.4); ctx.fillStyle = '#f8f9fa'; ctx.fillRect(x + 2, d + h * 0.4, 10, 3); } return;
    case 'lifering': {
      // Colgado de un soporte atornillado a la barandilla: sombra pegada detrás, no en el suelo.
      const R = Math.min(w, d + h) / 2 - 3, cx = w / 2, cy = (d + h) / 2 + 2;
      ctx.fillStyle = 'rgba(20,12,40,0.22)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 3, R, 0, Math.PI * 2); ctx.fill();
      rr(ctx, cx - 4, 0, 8, 10, 2); fillStroke(ctx, '#9aa5b1', INK, 1.4);
      screw(ctx, cx, 4, 1.4);
      ctx.strokeStyle = '#5f6b7e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, cy - R + 2); ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = '#f8f3e8'; ctx.stroke();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = '#ff4d5e'; ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    case 'flagPole': case 'mast': case 'cameraMast': case 'antenna': {
      const cx = w / 2;
      // Base atornillada a la cubierta: el poste nace de ella, no flota.
      const baseY = h + d * 0.2;
      rr(ctx, cx - w / 2 + 1, baseY, w - 2, d * 0.7, 3); fillStroke(ctx, '#5f6b7e', INK, 1.6);
      screw(ctx, cx - w / 2 + 5, baseY + 4, 1.3); screw(ctx, cx + w / 2 - 5, baseY + 4, 1.3);
      ctx.fillStyle = INK; ctx.fillRect(cx - 3, 6, 6, baseY - 4);
      ctx.fillStyle = '#c0c8d4'; ctx.fillRect(cx - 2, 6, 4, baseY - 6);
      if (k === 'flagPole') {
        // La bandera se une al mástil por dos anillas y ondea hacia fuera.
        ctx.beginPath(); ctx.moveTo(cx + 2, 8); ctx.quadraticCurveTo(cx + 18, 4, cx + 34, 12); ctx.quadraticCurveTo(cx + 20, 18, cx + 34, 26); ctx.quadraticCurveTo(cx + 18, 22, cx + 2, 28); ctx.closePath();
        fillStroke(ctx, '#e63946', INK, 1.4);
        ctx.fillStyle = '#f1ede4'; ctx.fillRect(cx + 4, 15, 20, 3);
        for (const yy of [9, 26]) { ctx.beginPath(); ctx.arc(cx, yy, 2.4, 0, Math.PI * 2); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
      }
      if (k === 'antenna') { ctx.beginPath(); ctx.ellipse(cx + 10, 18, 12, 16, -0.3, 0, Math.PI * 2); fillStroke(ctx, '#e9eef5', INK, 1.6); for (let i = 0; i < 3; i++) { ctx.fillStyle = INK; ctx.fillRect(cx - 12, 30 + i * 12, 24, 2); } }
      if (k === 'cameraMast') { rr(ctx, cx - 4, 2, 20, 12, 3); fillStroke(ctx, '#2b2d42', INK, 1.2); }
      led(ctx, cx, 6, '#ff4d5e', 2);
      return;
    }
    case 'funnel': {
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.3 + d * 0.5, w / 2 - 4, d / 2 - 4, 0, 0, Math.PI * 2);
      fillStroke(ctx, hgrad(ctx, 0, w, '#d62828', '#8f1b1b'), INK, 3);
      ctx.fillStyle = '#20375c'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.3 + d * 0.5, w / 2 - 4, d / 2 - 4, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.3 + d * 0.45, w / 2 - 30, d / 2 - 30, 0, 0, Math.PI * 2); fillStroke(ctx, '#1b1b1b', INK, 2);
      ctx.fillStyle = '#f1ede4'; ctx.fillRect(10, h * 0.3 + d * 0.5 - 6, w - 20, 10);
      return;
    }
    case 'lifeboat': {
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.5 + d / 2, w / 2 - 3, d / 2 - 2, 0, 0, Math.PI * 2);
      fillStroke(ctx, vgrad(ctx, 0, d + h, '#ff7b00', '#c45a00'), INK, 2.5);
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.5 + d / 2 - 3, w / 2 - 18, d / 2 - 12, 0, 0, Math.PI * 2); fillStroke(ctx, '#f4f1e8', INK, 1.6);
      label(ctx, 'BOTE 1', w / 2, h * 0.5 + d / 2, 10, '#20375c');
      return;
    }
    case 'bollard': case 'winch': {
      obliqueBox(ctx, w, d, h, '#3d405b', '#2b2d42', Math.min(w, d) / 2);
      if (k === 'winch') { ctx.strokeStyle = '#b08968'; ctx.lineWidth = 4; for (let y = 8; y < d - 4; y += 6) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke(); } }
      return;
    }
    case 'noticeBoard': case 'board': case 'departureBoard': {
      rr(ctx, 0, 0, w, d + h, 3); fillStroke(ctx, k === 'noticeBoard' ? '#b08968' : '#161925', INK, 2);
      if (k === 'noticeBoard') { for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#fff', '#ffd23f', '#8ecae6', '#fff'][i]; ctx.save(); ctx.translate(8 + i * 12, 8 + (i % 2) * 10); ctx.rotate((i - 1.5) * 0.08); ctx.fillRect(0, 0, 11, 13); ctx.restore(); } }
      else { for (let r = 0; r < 4; r++) { ctx.fillStyle = r % 2 ? '#ffd23f' : '#ff8a3d'; ctx.fillRect(6, 6 + r * ((d + h - 12) / 4), w * (0.4 + (r % 3) * 0.15), 3); } }
      return;
    }
    case 'menuBoard': {
      // Pizarra colgada de la pared con dos alcayatas
      ctx.fillStyle = 'rgba(20,12,40,0.22)'; rr(ctx, 3, 5, w, d + h - 4, 3); ctx.fill();
      rr(ctx, 0, 2, w, d + h - 4, 3); fillStroke(ctx, '#2d3a2e', INK, 2);
      ctx.strokeStyle = '#a0663b'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 3.5, w - 3, d + h - 7);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let r = 0; r < 4; r++) ctx.fillRect(7, 10 + r * 8, w * (0.4 + (r % 2) * 0.3), 2);
      return;
    }
    case 'magazineRack': {
      obliqueBox(ctx, w, d, h, pal.woodDark, pal.wood, 3);
      for (let i = 0; i < 4; i++) { rr(ctx, 4, d + 4 + i * ((h - 8) / 4), w - 8, (h - 8) / 4 - 2, 1); fillStroke(ctx, ['#e63946', '#ffd23f', '#5cc8ff', '#3ddc97'][i], INK, 1); }
      return;
    }
    case 'wallScreen': {
      ctx.fillStyle = 'rgba(20,12,40,0.2)'; rr(ctx, 3, 4, w, d + h - 4, 3); ctx.fill();
      rr(ctx, 0, 2, w, d + h - 4, 3); fillStroke(ctx, '#1d2433', INK, 2);
      screen(ctx, 4, 6, w - 8, d + h - 14, '#5cc8ff');
      return;
    }
    case 'jumpSeat': seat(ctx, w, d, h, pal.fabricAlt, false); return;
    case 'marketFridge': {
      // Mostrador refrigerado con cristal discreto y productos de su sección
      obliqueBox(ctx, w, d, h, '#e9eef2', '#c9d3db', 4);
      rr(ctx, 4, d + 6, w - 8, h - 22, 3); fillStroke(ctx, 'rgba(180,225,255,0.55)', INK, 1.4);
      const sec = String(p.label ?? '');
      const prods = Object.values(PRODUCT_BY_ID).filter((x) => x.section === sec);
      const n = Math.max(1, Math.floor((w - 16) / 26));
      for (let i = 0; i < n; i++) { const pr = prods[i % Math.max(1, prods.length)]; if (pr) drawProductIcon(ctx, pr, 14 + i * 26, d + 6 + (h - 22) / 2, 20); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(6, d + 8, w - 12, 3);
      ctx.fillStyle = '#2b2d42'; ctx.fillRect(2, d + h - 12, w - 4, 10);
      const meta = SECTIONS.find((x) => x.id === sec);
      if (meta) label(ctx, meta.name.toUpperCase(), w / 2, d + h - 7, 8, '#f8f3e8');
      return;
    }
    case 'marketShelf': {
      // Lineal alto y opaco: estantes con productos en la cara frontal (sur) y la tapa con los de la cara norte.
      let faces: { n: string[]; s: string[]; sec?: string } = { n: [], s: [] };
      try { faces = JSON.parse(String(p.label ?? '{}')); } catch { /* sin datos */ }
      obliqueBox(ctx, w, d, h, '#dfe4ea', '#f4f6f8', 3);
      const rows = 3;
      const front = faces.s.map((id) => PRODUCT_BY_ID[id]).filter(Boolean);
      for (let r = 0; r < rows; r++) {
        const yy = d + 6 + r * ((h - 12) / rows);
        ctx.fillStyle = '#c3cbd5'; ctx.fillRect(3, yy + (h - 12) / rows - 4, w - 6, 3);
        const step = 22;
        for (let x = 14, i = r; x < w - 10; x += step, i++) { const pr = front[i % Math.max(1, front.length)]; if (pr) drawProductIcon(ctx, pr, x, yy + (h - 12) / rows / 2 - 1, 15); }
      }
      const back = faces.n.map((id) => PRODUCT_BY_ID[id]).filter(Boolean);
      for (let x = 12, i = 0; x < w - 8; x += 18, i++) { const pr = back[i % Math.max(1, back.length)]; if (pr) { ctx.globalAlpha = 0.85; drawProductIcon(ctx, pr, x, d / 2, 11); ctx.globalAlpha = 1; } }
      ctx.fillStyle = '#e63946'; ctx.fillRect(0, d + h - 6, w, 4);
      return;
    }
    case 'cashDesk': {
      obliqueBox(ctx, w, d, h, '#f4efe6', '#c9a27a', 4);
      // Cinta transportadora y escáner
      rr(ctx, 8, 6, w * 0.6, d - 14, 3); fillStroke(ctx, '#2b2d42', INK, 1.4);
      ctx.strokeStyle = '#4a4e69'; ctx.lineWidth = 1; for (let x = 12; x < w * 0.6 + 4; x += 8) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, d - 10); ctx.stroke(); }
      rr(ctx, w * 0.68, 8, 26, d - 18, 3); fillStroke(ctx, '#adb5bd', INK, 1.3);
      ctx.fillStyle = '#ff4d5e'; ctx.fillRect(w * 0.68 + 4, d / 2 - 5, 18, 2);
      rr(ctx, w - 40, -18, 30, 22, 3); fillStroke(ctx, '#1d2433', INK, 1.6); screen(ctx, w - 37, -15, 24, 15, '#3ddc97');
      if (p.label === 'cerrada') { rr(ctx, w / 2 - 34, d + 6, 68, 16, 4); fillStroke(ctx, '#e63946', INK, 1.4); label(ctx, 'CERRADA', w / 2, d + 14, 9, '#ffffff'); }
      else { rr(ctx, w / 2 - 30, d + 6, 60, 16, 4); fillStroke(ctx, '#3ddc97', INK, 1.4); label(ctx, 'CAJA 1', w / 2, d + 14, 9, '#1d1830'); }
      return;
    }
    case 'cartStack': {
      for (let i = 0; i < 4; i++) {
        const ox = i * 16;
        ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
        rr(ctx, ox + 4, 6, 56, d + h * 0.55, 4); ctx.stroke();
        ctx.strokeStyle = '#c0c8d4'; ctx.lineWidth = 1.4; for (let x = ox + 10; x < ox + 58; x += 7) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, d + h * 0.55 + 4); ctx.stroke(); }
        ctx.fillStyle = '#e63946'; ctx.fillRect(ox + 2, 4, 60, 4);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ox + 12, d + h - 4, 4, 0, Math.PI * 2); ctx.arc(ox + 52, d + h - 4, 4, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    case 'basketStack': {
      for (let i = 0; i < 4; i++) { rr(ctx, 4, d + h - 14 - i * 9, w - 8, 14, 3); fillStroke(ctx, '#e63946', INK, 1.4); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w / 2, d + h - 42, 12, Math.PI, 0); ctx.stroke();
      return;
    }
    case 'promoStand': {
      obliqueBox(ctx, w, d, h, '#ffd23f', '#f4a300', 4);
      rr(ctx, 8, -20, w - 16, 22, 4); fillStroke(ctx, '#e63946', INK, 1.6);
      label(ctx, 'OFERTA', w / 2, -9, 11, '#ffffff');
      const prs = ['galletas', 'mermelada', 'aceite', 'cacao'].map((id) => PRODUCT_BY_ID[id]);
      prs.forEach((pr, i) => pr && drawProductIcon(ctx, pr, 18 + i * ((w - 30) / 3), d + h / 2, 20));
      return;
    }
    case 'gateSign': {
      const cols = ['#e0702e', '#20375c', '#2f6fb3'];
      const names = ['SÚPER · El Carrito', 'BARCO · Muelle 1', 'AVIÓN · Puerta B7'];
      obliqueBox(ctx, w, d, h, '#2b2d42', cols[p.variant ?? 0], 6);
      label(ctx, names[p.variant ?? 0], w / 2, d + h / 2, 15, '#ffffff');
      return;
    }
    case 'mirror': rr(ctx, 0, 0, w, d + h, 5); fillStroke(ctx, vgrad(ctx, 0, d + h, '#dff3ff', '#9ec9e2'), INK, 2.5); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, 8); ctx.lineTo(28, 30); ctx.stroke(); return;
    case 'overheadBins': {
      // Compartimentos sobre los asientos: puertas con cierre y sombra suave sobre la pared.
      ctx.fillStyle = 'rgba(20,12,40,0.18)'; rr(ctx, 2, 4, w, d + h - 2, 4); ctx.fill();
      rr(ctx, 0, 0, w, d + h - 4, 4); fillStroke(ctx, vgrad(ctx, 0, d + h, '#eef2f7', '#c9d2de'), INK, 1.6);
      const n = Math.max(1, Math.round(w / 64));
      for (let i = 0; i < n; i++) {
        const x0 = (i * w) / n + 3, ww = w / n - 6;
        rr(ctx, x0, 4, ww, d + h - 14, 3); fillStroke(ctx, 'rgba(255,255,255,0.35)', 'rgba(29,24,48,0.45)', 1);
        rr(ctx, x0 + ww / 2 - 8, d + h - 16, 16, 4, 2); ctx.fillStyle = '#8692a4'; ctx.fill();
      }
      return;
    }
    case 'cartBay': {
      obliqueBox(ctx, w, d, h, '#cdd5e1', '#aeb9c9', 3);
      for (let x = 6; x < w - 26; x += 34) { rr(ctx, x, d + 3, 30, h - 6, 3); fillStroke(ctx, '#e9eef5', INK, 1.2); ctx.fillStyle = '#2f6fb3'; ctx.fillRect(x + 4, d + 8, 22, 3); }
      return;
    }
    case 'airPackX': return;
    case 'radiators': case 'acUnit': case 'roofVent': case 'roofCover': case 'roofBox': case 'pantograph': case 'horn': case 'exhaust': case 'reliefValve': {
      const c = k === 'roofCover' ? '#6c757d' : k === 'exhaust' ? '#3d405b' : '#9aa5b1';
      if (k === 'pantograph') {
        obliqueBox(ctx, w, d * 0.3, 8, '#4a4e69', '#3a3e59', 3);
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, h + d * 0.2); ctx.lineTo(w / 2, 4); ctx.lineTo(w - 10, h + d * 0.2); ctx.stroke();
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = INK; ctx.fillRect(w / 2 - 30, 2, 60, 4);
        return;
      }
      obliqueBox(ctx, w, d, h, shade(c, 0.12), c, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
      if (k === 'radiators' || k === 'acUnit' || k === 'roofVent') for (let x = 6; x < w - 4; x += 6) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, d - 4); ctx.stroke(); }
      if (k === 'acUnit') { ctx.beginPath(); ctx.arc(w * 0.7, d / 2, d * 0.35, 0, Math.PI * 2); fillStroke(ctx, '#495057', INK, 1.5); }
      if (k === 'reliefValve') { ctx.beginPath(); ctx.arc(w / 2, d / 2, 10, 0, Math.PI * 2); ctx.strokeStyle = '#d64545'; ctx.lineWidth = 3; ctx.stroke(); }
      if (k === 'roofCover') { for (const [x, y] of [[6, 6], [w - 6, 6], [6, d - 6], [w - 6, d - 6]]) screw(ctx, x, y, 2.2); }
      return;
    }
    case 'stairsUp': stairs(ctx, w, d, h, pal, true); return;
    case 'stairsDown': case 'stairsDownTop': stairs(ctx, w, d, h, pal, false); return;
    default: {
      obliqueBox(ctx, w, d, h, shade(pal.metal, 0.15), pal.metal, 4);
    }
  }
}

/** Objetos planos (trampillas, escotillas, puertas exteriores pintadas) sobre el suelo. */
export function drawFlat(ctx: Ctx, p: PropDef, pal: MapPalette) {
  const { x, y, w, h } = p.rect;
  ctx.save();
  ctx.translate(x, y);
  switch (p.kind) {
    case 'vent': {
      rr(ctx, 0, 0, w, h, 4); fillStroke(ctx, '#2b2f3a', INK, 2);
      ctx.strokeStyle = '#69707d'; ctx.lineWidth = 2;
      for (let xx = 6; xx < w - 4; xx += 6) { ctx.beginPath(); ctx.moveTo(xx, 4); ctx.lineTo(xx, h - 4); ctx.stroke(); }
      screw(ctx, 3.5, 3.5, 1.5); screw(ctx, w - 3.5, 3.5, 1.5); screw(ctx, 3.5, h - 3.5, 1.5); screw(ctx, w - 3.5, h - 3.5, 1.5);
      break;
    }
    case 'hatch': case 'serviceHatch': case 'serviceLadder': {
      rr(ctx, 0, 0, w, h, 5); fillStroke(ctx, vgrad(ctx, 0, h, shade(pal.metal, 0.05), shade(pal.metal, -0.25)), INK, 2);
      ctx.save(); rr(ctx, 2, 2, w - 4, h - 4, 4); ctx.clip();
      for (let xx = -h; xx < w; xx += 12) { ctx.fillStyle = 'rgba(255,210,63,0.75)'; ctx.beginPath(); ctx.moveTo(xx, h); ctx.lineTo(xx + 6, h); ctx.lineTo(xx + 6 + h, 0); ctx.lineTo(xx + h, 0); ctx.fill(); }
      ctx.restore();
      rr(ctx, 8, 8, w - 16, h - 16, 3); fillStroke(ctx, shade(pal.metal, -0.1), INK, 1.4);
      if (p.kind !== 'hatch') { ctx.fillStyle = INK; for (let yy = 12; yy < h - 10; yy += 7) ctx.fillRect(w / 2 - 10, yy, 20, 2); }
      break;
    }
    case 'exitDoor': {
      if (p.label === 'salida') {
        // Salida de seguridad del supermercado (pared este)
        rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, '#2bb24c', INK, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(3, h / 2 - 2, w - 6, 4);
        break;
      }
      rr(ctx, 6, 8, w - 12, h - 10, 8); fillStroke(ctx, vgrad(ctx, 0, h, '#e3e9f1', '#c3cddb'), INK, 2);
      rr(ctx, w / 2 - 14, 16, 28, 18, 8); fillStroke(ctx, '#9fd3ea', INK, 1.6);
      ctx.fillStyle = '#e63946'; ctx.fillRect(10, h - 14, w - 20, 4);
      label(ctx, 'SALIDA L1', w / 2, h - 22, 9, '#2f6fb3');
      break;
    }
    case 'departureBoard': {
      rr(ctx, 0, 6, w, h - 8, 4); fillStroke(ctx, '#111522', INK, 2);
      const rows = ['BARCO · EL FERRY · MUELLE 1 · EMBARCANDO', 'AVIÓN · EL VUELO · PUERTA B7 · A TIEMPO', 'SÚPER · EL CARRITO · ABIERTO HASTA LAS 22:00'];
      rows.forEach((r, i) => label(ctx, r, 14, 18 + i * 12, 9, ['#5cc8ff', '#ff8a3d', '#3ddc97'][i], 'left'));
      break;
    }
    case 'sectionSign': {
      // Rótulo de sección pintado en el suelo, con icono propio
      const meta = SECTIONS.find((x) => x.id === p.label);
      const name = meta?.name ?? String(p.label ?? '');
      ctx.font = '900 13px "Baloo 2", sans-serif';
      const tw = ctx.measureText(name.toUpperCase()).width + 34;
      rr(ctx, 0, 0, tw, 22, 11); fillStroke(ctx, 'rgba(29,24,48,0.78)', null);
      const pr = Object.values(PRODUCT_BY_ID).find((x) => x.section === p.label);
      if (pr) drawProductIcon(ctx, pr, 12, 11, 14);
      label(ctx, name.toUpperCase(), 22, 12, 12, '#f8f3e8', 'left');
      break;
    }
    case 'queueLine': {
      ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]);
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(w, 2); ctx.moveTo(0, h - 2); ctx.lineTo(w, h - 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(29,24,48,0.55)';
      for (let x = 30; x < w; x += 90) { ctx.beginPath(); ctx.moveTo(x, h / 2 - 7); ctx.lineTo(x + 14, h / 2); ctx.lineTo(x, h / 2 + 7); ctx.closePath(); ctx.fill(); }
      label(ctx, 'COLA', 40, h / 2, 12, 'rgba(29,24,48,0.75)');
      break;
    }
    case 'entranceDoor': {
      rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, 'rgba(170,220,255,0.8)', INK, 2);
      ctx.fillStyle = INK; ctx.fillRect(w / 2 - 1, 0, 2, h);
      break;
    }
    case 'rug': {
      rr(ctx, 0, 0, w, h, 26); fillStroke(ctx, '#7a3b52', INK, 2);
      rr(ctx, 12, 12, w - 24, h - 24, 18); ctx.strokeStyle = '#f2cc8f'; ctx.lineWidth = 3; ctx.stroke();
      label(ctx, 'THE WORST TRAVEL', w / 2, h / 2 - 8, 28, 'rgba(242,204,143,0.85)');
      label(ctx, 'salidas · llegadas · líos', w / 2, h / 2 + 22, 14, 'rgba(242,204,143,0.7)');
      break;
    }
    default:
      rr(ctx, 0, 0, w, h, 3); fillStroke(ctx, 'rgba(0,0,0,0.2)', null);
  }
  ctx.restore();
}
