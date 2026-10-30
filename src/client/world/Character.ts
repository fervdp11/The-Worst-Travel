import Phaser from 'phaser';
import type { AnimCode } from '../../shared/protocol';
import { CH_RES } from '../art/characters';

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
  private act: string | null = null;

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
    if (l.kind === 'responsible') return `resp_body_${l.map ?? 'train'}`;
    if (l.kind === 'ghost') return `ch_ghost_${l.color}`;
    return `ch_body_${l.color}`;
  }

  private setHat() {
    if (this.hat) { this.hat.destroy(); this.hat = null; }
    const l = this.look;
    let key: string | null = null;
    if (l.kind === 'responsible') key = `resp_hat_${l.map ?? 'train'}`;
    else if (l.kind === 'player' || l.kind === 'ghost') {
      if (l.acc === 9) key = null;
      else if ([3, 4, 6, 7].includes(l.acc)) key = `ch_acc_${l.acc}_${l.color}`;
      else key = `ch_acc_${l.acc}`;
    }
    if (!key || !this.scene.textures.exists(key)) return;
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
      case 'climb': { const k = Math.sin(t * 12); hl = { x: -8, y: -40 + k * 6 }; hr = { x: 8, y: -40 - k * 6 }; bodyY = -6 - Math.abs(k) * 3; break; }
      case 'ventIn': case 'ventOut': { const k = anim === 'ventIn' ? Math.min(1, (t * 3) % 1.2) : 1 - Math.min(1, (t * 3) % 1.2); scaleY = 1 - k * 0.6; scaleX = 1 + k * 0.25; bodyY = -3 + k * 18; hideFeet = k > 0.5; break; }
      case 'lockerIn': case 'lockerOut': rootAlpha = 0.6; scaleX = 0.9; break;
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
    if (this.carrying && anim !== 'climb') { itemKey = 'ch_tray'; itemPos = { x: 16, y: -28 + bob }; hl = { x: 10, y: -24 + bob }; hr = { x: 22, y: -24 + bob }; }
    if (this.look.kind === 'ghost') { hideFeet = true; bodyY = -10 + Math.sin(t * 2) * 3; rootAlpha = 0.5; }
    this.footL.setPosition(fl.x * flip, fl.y).setVisible(!hideFeet);
    this.footR.setPosition(fr.x * flip, fr.y).setVisible(!hideFeet);
    this.body.setPosition(0, bodyY).setRotation(bodyRot * flip).setScale(S * scaleX * (sx < 0 ? -1 : 1) * Math.max(0.2, Math.abs(sx)), S * scaleY);
    this.handL.setPosition(hl.x * flip, hl.y);
    this.handR.setPosition(hr.x * flip, hr.y);
    if (this.hat) {
      const hatY = bodyY - 40 * scaleY;
      this.hat.setPosition(Math.sin(bodyRot) * 30 * flip + 2 * flip, hatY + (this.look.acc === 7 ? 22 : this.look.acc === 8 ? 10 : 0)).setRotation(bodyRot * flip).setScale(S * (sx < 0 ? -1 : 1), S);
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
    this.nameText.setPosition(x, nameY).setDepth(1e7 + y).setAlpha(this.alpha).setVisible(this.alpha > 0.05 && this.look.kind !== 'passenger');
  }

  destroy() {
    this.root.destroy();
    this.nameText.destroy();
  }
}
