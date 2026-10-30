import type Phaser from 'phaser';
import { makeCanvas } from '../art/draw';
import { idleParts } from '../art/compose';

let texSource: Phaser.Textures.TextureManager | null = null;
export function setPortraitTextures(t: Phaser.Textures.TextureManager) { texSource = t; cache.clear(); }

function src(key: string): CanvasImageSource | null {
  if (!texSource || !texSource.exists(key)) return null;
  return texSource.get(key).getSourceImage() as CanvasImageSource;
}

interface PortraitOpts { ghost?: boolean; resp?: string; flip?: boolean }

/** Retratos cacheados por configuración de aspecto y tamaño (no se recompone por mensaje). */
const cache = new Map<string, HTMLCanvasElement>();

/** Retrato con el MISMO compositor que el personaje del mundo, en pose de reposo. */
export function portrait(color: number, acc: number, size = 64, opts: PortraitOpts = {}): HTMLCanvasElement {
  const key = `${color}|${acc}|${size}|${opts.ghost ? 1 : 0}|${opts.resp ?? ''}|${opts.flip ? 1 : 0}`;
  let base = cache.get(key);
  if (!base) {
    base = makeCanvas(size * 2, size * 2);
    drawPortrait(base, color, acc, opts);
    // Solo se cachea cuando las texturas ya existen.
    if (texSource) cache.set(key, base);
  }
  const c = makeCanvas(size * 2, size * 2);
  c.getContext('2d')!.drawImage(base, 0, 0);
  return c;
}

/**
 * Dibuja el personaje compuesto en un lienzo cuadrado. El punto de apoyo queda
 * centrado abajo y la escala es uniforme (64 u de mundo = ancho del lienzo).
 */
export function drawPortrait(c: HTMLCanvasElement, color: number, acc: number, opts: PortraitOpts = {}) {
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  const scale = c.width / 64;
  ctx.save();
  if (opts.flip) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.scale(scale, scale);
  ctx.translate(32, 60);
  for (const p of idleParts({ color, acc, ghost: opts.ghost, resp: opts.resp })) {
    const img = src(p.key);
    if (!img) continue;
    const x = p.x - p.w / 2;
    const y = p.origin === 'bottom' ? p.y - p.h : p.y - p.h / 2;
    if (opts.ghost && p.key.startsWith('ch_ghost')) ctx.globalAlpha = 0.75;
    ctx.drawImage(img, x, y, p.w, p.h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
