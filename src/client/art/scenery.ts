import Phaser from 'phaser';
import { hash2 } from '../../shared/rng';
import { contactShadow, fillStroke, makeCanvas, rr, speckle, vgrad } from './draw';
import { INK, shade } from './palette';

function tile(scene: Phaser.Scene, key: string, w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  fn(ctx);
  scene.textures.addCanvas(key, c);
}

/** Dibuja de forma envolvente (para mosaicos sin costuras). */
function wrap(w: number, h: number, x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    if (x + dx + r < 0 || x + dx - r > w || y + dy + r < 0 || y + dy - r > h) continue;
    fn(x + dx, y + dy);
  }
}

export function sceneryKeys(map: string): string[] {
  if (map === 'market') return ['sc_city'];
  if (map === 'ship') return ['sc_water', 'sc_waves', 'sc_foam', 'sc_islands'];
  if (map === 'plane') return ['sc_land', 'sc_cloudlo', 'sc_cloudhi'];
  return ['sc_plaza'];
}

export function generateScenery(scene: Phaser.Scene, map: string) {
  if (map === 'ship') {
    tile(scene, 'sc_water', 512, 512, (ctx) => {
      ctx.fillStyle = vgrad(ctx, 0, 512, '#1f78ad', '#1b6a9a'); ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 90; i++) {
        const x = hash2(i, 31) * 512, y = hash2(i, 32) * 512, l = 20 + hash2(i, 33) * 50;
        wrap(512, 512, x, y, l, (xx, yy) => {
          ctx.strokeStyle = i % 4 ? 'rgba(255,255,255,0.10)' : 'rgba(10,40,80,0.18)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(xx - l, yy); ctx.quadraticCurveTo(xx, yy - 6, xx + l, yy); ctx.stroke();
        });
      }
    });
    tile(scene, 'sc_waves', 512, 512, (ctx) => {
      for (let i = 0; i < 60; i++) {
        const x = hash2(i, 41) * 512, y = hash2(i, 42) * 512, l = 10 + hash2(i, 43) * 26;
        wrap(512, 512, x, y, l, (xx, yy) => {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(xx - l, yy); ctx.quadraticCurveTo(xx, yy - 5, xx + l, yy); ctx.stroke();
        });
      }
    });
    tile(scene, 'sc_foam', 512, 256, (ctx) => {
      for (let i = 0; i < 160; i++) {
        const x = hash2(i, 51) * 512, y = 128 + (hash2(i, 52) - 0.5) * 200 * (0.4 + hash2(i, 54)), r = 4 + hash2(i, 53) * 14;
        wrap(512, 256, x, y, r, (xx, yy) => { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(xx, yy, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); });
      }
    });
    tile(scene, 'sc_islands', 2048, 1024, (ctx) => {
      for (let k = 0; k < 3; k++) {
        const x = 300 + k * 700, y = k % 2 ? 180 : 860, r = 90 + k * 30;
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 0.65, 0, 0, Math.PI * 2); fillStroke(ctx, '#e9d8a6', INK, 2.5);
        ctx.beginPath(); ctx.ellipse(x - 10, y - 8, r, r * 0.45, 0, 0, Math.PI * 2); fillStroke(ctx, '#52b788', INK, 2.5);
        ctx.beginPath(); ctx.ellipse(x - 20, y - 14, r * 0.55, r * 0.25, 0, 0, Math.PI * 2); ctx.fillStyle = '#40916c'; ctx.fill();
        if (k === 1) { rr(ctx, x + r * 0.6, y - 50, 18, 50, 4); fillStroke(ctx, '#f1ede4', INK, 2); ctx.fillStyle = '#e63946'; ctx.fillRect(x + r * 0.6, y - 40, 18, 8); }
      }
    });
  } else if (map === 'plane') {
    tile(scene, 'sc_land', 1024, 1024, (ctx) => {
      ctx.fillStyle = '#7d9b6a'; ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 60; i++) {
        const x = hash2(i, 61) * 1024, y = hash2(i, 62) * 1024, w = 60 + hash2(i, 63) * 160, h = 40 + hash2(i, 64) * 120;
        wrap(1024, 1024, x, y, Math.max(w, h), (xx, yy) => { ctx.fillStyle = ['#a3b18a', '#c9b37a', '#6b8f5e', '#b5a26a', '#8fa876'][i % 5]; ctx.fillRect(xx, yy, w, h); });
      }
      ctx.strokeStyle = 'rgba(80,120,160,0.7)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(300, 200, 700, 500, 1024, 300); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,220,200,0.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 800); ctx.lineTo(1024, 760); ctx.stroke();
      speckle(ctx, 0, 0, 1024, 1024, 3000, 'rgba(0,0,0,0.06)', 9, 3);
    });
    const clouds = (key: string, n: number, alpha: number, seed: number) => tile(scene, key, 1024, 1024, (ctx) => {
      for (let i = 0; i < n; i++) {
        const x = hash2(i, seed) * 1024, y = hash2(i, seed + 1) * 1024, r = 50 + hash2(i, seed + 2) * 110;
        wrap(1024, 1024, x, y, r * 2.2, (xx, yy) => {
          for (let k = 0; k < 6; k++) {
            const cx = xx + (hash2(i, k + seed * 3) - 0.5) * r * 2.2, cy = yy + (hash2(k, i + seed) - 0.5) * r * 0.9, cr = r * (0.45 + hash2(k + 3, i) * 0.45);
            const g = ctx.createRadialGradient(cx, cy - cr * 0.3, 0, cx, cy, cr);
            g.addColorStop(0, `rgba(255,255,255,${alpha})`); g.addColorStop(0.7, `rgba(240,246,255,${alpha * 0.8})`); g.addColorStop(1, 'rgba(230,238,250,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
    });
    clouds('sc_cloudlo', 16, 0.75, 71);
    clouds('sc_cloudhi', 9, 0.9, 91);
  } else if (map === 'market') {
    // Calle con aparcamiento y aceras alrededor del edificio
    tile(scene, 'sc_city', 512, 512, (ctx) => {
      ctx.fillStyle = '#4a5563'; ctx.fillRect(0, 0, 512, 512);
      speckle(ctx, 0, 0, 512, 512, 2600, 'rgba(255,255,255,0.05)', 21, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4;
      for (let x = 0; x < 512; x += 128) { ctx.beginPath(); ctx.moveTo(x + 8, 60); ctx.lineTo(x + 8, 200); ctx.stroke(); }
      ctx.fillStyle = '#7a8796'; ctx.fillRect(0, 300, 512, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 300, 2, 40);
      for (let i = 0; i < 6; i++) { const x = 40 + i * 80; ctx.beginPath(); ctx.arc(x, 420, 22, 0, Math.PI * 2); fillStroke(ctx, '#4f7d3a', INK, 2); }
    });
  } else {
    tile(scene, 'sc_plaza', 512, 512, (ctx) => {
      ctx.fillStyle = '#4a4e69'; ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) { ctx.fillStyle = (x + y) % 128 ? '#535878' : '#4a4e69'; ctx.fillRect(x, y, 64, 64); }
      ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 6; ctx.setLineDash([30, 30]);
      ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
    });
  }
}

export function sceneryColor(map: string): number {
  return map === 'market' ? 0x4a5563 : map === 'ship' ? 0x1f78ad : map === 'plane' ? 0x8ec5ff : 0x2b2d42;
}

export { shade };
