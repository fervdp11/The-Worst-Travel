import type { MapId } from '../../shared/maps/types';
import { C, casing, Mat, MATS } from './kit';

export interface MgSink {
  send(part: number, ans: Record<string, unknown>): void;
  sfx(name: string): void;
}

/**
 * Base de minijuego: lienzo lógico de 720×440, puntero unificado (ratón y tacto),
 * partes confirmadas por el servidor y recuperación rápida tras un fallo.
 */
export abstract class MG {
  static W = 720;
  static H = 440;
  mat: Mat;
  t = 0;
  partT = 0;
  hint = '';
  busy = false;
  okFlash = 0;
  badFlash = 0;
  ptr = { x: 0, y: 0, down: false };

  constructor(protected sink: MgSink, public puzzle: any, public part: number, public theme: MapId) {
    this.mat = MATS[theme] ?? MATS.train;
  }

  /** Prepara el estado de la parte actual (también al reintentar). */
  init(): void {}
  abstract render(ctx: C, dt: number): void;
  down(_x: number, _y: number): void {}
  move(_x: number, _y: number): void {}
  up(_x: number, _y: number): void {}
  /** Arrastre relativo (giros de ruedas, palancas): delta en coordenadas lógicas. */
  dragBy(_dx: number, _dy: number): void {}

  frame(ctx: C, dt: number) {
    this.t += dt;
    this.partT += dt;
    ctx.clearRect(0, 0, MG.W, MG.H);
    casing(ctx, 6, 6, MG.W - 12, MG.H - 12, this.mat);
    this.render(ctx, dt);
    if (this.okFlash > 0) { ctx.fillStyle = `rgba(61,220,151,${this.okFlash * 0.35})`; ctx.fillRect(0, 0, MG.W, MG.H); this.okFlash = Math.max(0, this.okFlash - dt * 3); }
    if (this.badFlash > 0) { ctx.fillStyle = `rgba(255,77,94,${this.badFlash * 0.3})`; ctx.fillRect(0, 0, MG.W, MG.H); this.badFlash = Math.max(0, this.badFlash - dt * 3); }
  }

  protected submit(ans: Record<string, unknown>) {
    if (this.busy) return;
    this.busy = true;
    this.sink.send(this.part, ans);
  }

  onOk(done: boolean) {
    this.busy = false;
    this.okFlash = 1;
    this.sink.sfx(done ? 'task' : 'ok');
    if (!done) { this.part++; this.partT = 0; this.init(); }
  }

  onBad() {
    this.busy = false;
    this.badFlash = 1;
    this.sink.sfx('bad');
    this.partT = 0;
    this.init();
  }
}

export type MGCtor = new (sink: MgSink, puzzle: any, part: number, theme: MapId) => MG;
