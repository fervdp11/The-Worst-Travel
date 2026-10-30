import Phaser from 'phaser';
import type { AnimCode } from '../../shared/protocol';
import { CH_RES } from '../art/characters';
import { accessoryKey, accessoryPos, ACCESSORY_ANCHORS, AccessoryAnchor, RESP_HAT } from '../art/compose';

const S = 1 / CH_RES;
const STRIDE = 34; // unidades de mundo por ciclo de paso

export type CharKind = 'player' | 'ghost' | 'passenger' | 'responsible';

export interface CharLook {
  kind: CharKind;
  color: number;
  acc: number;
  name: string;
  variant?: number;
  map?: string;
}

/**
 * Personaje compuesto: sombra de contacto, pies, cuerpo, manos, accesorio y objeto.
 * La posición física es la del círculo de los pies; el balanceo es decorativo.
 */
export class Character {
  root: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private footL: Phaser.GameObjects.Image;
  private footR: Phaser.GameObjects.Image;
  private handL: Phaser.GameObjects.Image;
  private handR: Phaser.GameObjects.Image;
  private hat: Phaser.GameObjects.Image | null = null;
  private item: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  private phase = 0;
  private idleT = Math.random() * 10;
  private walkBlend = 0;
  private facing: 1 | -1 = 1;
  private facingVis = 1;
  look: CharLook;
  anim: AnimCode = 'idle';
  private lastX = 0;
  private lastY = 0;
  alpha = 1;
  targetAlpha = 1;
  seated = false;
  carrying = false;
  distort = false;
  /** Lleva una bolsa de compra cerrada (supermercado). */
  bag = false;
  /** 0 = fuera, 1 = dentro de trampilla/taquilla (lo fija la escena por evento, no por proximidad). */
  hidden = 0;
  hideKind: 'vent' | 'locker' = 'vent';
  /** Color local del nombre (solo el propio impostor ve el suyo en rojo). */
  nameColor: string | null = null;
  private act: string | null = null;
  private hatAnchor: AccessoryAnchor | null = null;

  constructor(private scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, look: CharLook) {
    this.look = look;
    this.shadow = scene.add.image(0, 0, 'ch_shadow').setScale(S);
    this.footL = scene.add.image(-7, -3, 'ch_foot').setScale(S);
    this.footR = scene.add.image(7, -3, 'ch_foot').setScale(S);
    this.body = scene.add.image(0, -3, this.bodyKey()).setScale(S).setOrigin(0.5, 1);
    this.handL = scene.add.image(-14, -16, 'ch_hand').setScale(S);
    this.handR = scene.add.image(14, -16, 'ch_hand').setScale(S);
    this.item = scene.add.image(18, -20, 'ch_tray').setScale(S).setVisible(false);
    this.fx = scene.add.image(0, -60, 'fx_zzz').setScale(S).setVisible(false);
    this.root = scene.add.container(0, 0, [this.shadow, this.footL, this.footR, this.body, this.handL, this.handR, this.item, this.fx]);
    this.setHat();
    this.nameText = scene.add.text(0, 0, look.name, {
      fontFamily: '"Baloo 2", "Nunito", sans-serif', fontSize: '28px', fontStyle: '700', color: '#ffffff',
      stroke: '#1d1830', strokeThickness: 7, resolution: 1,
    }).setOrigin(0.5, 1).setScale(0.5);
    if (look.kind === 'passenger') this.nameText.setVisible(false);
    if (look.kind === 'responsible') this.nameText.setColor('#ffd23f');
    layer.add(this.root);
    layer.add(this.nameText);
    if (look.kind === 'ghost') this.body.setTint(0xdfe7ff);
  }

  private bodyKey() {
    const l = this.look;
    if (l.kind === 'passenger') return `px_body_${(l.variant ?? 0) % 8}`;
    if (l.kind === 'responsible') return `resp_body_${l.map ?? 'ship'}`;
    if (l.kind === 'ghost') return `ch_ghost_${l.color}`;
    return `ch_body_${l.color}`;
  }

  private setHat() {
    if (this.hat) { this.hat.destroy(); this.hat = null; }
    const l = this.look;
    let key: string | null = null;
    this.hatAnchor = null;
    if (l.kind === 'responsible') { key = `resp_hat_${l.map ?? 'ship'}`; this.hatAnchor = RESP_HAT; }
    else if (l.kind === 'player' || l.kind === 'ghost') { key = accessoryKey(l.color, l.acc); this.hatAnchor = ACCESSORY_ANCHORS[l.acc] ?? null; }
    if (!key || !this.hatAnchor || !this.scene.textures.exists(key)) return;
    this.hat = this.scene.add.image(0, -40, key).setScale(S).setOrigin(0.5, 1);
    this.root.addAt(this.hat, 4);
  }

