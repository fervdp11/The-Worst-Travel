import type Phaser from 'phaser';
import { makeCanvas } from '../art/draw';

let texSource: Phaser.Textures.TextureManager | null = null;
export function setPortraitTextures(t: Phaser.Textures.TextureManager) { texSource = t; }

function src(key: string): CanvasImageSource | null {
  if (!texSource || !texSource.exists(key)) return null;
  return texSource.get(key).getSourceImage() as CanvasImageSource;
}

/** Retrato a partir de las mismas texturas del personaje (sin dibujar arte nuevo). */
export function portrait(color: number, acc: number, size = 64, opts: { ghost?: boolean; resp?: string; flip?: boolean } = {}): HTMLCanvasElement {
  const c = makeCanvas(size * 2, size * 2);
  drawPortrait(c, color, acc, opts);
  return c;
}

export function drawPortrait(c: HTMLCanvasElement, color: number, acc: number, opts: { ghost?: boolean; resp?: string; flip?: boolean } = {}) {
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  const scale = c.width / 64;
  ctx.save();
  if (opts.flip) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.scale(scale, scale);
  const body = src(opts.resp ? `resp_body_${opts.resp}` : opts.ghost ? `ch_ghost_${color}` : `ch_body_${color}`);
  const shadow = src('ch_shadow');
  if (shadow) ctx.drawImage(shadow, 12, 52, 40, 16);
  const foot = src('ch_foot');
  if (foot && !opts.ghost) { ctx.drawImage(foot, 18, 54, 14, 10); ctx.drawImage(foot, 32, 54, 14, 10); }
  if (body) ctx.drawImage(body, 10, 6, 44, 50);
  const hand = src('ch_hand');
  if (hand) { ctx.drawImage(hand, 6, 36, 10, 10); ctx.drawImage(hand, 48, 36, 10, 10); }
  let hatKey: string | null = null;
  if (opts.resp) hatKey = `resp_hat_${opts.resp}`;
  else if (acc !== 9) hatKey = [3, 4, 6, 7].includes(acc) ? `ch_acc_${acc}_${color}` : `ch_acc_${acc}`;
  const hat = hatKey ? src(hatKey) : null;
  if (hat) ctx.drawImage(hat, 10, acc === 7 && !opts.resp ? 18 : acc === 8 && !opts.resp ? 6 : -4, 44, 30);
  ctx.restore();
}
