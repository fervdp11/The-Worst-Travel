import { WALL_CAP } from '../../shared/maps/builder';
import type { MapDef, PropDef, RoomDef, WallDef } from '../../shared/maps/types';
import { contactShadow, Ctx, fillStroke, label, makeCanvas, rr, screw, speckle, vgrad } from './draw';
import { INK, MapPalette, PALETTES, rgba, shade } from './palette';
import { drawFlat } from './props';
import type { Rect } from '../../shared/geometry';
import { PLANE } from '../../shared/maps/plane';
import { TRAIN, xs, xe } from '../../shared/maps/train';
import { SHIP } from '../../shared/maps/ship';

export const CHUNK = 1024;

const SKY: Record<string, [string, string]> = {
  train: ['#bfe3ff', '#7fb9e6'],
  ship: ['#cdeeff', '#5fa8d3'],
  plane: ['#e6f3ff', '#8ec5ff'],
  lobby: ['#ffe2b8', '#f2a65a'],
};

function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function polyPath(ctx: Ctx, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

export class MapPainter {
  pal: MapPalette;
  constructor(public def: MapDef, public res: number) {
    this.pal = PALETTES[def.id];
  }

  /** Área de dibujo del nivel (vehículo + carrocería visible). */
  levelArea(level: string): Rect {
    const lv = this.def.levels.find((l) => l.id === level)!;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of lv.outline) for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x: x0 - 60, y: y0 - 60, w: x1 - x0 + 120, h: y1 - y0 + 140 };
  }

  chunksFor(level: string): Rect[] {
    const a = this.levelArea(level);
    const out: Rect[] = [];
    for (let y = Math.floor(a.y / CHUNK) * CHUNK; y < a.y + a.h; y += CHUNK)
      for (let x = Math.floor(a.x / CHUNK) * CHUNK; x < a.x + a.w; x += CHUNK) out.push({ x, y, w: CHUNK, h: CHUNK });
    return out;
  }

  paintChunk(level: string, chunk: Rect, tallProps: PropDef[]): HTMLCanvasElement {
    const c = makeCanvas(chunk.w * this.res, chunk.h * this.res);
    const ctx = c.getContext('2d')!;
    ctx.scale(this.res, this.res);
    ctx.translate(-chunk.x, -chunk.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const near = (r: Rect, m = 80) => rectsIntersect({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m }, chunk);
    this.paintBody(ctx, level, chunk);
    const rooms = this.def.rooms.filter((r) => r.level === level && (near(r.rect) || r.extra?.some((e) => near(e))));
    for (const r of rooms) this.paintFloor(ctx, r);
    const walls = this.def.walls.filter((w) => w.level === level && near(w.rect));
    this.paintAO(ctx, walls);
    for (const p of tallProps) if (p.level === level && near(p.rect, 120)) this.paintPropShadow(ctx, p);
    for (const p of this.def.props) if (p.level === level && p.flat && near(p.rect)) drawFlat(ctx, p, this.pal);
    this.paintMarkings(ctx, level, chunk);
    for (const d of this.def.doors) if (d.level === level && near(d.rect)) this.paintDoorFrame(ctx, d.rect, d.orient);
    for (const w of walls) this.paintWall(ctx, w);
    for (const p of this.def.props) if (p.level === level && p.kind === 'railLine' && near(p.rect)) this.paintRail(ctx, JSON.parse(p.label!));
    for (const r of rooms) this.paintLight(ctx, r);
    return c;
  }

  // ---------------------------------------------------------------- carrocería
  private paintBody(ctx: Ctx, level: string, chunk: Rect) {
    const id = this.def.id;
    const lv = this.def.levels.find((l) => l.id === level)!;
    const pal = this.pal;
    if (id === 'train') {
      for (let i = 0; i < 9; i++) {
        const x0 = xs(i), x1 = xe(i);
        if (x1 + 80 < chunk.x || x0 - 200 > chunk.x + chunk.w) continue;
        // Bogies y ruedas bajo el lateral
        for (const bx of [x0 + 90, x1 - 150]) {
          rr(ctx, bx, 312, 120, 34, 6); fillStroke(ctx, '#2b2d42', INK, 2);
          for (const wx of [bx + 26, bx + 94]) {
            ctx.beginPath(); ctx.arc(wx, 340, 15, 0, Math.PI * 2); fillStroke(ctx, '#3d405b', INK, 2.2);
            ctx.beginPath(); ctx.arc(wx, 340, 6, 0, Math.PI * 2); fillStroke(ctx, '#adb5bd', INK, 1.5);
          }
        }
        // Lateral visible (cara sur exterior del coche)
        const body = i === 0 ? '#c8323f' : pal.hull;
        rr(ctx, x0, 294, x1 - x0, 32, 4);
        fillStroke(ctx, vgrad(ctx, 294, 326, shade(body, 0.08), shade(body, -0.25)), INK, 2);
        ctx.fillStyle = pal.trim; ctx.fillRect(x0 + 2, 304, x1 - x0 - 4, 3);
        for (let wx = x0 + 60; wx < x1 - 40; wx += 92) { rr(ctx, wx - 18, 309, 36, 12, 3); fillStroke(ctx, vgrad(ctx, 309, 321, '#cfe9ff', '#7fb1d8'), INK, 1.2); }
        if (i === 0) {
          // Morro de la locomotora
          ctx.beginPath();
          ctx.moveTo(x0, 0); ctx.lineTo(x0 - 40, 6); ctx.lineTo(x0 - 110, 30); ctx.lineTo(x0 - 150, 70); ctx.lineTo(x0 - 150, 230); ctx.lineTo(x0 - 110, 270); ctx.lineTo(x0 - 40, 294); ctx.lineTo(x0, 300); ctx.closePath();
          fillStroke(ctx, vgrad(ctx, 0, 300, '#d94452', '#9e2531'), INK, 2.5);
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath(); ctx.moveTo(x0 - 150, 120); ctx.lineTo(x0 - 60, 110); ctx.lineTo(x0 - 60, 190); ctx.lineTo(x0 - 150, 180); ctx.fill();
          ctx.fillStyle = '#1d3557';
          ctx.beginPath(); ctx.moveTo(x0 - 100, 60); ctx.lineTo(x0 - 30, 40); ctx.lineTo(x0 - 30, 260); ctx.lineTo(x0 - 100, 240); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(160,215,255,0.55)'; ctx.fillRect(x0 - 92, 70, 52, 50);
          for (const ly of [90, 210]) { ctx.beginPath(); ctx.arc(x0 - 140, ly, 9, 0, Math.PI * 2); fillStroke(ctx, '#fff6b0', INK, 2); }
          label(ctx, 'EXP·01', x0 - 75, 150, 14, '#ffffff');
        }
        if (i < 8) {
          // Enganche entre módulos
          rr(ctx, x1 - 6, 140, TRAIN.GAP + 12, 20, 4); fillStroke(ctx, '#3d405b', INK, 1.5);
        }
        if (level === 'roof') {
          // Superficie curva del techo
          rr(ctx, x0, 0, x1 - x0, TRAIN.MOD_W, 10);
          const g = ctx.createLinearGradient(0, 0, 0, TRAIN.MOD_W);
          g.addColorStop(0, '#6d7683'); g.addColorStop(0.18, '#9aa5b1'); g.addColorStop(0.5, '#b6c0cc'); g.addColorStop(0.82, '#9aa5b1'); g.addColorStop(1, '#5f6874');
          fillStroke(ctx, g, INK, 2.5);
          ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
          for (let rx = x0 + 40; rx < x1; rx += 60) { ctx.beginPath(); ctx.moveTo(rx, 14); ctx.lineTo(rx, TRAIN.MOD_W - 14); ctx.stroke(); }
          for (let rx = x0 + 20; rx < x1 - 10; rx += 40) { screw(ctx, rx, 18, 1.8); screw(ctx, rx, TRAIN.MOD_W - 18, 1.8); }
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + 6, 120, x1 - x0 - 12, 18);
        }
      }
      if (level === 'roof') {
        // Pasarelas superiores
        for (let i = 0; i < 8; i++) { rr(ctx, xe(i) - 14, 92, TRAIN.GAP + 28, 116, 3); fillStroke(ctx, '#4f5764', INK, 2); }
      } else {
        for (let i = 0; i < 8; i++) { rr(ctx, xe(i), 66, TRAIN.GAP, 168, 2); fillStroke(ctx, '#2b2d42', INK, 2); }
      }
      return;
    }
    if (id === 'ship') {
      if (level === 'main') {
        // Costado visible del casco con línea de flotación
        ctx.save(); ctx.translate(0, 54); polyPath(ctx, SHIP.MAIN_HULL); fillStroke(ctx, pal.hullDark, INK, 3); ctx.restore();
        ctx.save(); polyPath(ctx, SHIP.MAIN_HULL); ctx.clip();
        ctx.restore();
        ctx.save(); ctx.translate(0, 54); polyPath(ctx, SHIP.MAIN_HULL); ctx.clip();
        ctx.fillStyle = '#c8323f'; ctx.fillRect(chunk.x, 1080, chunk.w + 200, 30);
        ctx.restore();
        polyPath(ctx, SHIP.MAIN_HULL);
        fillStroke(ctx, vgrad(ctx, 40, 1060, shade(pal.hull, 0.15), pal.hull), INK, 3);
        ctx.fillStyle = '#f1ede4'; ctx.save(); polyPath(ctx, SHIP.MAIN_HULL); ctx.clip(); ctx.fillRect(chunk.x - 10, 1036, chunk.w + 20, 26); ctx.restore();
        label(ctx, 'EL FERRY', 2200, 1094, 24, '#f1ede4');
      } else if (level === 'lower') {
        polyPath(ctx, SHIP.LOWER_HULL); fillStroke(ctx, '#252d3b', INK, 3);
        ctx.save(); ctx.translate(0, 30); polyPath(ctx, SHIP.LOWER_HULL); fillStroke(ctx, 'rgba(0,0,0,0.35)', null); ctx.restore();
        polyPath(ctx, SHIP.LOWER_HULL); fillStroke(ctx, vgrad(ctx, 240, 880, '#3a4456', '#283142'), INK, 3);
      } else {
        // Superior: silueta de la principal debajo, en sombra
        ctx.save(); ctx.globalAlpha = 0.9; polyPath(ctx, SHIP.MAIN_HULL); fillStroke(ctx, shade(pal.hull, -0.3), INK, 2); ctx.restore();
        ctx.save(); ctx.translate(0, 40); polyPath(ctx, SHIP.UPPER_DECK); fillStroke(ctx, '#cfc6b4', INK, 2); ctx.restore();
        polyPath(ctx, SHIP.UPPER_DECK); fillStroke(ctx, '#e9e2d3', INK, 2.5);
      }
      return;
    }
    if (id === 'plane') {
      ctx.save(); ctx.translate(0, 34); polyPath(ctx, PLANE.FUSELAGE); fillStroke(ctx, pal.hullDark, INK, 3); ctx.restore();
      polyPath(ctx, PLANE.FUSELAGE);
      fillStroke(ctx, vgrad(ctx, 0, 600, '#ffffff', '#d7dee8'), INK, 3);
      // Ventanillas del costado visible
      ctx.save(); ctx.translate(0, 34); polyPath(ctx, PLANE.FUSELAGE); ctx.clip(); ctx.restore();
      for (let wx = 860; wx < 2960; wx += 64) { if (wx > 1500 && wx < 1990) continue; rr(ctx, wx - 7, 608, 14, 16, 6); fillStroke(ctx, '#2f4f75', INK, 1.2); }
      ctx.fillStyle = pal.trim; ctx.fillRect(560, 628, 2440, 5);
      // Parabrisas
      ctx.fillStyle = '#1d3557';
      ctx.beginPath(); ctx.moveTo(140, 230); ctx.lineTo(215, 140); ctx.lineTo(245, 160); ctx.lineTo(190, 240); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(140, 370); ctx.lineTo(215, 460); ctx.lineTo(245, 440); ctx.lineTo(190, 360); ctx.closePath(); ctx.fill();
      if (level === 'tech') { ctx.save(); polyPath(ctx, PLANE.FUSELAGE); ctx.clip(); ctx.fillStyle = 'rgba(30,38,56,0.82)'; ctx.fillRect(0, 0, 3600, 640); ctx.restore(); }
      return;
    }
    // Terminal
    polyPath(ctx, lv.outline[0]);
    fillStroke(ctx, '#3d405b', INK, 3);
  }

  // ---------------------------------------------------------------- suelo
  private paintFloor(ctx: Ctx, r: RoomDef) {
    const rects = [r.rect, ...(r.extra ?? [])];
    const [c0, c1] = this.pal.floor[r.floor] ?? ['#888', '#777'];
    for (const rc of rects) {
      ctx.save();
      ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
      ctx.fillStyle = c0;
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      const seed = Math.floor(rc.x * 7 + rc.y * 13);
      switch (r.floor) {
        case 'parquet': case 'wood': case 'deck': {
          const plank = r.floor === 'deck' ? 22 : 16;
          for (let y = rc.y; y < rc.y + rc.h; y += plank) {
            const off = ((y / plank) % 3) * 40;
            for (let x = rc.x - off; x < rc.x + rc.w; x += 120) {
              ctx.fillStyle = (Math.floor(x + y) % 3 === 0) ? c1 : shade(c0, ((x * 7 + y) % 5) * 0.012);
              ctx.fillRect(x + 1, y + 1, 118, plank - 2);
            }
            ctx.fillStyle = r.floor === 'deck' ? 'rgba(40,25,10,0.55)' : 'rgba(0,0,0,0.18)';
            ctx.fillRect(rc.x, y + plank - 1.5, rc.w, 1.5);
          }
          if (r.floor === 'deck') speckle(ctx, rc.x, rc.y, rc.w, rc.h, rc.w * rc.h / 900, 'rgba(255,255,255,0.05)', seed, 2);
          break;
        }
        case 'tile': case 'checker': {
          const s = r.floor === 'checker' ? 40 : 28;
          for (let y = rc.y; y < rc.y + rc.h; y += s) for (let x = rc.x; x < rc.x + rc.w; x += s) {
            if (r.floor === 'checker' && ((x / s + y / s) & 1)) { ctx.fillStyle = c1; ctx.fillRect(x, y, s, s); }
            else if (r.floor === 'tile') { ctx.fillStyle = (((x / s) | 0) + ((y / s) | 0)) % 2 ? c0 : shade(c0, -0.03); ctx.fillRect(x, y, s, s); }
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
          for (let x = rc.x; x < rc.x + rc.w; x += s) { ctx.beginPath(); ctx.moveTo(x, rc.y); ctx.lineTo(x, rc.y + rc.h); ctx.stroke(); }
          for (let y = rc.y; y < rc.y + rc.h; y += s) { ctx.beginPath(); ctx.moveTo(rc.x, y); ctx.lineTo(rc.x + rc.w, y); ctx.stroke(); }
          break;
        }
        case 'metal': {
          ctx.fillStyle = vgrad(ctx, rc.y, rc.y + rc.h, shade(c0, 0.05), c1); ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          for (let y = rc.y + 4; y < rc.y + rc.h; y += 10) for (let x = rc.x + ((y / 10) % 2) * 5; x < rc.x + rc.w; x += 10) { ctx.save(); ctx.translate(x, y); ctx.rotate(0.6); ctx.fillRect(-3, -1, 6, 2); ctx.restore(); }
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
          for (let x = rc.x + 120; x < rc.x + rc.w; x += 120) { ctx.beginPath(); ctx.moveTo(x, rc.y); ctx.lineTo(x, rc.y + rc.h); ctx.stroke(); }
          break;
        }
        case 'grate': {
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
          for (let x = rc.x; x < rc.x + rc.w; x += 8) { ctx.beginPath(); ctx.moveTo(x, rc.y); ctx.lineTo(x, rc.y + rc.h); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
          for (let y = rc.y; y < rc.y + rc.h; y += 24) { ctx.beginPath(); ctx.moveTo(rc.x, y); ctx.lineTo(rc.x + rc.w, y); ctx.stroke(); }
          break;
        }
        case 'carpet': case 'cabin': {
          ctx.fillStyle = c1;
          for (let y = rc.y; y < rc.y + rc.h; y += 24) for (let x = rc.x + ((y / 24) % 2) * 12; x < rc.x + rc.w; x += 24) {
            ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 6, y); ctx.lineTo(x + 12, y + 6); ctx.lineTo(x + 6, y + 12); ctx.closePath(); ctx.fill();
          }
          ctx.strokeStyle = rgba(this.pal.accent, 0.35); ctx.lineWidth = 3;
          ctx.strokeRect(rc.x + 8, rc.y + 8, rc.w - 16, rc.h - 16);
          speckle(ctx, rc.x, rc.y, rc.w, rc.h, rc.w * rc.h / 300, 'rgba(255,255,255,0.04)', seed);
          break;
        }
        case 'roof': {
          ctx.fillStyle = vgrad(ctx, rc.y, rc.y + rc.h, '#7e8794', '#6d7683'); ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
          break;
        }
        case 'rubber': {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          for (let y = rc.y + 5; y < rc.y + rc.h; y += 10) for (let x = rc.x + 5 + ((y / 10) % 2) * 5; x < rc.x + rc.w; x += 10) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'concrete': case 'lino': default: {
          speckle(ctx, rc.x, rc.y, rc.w, rc.h, rc.w * rc.h / 140, 'rgba(0,0,0,0.06)', seed, 1.6);
          speckle(ctx, rc.x, rc.y, rc.w, rc.h, rc.w * rc.h / 200, 'rgba(255,255,255,0.05)', seed + 3, 1.6);
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
          for (let x = rc.x + 160; x < rc.x + rc.w; x += 160) { ctx.beginPath(); ctx.moveTo(x, rc.y); ctx.lineTo(x, rc.y + rc.h); ctx.stroke(); }
        }
      }
      // Tinte de iluminación de la sala
      const tint = r.light === 'warm' ? 'rgba(255,170,90,0.10)' : r.light === 'cold' ? 'rgba(90,160,255,0.10)' : r.light === 'dim' ? 'rgba(20,10,40,0.18)' : r.light === 'exterior' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0)';
      ctx.fillStyle = tint; ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      ctx.restore();
    }
  }

  private paintLight(ctx: Ctx, r: RoomDef) {
    if (r.exterior) return;
    const rc = r.rect;
    const n = Math.max(1, Math.round(rc.w / 260));
    ctx.save();
    ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    for (let i = 0; i < n; i++) {
      const cx = rc.x + ((i + 0.5) / n) * rc.w, cy = rc.y + rc.h * 0.5;
      const rad = Math.max(rc.h, rc.w / n) * 0.75;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const col = r.light === 'warm' ? '255,214,150' : r.light === 'cold' ? '190,225,255' : '240,240,240';
      g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }

  private paintAO(ctx: Ctx, walls: WallDef[]) {
    ctx.save();
    for (const w of walls) {
      if (w.kind === 'edge' || w.kind === 'rail') continue;
      const r = w.rect;
      // sombra bajo la pared (hacia el sur, porque la luz llega del noroeste)
      const g = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h + 26);
      g.addColorStop(0, 'rgba(20,12,40,0.30)'); g.addColorStop(1, 'rgba(20,12,40,0)');
      ctx.fillStyle = g; ctx.fillRect(r.x - 6, r.y + r.h, r.w + 12, 26);
      const g2 = ctx.createLinearGradient(r.x + r.w, 0, r.x + r.w + 18, 0);
      g2.addColorStop(0, 'rgba(20,12,40,0.22)'); g2.addColorStop(1, 'rgba(20,12,40,0)');
      ctx.fillStyle = g2; ctx.fillRect(r.x + r.w, r.y, 18, r.h);
      const g3 = ctx.createLinearGradient(r.x, 0, r.x - 10, 0);
      g3.addColorStop(0, 'rgba(20,12,40,0.14)'); g3.addColorStop(1, 'rgba(20,12,40,0)');
      ctx.fillStyle = g3; ctx.fillRect(r.x - 10, r.y, 10, r.h);
    }
    ctx.restore();
  }

  private paintPropShadow(ctx: Ctx, p: PropDef) {
    const { x, y, w, h: d } = p.rect;
    if (p.h < 6) return;
    // Proyección moderada hacia el sureste + sombra de contacto
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,40,0.16)';
    rr(ctx, x + 6, y + 5, w, d, 6); ctx.fill();
    ctx.restore();
    contactShadow(ctx, x + w / 2, y + d - 2, w * 0.55, Math.max(6, d * 0.35), 0.22);
  }

  private paintMarkings(ctx: Ctx, level: string, chunk: Rect) {
    // Líneas de seguridad junto a estaciones técnicas
    ctx.save();
    for (const s of this.def.stations) {
      if (s.level !== level) continue;
      if (s.x < chunk.x - 60 || s.x > chunk.x + chunk.w + 60 || s.y < chunk.y - 60 || s.y > chunk.y + chunk.h + 60) continue;
      if (s.kind === 'emergency') {
        ctx.strokeStyle = 'rgba(230,57,70,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      } else if (s.kind === 'ladder') {
        ctx.fillStyle = 'rgba(255,210,63,0.30)'; ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK; ctx.font = '900 16px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.id.endsWith('_a') ? (this.def.id === 'plane' ? '▼' : '▲') : (this.def.id === 'plane' ? '▲' : '▼'), s.x, s.y);
      }
    }
    ctx.restore();
  }

  private paintDoorFrame(ctx: Ctx, r: Rect, orient: 'h' | 'v') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    if (orient === 'h') {
      ctx.fillRect(r.x, r.y + r.h - 8, r.w, 10);
      ctx.fillStyle = '#ffd23f'; ctx.globalAlpha = 0.5; ctx.fillRect(r.x + 4, r.y + r.h - 3, r.w - 8, 3);
      ctx.globalAlpha = 1;
      rr(ctx, r.x - 6, r.y, 8, r.h, 2); fillStroke(ctx, shade(this.pal.metal, -0.1), INK, 1.5);
      rr(ctx, r.x + r.w - 2, r.y, 8, r.h, 2); fillStroke(ctx, shade(this.pal.metal, -0.1), INK, 1.5);
    } else {
      ctx.fillRect(r.x - 4, r.y, r.w + 8, r.h);
      ctx.fillStyle = '#ffd23f'; ctx.globalAlpha = 0.45; ctx.fillRect(r.x + r.w / 2 - 1.5, r.y + 4, 3, r.h - 8);
      ctx.globalAlpha = 1;
      rr(ctx, r.x - 2, r.y - 6, r.w + 4, 8, 2); fillStroke(ctx, shade(this.pal.metal, -0.1), INK, 1.5);
      rr(ctx, r.x - 2, r.y + r.h - 2, r.w + 4, 10, 2); fillStroke(ctx, shade(this.pal.metal, -0.1), INK, 1.5);
    }
    ctx.restore();
  }

  private faceColors(w: WallDef): [string, string] {
    const r = w.rect;
    const below = this.def.rooms.find((rm) => rm.level === w.level && r.y + r.h + 10 >= rm.rect.y && r.y + r.h + 10 <= rm.rect.y + rm.rect.h && r.x + r.w / 2 >= rm.rect.x && r.x + r.w / 2 <= rm.rect.x + rm.rect.w);
    const light = below?.light ?? 'neutral';
    const base = this.pal.wallFace[light] ?? this.pal.wallFace.neutral;
    if (below && (below.floor === 'metal' || below.floor === 'grate' || below.floor === 'concrete')) return [shade(this.pal.metal, 0.2), this.pal.metal];
    if (below && (below.floor === 'carpet' || below.floor === 'parquet') && this.def.id === 'train') return ['#b07a4a', '#8a5a33'];
    return base;
  }

  private paintWall(ctx: Ctx, w: WallDef) {
    if (w.invisible || w.kind === 'edge') return;
    const r = w.rect;
    const top = this.pal.wallTop;
    if (w.kind === 'rail') { this.paintRailRect(ctx, r); return; }
    if (w.kind === 'bellows') {
      rr(ctx, r.x, r.y, r.w, r.h, 2); fillStroke(ctx, '#2b2d42', INK, 2);
      ctx.strokeStyle = '#4a4e69'; ctx.lineWidth = 3;
      for (let x = r.x + 5; x < r.x + r.w; x += 8) { ctx.beginPath(); ctx.moveTo(x, r.y + 2); ctx.lineTo(x, r.y + r.h - 2); ctx.stroke(); }
      return;
    }
    if (w.face && r.h >= 24) {
      const cap = Math.min(WALL_CAP, r.h * 0.35);
      const [f0, f1] = this.faceColors(w);
      // Cara frontal
      ctx.fillStyle = vgrad(ctx, r.y + cap, r.y + r.h, f0, f1);
      ctx.fillRect(r.x, r.y + cap, r.w, r.h - cap);
      // Zócalo y moldura
      ctx.fillStyle = shade(f1, -0.25); ctx.fillRect(r.x, r.y + r.h - 6, r.w, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(r.x, r.y + cap + 1, r.w, 2);
      // Paneles
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
      for (let x = r.x + 46; x < r.x + r.w - 10; x += 92) { ctx.beginPath(); ctx.moveTo(x, r.y + cap + 4); ctx.lineTo(x, r.y + r.h - 8); ctx.stroke(); }
      // Ventanas con profundidad
      const [s0, s1] = SKY[this.def.id];
      for (const wx of w.windows ?? []) {
        const ww = this.def.id === 'plane' ? 16 : 52, wy = r.y + cap + 5, wh = r.h - cap - 14;
        rr(ctx, wx - ww / 2 - 3, wy - 2, ww + 6, wh + 4, 6); fillStroke(ctx, shade(f1, -0.3), INK, 1.5);
        rr(ctx, wx - ww / 2, wy, ww, wh, 5);
        fillStroke(ctx, vgrad(ctx, wy, wy + wh, s0, s1), INK, 1.2);
        ctx.save(); rr(ctx, wx - ww / 2, wy, ww, wh, 5); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.moveTo(wx - ww / 2, wy + wh); ctx.lineTo(wx - ww / 2 + ww * 0.4, wy); ctx.lineTo(wx - ww / 2 + ww * 0.6, wy); ctx.lineTo(wx - ww / 2 + ww * 0.2, wy + wh); ctx.fill();
        ctx.restore();
        if (this.def.id === 'train') { ctx.fillStyle = 'rgba(122,46,58,0.85)'; ctx.fillRect(wx - ww / 2 - 4, wy - 2, 8, wh + 4); ctx.fillRect(wx + ww / 2 - 4, wy - 2, 8, wh + 4); }
      }
      // Tapa superior
      ctx.fillStyle = top; ctx.fillRect(r.x, r.y, r.w, cap);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(r.x, r.y, r.w, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      return;
    }
    // Muro sin cara (vertical o sur): tapa con bisel y pequeña cara inferior
    ctx.fillStyle = top; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(r.x, r.y, Math.min(3, r.w), r.h);
    if (r.h > r.w && r.h > 30) {
      const [f0, f1] = this.faceColors({ ...w, rect: { x: r.x, y: r.y + r.h - 20, w: r.w, h: 1 } });
      ctx.fillStyle = vgrad(ctx, r.y + r.h - 16, r.y + r.h, f0, f1); ctx.fillRect(r.x, r.y + r.h - 16, r.w, 16);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  private paintRailRect(ctx: Ctx, r: Rect) {
    ctx.save();
    const horiz = r.w >= r.h;
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath();
    if (horiz) { ctx.moveTo(r.x, r.y + r.h / 2); ctx.lineTo(r.x + r.w, r.y + r.h / 2); } else { ctx.moveTo(r.x + r.w / 2, r.y); ctx.lineTo(r.x + r.w / 2, r.y + r.h); }
    ctx.stroke();
    ctx.strokeStyle = '#f1ede4'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = INK;
    if (horiz) for (let x = r.x + 6; x < r.x + r.w; x += 30) { ctx.fillRect(x, r.y + r.h / 2 - 4, 3, 8); }
    else for (let y = r.y + 6; y < r.y + r.h; y += 30) { ctx.fillRect(r.x + r.w / 2 - 4, y, 8, 3); }
    ctx.restore();
  }

  private paintRail(ctx: Ctx, pts: { x: number; y: number }[]) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20,12,40,0.25)'; ctx.lineWidth = 6;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 5, p.y + 6) : ctx.moveTo(p.x + 5, p.y + 6))); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = '#f1ede4'; ctx.lineWidth = 3.5; ctx.stroke();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let t = 0; t < len; t += 30) { const x = a.x + (b.x - a.x) * (t / len), y = a.y + (b.y - a.y) * (t / len); ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    ctx.restore();
  }

  /** Alas, motores y estabilizadores del avión: textura propia compartida por ambos niveles. */
  static paintWings(res: number): { canvas: HTMLCanvasElement; x: number; y: number } {
    const x0 = 1300, y0 = -1320, w = 2300, h = 3260;
    const c = makeCanvas(w * res, h * res);
    const ctx = c.getContext('2d')!;
    ctx.scale(res, res);
    ctx.translate(-x0, -y0);
    ctx.lineJoin = 'round';
    const wing = (pts: { x: number; y: number }[]) => {
      ctx.save(); ctx.translate(14, 18); polyPath(ctx, pts); ctx.fillStyle = 'rgba(10,20,40,0.18)'; ctx.fill(); ctx.restore();
      polyPath(ctx, pts);
      const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[2].x, pts[2].y);
      g.addColorStop(0, '#e9eef5'); g.addColorStop(1, '#c3ccd8');
      fillStroke(ctx, g, INK, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
      for (let t = 0.2; t < 1; t += 0.2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x + (pts[1].x - pts[0].x) * t, pts[0].y + (pts[1].y - pts[0].y) * t);
        ctx.lineTo(pts[3].x + (pts[2].x - pts[3].x) * t, pts[3].y + (pts[2].y - pts[3].y) * t);
        ctx.stroke();
      }
    };
    wing(PLANE.WING_N); wing(PLANE.WING_S); wing(PLANE.STAB_N); wing(PLANE.STAB_S);
    for (const e of PLANE.ENGINES) {
      ctx.save(); ctx.translate(12, 14); rr(ctx, e.x - 130, e.y - 52, 260, 104, 50); ctx.fillStyle = 'rgba(10,20,40,0.2)'; ctx.fill(); ctx.restore();
      rr(ctx, e.x - 130, e.y - 52, 260, 104, 50);
      fillStroke(ctx, vgrad(ctx, e.y - 52, e.y + 52, '#f4f7fb', '#9aa7b8'), INK, 3);
      ctx.beginPath(); ctx.ellipse(e.x - 118, e.y, 18, 44, 0, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 2.5);
      ctx.strokeStyle = '#6c757d'; ctx.lineWidth = 2;
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(e.x - 118, e.y + k * 11); ctx.lineTo(e.x - 104, e.y + k * 11); ctx.stroke(); }
      ctx.fillStyle = PALETTES.plane.trim; ctx.fillRect(e.x - 40, e.y - 50, 18, 100);
    }
    // Aleta vertical (vista cenital)
    rr(ctx, 3150, 288, 340, 24, 12); fillStroke(ctx, '#2f6fb3', INK, 2.5);
    return { canvas: c, x: x0, y: y0 };
  }
}