  setLook(look: CharLook) {
    const changed = look.color !== this.look.color || look.acc !== this.look.acc || look.kind !== this.look.kind;
    this.look = look;
    if (this.nameText.text !== look.name) this.nameText.setText(look.name);
    if (changed) {
      this.body.setTexture(this.bodyKey());
      this.setHat();
    }
  }

  moveToLayer(layer: Phaser.GameObjects.Layer) {
    layer.add(this.root);
    layer.add(this.nameText);
  }

  setActivity(act: string | null) {
    this.act = act;
  }

  /**
   * Actualiza la pose. `x,y` es la posición física interpolada. El ciclo de paso
   * avanza con la distancia recorrida: si no hay desplazamiento, los pies paran.
   */
  update(dtMs: number, x: number, y: number, facing: 1 | -1, anim: AnimCode, nowMs: number) {
    const dx = x - this.lastX, dy = y - this.lastY;
    const moved = Math.hypot(dx, dy);
    this.lastX = x; this.lastY = y;
    if (facing !== this.facing) this.facing = facing;
    this.facingVis += (this.facing - this.facingVis) * Math.min(1, dtMs / 70);
    const walking = moved > 0.15 && moved < 40 && (anim === 'walk' || anim === 'idle');
    this.walkBlend += ((walking ? 1 : 0) - this.walkBlend) * Math.min(1, dtMs / 90);
    if (walking) this.phase += (moved / STRIDE) * Math.PI * 2;
    this.idleT += dtMs / 1000;
    this.anim = anim;
    this.root.setPosition(x, y);
    this.root.setDepth(y + (this.seated ? 46 : 0));
    const sx = Math.abs(this.facingVis) < 0.15 ? 0.15 * Math.sign(this.facingVis || 1) : this.facingVis;
    const flip = sx < 0 ? -1 : 1;
    const w = this.walkBlend;
    const sinP = Math.sin(this.phase), cosP = Math.cos(this.phase);
    const breathe = Math.sin(this.idleT * 2.4) * 0.6 * (1 - w);
    const bob = -Math.abs(sinP) * 2.4 * w + breathe;
    // Pies
    const footSwing = 6 * w;
    const fl = { x: -7 + sinP * footSwing, y: -3 - Math.max(0, cosP) * 3 * w };
    const fr = { x: 7 - sinP * footSwing, y: -3 - Math.max(0, -cosP) * 3 * w };
    let bodyY = -3 + bob, bodyRot = sinP * 0.05 * w, scaleY = 1 + breathe * 0.008, scaleX = 1;
    let hl = { x: -15 + -sinP * 4 * w, y: -16 + bob }, hr = { x: 15 + sinP * 4 * w, y: -16 + bob };
    let itemKey: string | null = null, itemPos = { x: 0, y: 0 };
    let rootAlpha = 1;
    let hideFeet = false;
    const t = nowMs / 1000;
    switch (anim) {
      case 'task': case 'repair': case 'search': {
        const k = Math.sin(t * (anim === 'search' ? 9 : 7));
        hl = { x: 13, y: -22 + k * 3 }; hr = { x: 19, y: -19 - k * 3 };
        bodyRot = 0.06; bodyY = -3 + Math.abs(k) * 0.8;
        if (anim === 'repair') { itemKey = 'ch_tool'; itemPos = { x: 21, y: -20 - k * 3 }; }
        break;
      }
      case 'cams': hl = { x: 12, y: -22 }; hr = { x: 19, y: -22 }; itemKey = 'ch_tablet'; itemPos = { x: 17, y: -26 }; break;
      case 'pick': { hr = { x: 20, y: -30 }; hl = { x: 12, y: -24 }; bodyRot = 0.08; break; }
      case 'attack': { const k = Math.sin(t * 14); bodyRot = 0.12 + k * 0.08; hr = { x: 20 + k * 6, y: -22 }; hl = { x: 10 + k * 4, y: -20 }; bodyY = -3 - Math.abs(k) * 2; break; }
      case 'cast': { const k = Math.sin(t * 20); scaleX = 1 + k * 0.08; scaleY = 1 - k * 0.08; break; }
      case 'stopped': rootAlpha = 0.75; break;
      default: break;
    }
    if (this.seated) {
      hideFeet = true; bodyY = -1 + breathe * 0.5; hl = { x: 10, y: -14 }; hr = { x: 16, y: -14 };
      if (this.act === 'read') { itemKey = 'ch_book'; itemPos = { x: 15, y: -18 }; }
      if (this.act === 'phone') { itemKey = 'ch_phone'; itemPos = { x: 16, y: -24 }; hr = { x: 15, y: -22 }; }
      if (this.act === 'order') { hr = { x: 12, y: -40 + Math.sin(t * 3) * 3 }; }
    }
    if (this.carrying) { itemKey = 'ch_tray'; itemPos = { x: 16, y: -28 + bob }; hl = { x: 10, y: -24 + bob }; hr = { x: 22, y: -24 + bob }; }
    else if (this.bag && anim !== 'pick') { itemKey = 'ch_bag'; itemPos = { x: 20, y: -10 + bob }; hr = { x: 19, y: -18 + bob }; }
    // Entrar/salir de trampilla o taquilla: progreso único 0→1 dirigido por evento (sin bucles).
    const hk = this.hidden;
    let hideAll = false;
    if (hk > 0) {
      if (this.hideKind === 'vent') {
        // Se agacha y desciende por la tapa; el nombre desaparece cuando el cuerpo queda oculto.
        scaleY = 1 - hk * 0.75; scaleX = 1 + hk * 0.2; bodyY = -3 + hk * 22; hideFeet = hk > 0.3;
        hl = { x: -10, y: -10 + hk * 10 }; hr = { x: 10, y: -10 + hk * 10 };
      } else {
        // Da un paso hacia la puerta de la taquilla y se ocultan manos y complementos.
        bodyY = -3 - hk * 6; scaleX = 1 - hk * 0.25;
      }
      rootAlpha *= 1 - Math.max(0, hk - 0.55) / 0.45;
      hideAll = hk >= 0.98;
    }
    if (this.look.kind === 'ghost') { hideFeet = true; bodyY = -10 + Math.sin(t * 2) * 3; rootAlpha = 0.5; }
    this.footL.setPosition(fl.x * flip, fl.y).setVisible(!hideFeet);
    this.footR.setPosition(fr.x * flip, fr.y).setVisible(!hideFeet);
    this.body.setPosition(0, bodyY).setRotation(bodyRot * flip).setScale(S * scaleX * (sx < 0 ? -1 : 1) * Math.max(0.2, Math.abs(sx)), S * scaleY);
    this.handL.setPosition(hl.x * flip, hl.y).setVisible(!hideAll && hk < 0.6);
    this.handR.setPosition(hr.x * flip, hr.y).setVisible(!hideAll && hk < 0.6);
    if (this.hat && this.hatAnchor) {
      // Mismo anclaje que los retratos: el complemento sigue a la cabeza, ojos o cuello.
      const hp = accessoryPos(this.hatAnchor, bodyY, bodyRot, scaleY, flip as 1 | -1);
      this.hat.setPosition(hp.x, hp.y).setRotation(bodyRot * flip).setScale(S * (sx < 0 ? -1 : 1) * Math.max(0.2, Math.abs(sx)), S * scaleY).setVisible(!hideAll && hk < 0.7);
    }
    if (itemKey) { this.item.setTexture(itemKey).setVisible(true).setPosition(itemPos.x * flip, itemPos.y).setScale(S * flip, S); }
    else this.item.setVisible(false);
    this.shadow.setScale(S * (1 - 0.08 * Math.abs(sinP) * w), S);
    // Efectos de estado
    if (anim === 'stopped') { this.fx.setTexture('fx_zzz').setVisible(true).setPosition(14, -64 + Math.sin(t * 2) * 3); }
    else if (this.seated && this.act === 'sleep') { this.fx.setTexture('fx_zzz').setVisible(true).setPosition(14, -50 + Math.sin(t * 2) * 3); }
    else if (this.seated && this.act === 'talk' && Math.sin(t * 0.7 + this.idleT) > 0.4) { this.fx.setTexture('fx_dots').setVisible(true).setPosition(16, -54); }
    else if (this.seated && this.act === 'order') { this.fx.setTexture('fx_hand').setVisible(true).setPosition(0, -60); }
    else this.fx.setVisible(false);
    // Distorsión sutil (señuelo de cerca)
    if (this.distort) { rootAlpha *= 0.82 + Math.sin(t * 31) * 0.1; this.body.x += Math.sin(t * 47) * 1.2; }
    this.alpha += (this.targetAlpha - this.alpha) * Math.min(1, dtMs / 90);
    const a = this.alpha * rootAlpha;
    this.root.setAlpha(a);
    this.root.setVisible(a > 0.02);
    const nameY = y - 62 + (this.seated ? 10 : 0);
    if (this.nameColor && this.nameText.style.color !== this.nameColor) this.nameText.setColor(this.nameColor);
    this.nameText.setPosition(x, nameY).setDepth(1e7 + y).setAlpha(this.alpha).setVisible(this.alpha > 0.05 && this.look.kind !== 'passenger' && hk < 0.5);
    if (hideAll) this.root.setVisible(false);
  }

  destroy() {
    this.root.destroy();
    this.nameText.destroy();
  }
}
