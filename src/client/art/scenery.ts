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
  if (map === 'train') return ['sc_ground', 'sc_track', 'sc_canopy', 'sc_tunnel'];
  if (map === 'ship') return ['sc_water', 'sc_waves', 'sc_foam', 'sc_islands'];
  if (map === 'plane') return ['sc_land', 'sc_cloudlo', 'sc_cloudhi'];
  return ['sc_plaza'];
}

export function generateScenery(scene: Phaser.Scene, map: string) {
  if (map === 'train') {
    tile(scene, 'sc_ground', 1024, 1024, (ctx) => {
      ctx.fillStyle = '#6a9a52'; ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 70; i++) {
        const x = hash2(i, 1) * 1024, y = hash2(i, 2) * 1024, r = 40 + hash2(i, 3) * 120;
        wrap(1024, 1024, x, y, r, (xx, yy) => { ctx.fillStyle = i % 3 ? 'rgba(80,130,60,0.45)' : 'rgba(150,180,80,0.35)'; ctx.beginPath(); ctx.ellipse(xx, yy, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); });
      }
      // Campos de cultivo en franjas
      for (let k = 0; k < 3; k++) {
        const fx = hash2(k, 9) * 1024, fy = 140 + k * 330;
        wrap(1024, 1024, fx, fy, 260, (xx, yy) => {
          ctx.save(); ctx.translate(xx, yy); ctx.rotate(0.05);
          ctx.fillStyle = ['#c9a14a', '#9bbf5a', '#b98b3e'][k]; ctx.fillRect(-220, -70, 440, 140);
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3;
          for (let l = -210; l < 220; l += 16) { ctx.beginPath(); ctx.moveTo(l, -70); ctx.lineTo(l, 70); ctx.stroke(); }
          ctx.restore();
        });
      }
      // Camino de tierra
      ctx.strokeStyle = '#b5915e'; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(0, 600); ctx.bezierCurveTo(300, 520, 600, 700, 1024, 600); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.stroke();
      speckle(ctx, 0, 0, 1024, 1024, 5000, 'rgba(255,255,255,0.06)', 7, 2);
      speckle(ctx, 0, 0, 1024, 1024, 5000, 'rgba(0,40,0,0.08)', 8, 2);
      for (let i = 0; i < 140; i++) {
        const x = hash2(i, 11) * 1024, y = hash2(i, 12) * 1024;
        ctx.fillStyle = ['#ffd23f', '#ffffff', '#ff8fab'][i % 3];
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });
    tile(scene, 'sc_track', 256, 200, (ctx) => {
      ctx.fillStyle = '#8b8378'; ctx.fillRect(0, 20, 256, 160);
      speckle(ctx, 0, 20, 256, 160, 1400, 'rgba(0,0,0,0.2)', 3, 2.4);
      speckle(ctx, 0, 20, 256, 160, 900, 'rgba(255,255,255,0.15)', 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 20, 256, 6); ctx.fillRect(0, 174, 256, 6);
      for (let x = 8; x < 256; x += 32) { rr(ctx, x, 40, 18, 120, 3); fillStroke(ctx, '#6b4f35', INK, 1.5); }
      for (const y of [70, 128]) { ctx.fillStyle = '#4a4e57'; ctx.fillRect(0, y - 3, 256, 9); ctx.fillStyle = '#c9ced8'; ctx.fillRect(0, y - 3, 256, 3); }
    });
    tile(scene, 'sc_canopy', 1024, 512, (ctx) => {
      for (let i = 0; i < 26; i++) {
        const x = hash2(i, 21) * 1024, y = 40 + hash2(i, 22) * 432, r = 26 + hash2(i, 23) * 34;
        wrap(1024, 512, x, y, r + 30, (xx, yy) => {
          contactShadow(ctx, xx + 20, yy + 18, r * 1.1, r * 0.7, 0.35);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            ctx.beginPath(); ctx.arc(xx + Math.cos(a) * r * 0.45, yy + Math.sin(a) * r * 0.4, r * 0.6, 0, Math.PI * 2);
            fillStroke(ctx, k % 2 ? '#2d6a4f' : '#357a5a', INK, 2);
          }
          ctx.beginPath(); ctx.arc(xx - r * 0.2, yy - r * 0.25, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
        });
      }
      // Postes de catenaria
      for (let x = 60; x < 1024; x += 256) {
        contactShadow(ctx, x + 14, 470, 10, 5, 0.4);
        rr(ctx, x - 5, 420, 10, 54, 3); fillStroke(ctx, '#5c677d', INK, 1.6);
      }
    });
    tile(scene, 'sc_tunnel', 256, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, 'rgba(8,6,16,0)'); g.addColorStop(0.18, 'rgba(8,6,16,0.82)'); g.addColorStop(0.82, 'rgba(8,6,16,0.82)'); g.addColorStop(1, 'rgba(8,6,16,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
    });
  } else if (map === 'ship') {
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
  return map === 'train' ? 0x6a9a52 : map === 'ship' ? 0x1f78ad : map === 'plane' ? 0x8ec5ff : 0x2b2d42;
}

export { shade };
