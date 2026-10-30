import Phaser from 'phaser';
import { makeCanvas } from './draw';

/**
 * Empaquetador de estanterías: agrupa muchos dibujos pequeños en pocas páginas
 * de textura para que el renderizador agrupe las llamadas de dibujo.
 */
export class AtlasBuilder {
  private pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; x: number; y: number; rowH: number; frames: { name: string; x: number; y: number; w: number; h: number }[] }[] = [];
  constructor(private key: string, private size = 2048) {}

  add(name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    const pw = Math.ceil(w) + 2, ph = Math.ceil(h) + 2;
    let page = this.pages[this.pages.length - 1] ?? this.newPage(Math.max(pw, ph));
    if (page.x + pw > page.canvas.width) { page.x = 0; page.y += page.rowH; page.rowH = 0; }
    if (page.y + ph > page.canvas.height || pw > page.canvas.width) page = this.newPage(Math.max(pw, ph));
    page.ctx.save();
    page.ctx.translate(page.x + 1, page.y + 1);
    page.ctx.beginPath(); page.ctx.rect(0, 0, w, h); page.ctx.clip();
    draw(page.ctx);
    page.ctx.restore();
    page.frames.push({ name, x: page.x + 1, y: page.y + 1, w: Math.ceil(w), h: Math.ceil(h) });
    page.x += pw;
    page.rowH = Math.max(page.rowH, ph);
  }

  private newPage(minSize: number) {
    const s = Math.max(this.size, minSize);
    const canvas = makeCanvas(s, s);
    const p = { canvas, ctx: canvas.getContext('2d')!, x: 0, y: 0, rowH: 0, frames: [] as { name: string; x: number; y: number; w: number; h: number }[] };
    this.pages.push(p);
    return p;
  }

  /** Registra las páginas en Phaser. Devuelve nombre de marco → [clave de textura, marco]. */
  commit(scene: Phaser.Scene): Map<string, [string, string]> {
    const map = new Map<string, [string, string]>();
    this.pages.forEach((p, i) => {
      const key = `${this.key}_${i}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.addCanvas(key, p.canvas)!;
      for (const f of p.frames) {
        tex.add(f.name, 0, f.x, f.y, f.w, f.h);
        map.set(f.name, [key, f.name]);
      }
    });
    return map;
  }

  keys(): string[] {
    return this.pages.map((_, i) => `${this.key}_${i}`);
  }
}
