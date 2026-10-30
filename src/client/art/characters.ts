import Phaser from 'phaser';
import { COLORS, ACCESSORIES } from '../../shared/constants';
import { contactShadow, fillStroke, makeCanvas, rr, star, vgrad } from './draw';
import { INK, shade } from './palette';

/** Resolución de dibujo de personajes (siempre nítidos al ampliar la cámara). */
export const CH_RES = 3;
export const BODY_W = 44;
export const BODY_H = 50;

const SKIN = ['#f2c9a0', '#e0ac7e', '#c68a5c', '#9b6a45', '#f6d7b8', '#d99c6c'];

function canvasFor(w: number, h: number) {
  const c = makeCanvas(w * CH_RES, h * CH_RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(CH_RES, CH_RES);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { c, ctx };
}

function bodyPath(ctx: CanvasRenderingContext2D, cx: number, bottom: number, w: number, h: number) {
  // Cuerpo en forma de judía redondeada.
  const top = bottom - h;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, bottom - h * 0.32);
  ctx.bezierCurveTo(cx - w * 0.52, top + h * 0.18, cx - w * 0.3, top, cx, top);
  ctx.bezierCurveTo(cx + w * 0.32, top, cx + w * 0.53, top + h * 0.2, cx + w * 0.5, bottom - h * 0.3);
  ctx.bezierCurveTo(cx + w * 0.5, bottom - h * 0.04, cx + w * 0.3, bottom, cx, bottom);
  ctx.bezierCurveTo(cx - w * 0.3, bottom, cx - w * 0.5, bottom - h * 0.06, cx - w * 0.5, bottom - h * 0.32);
  ctx.closePath();
}

function drawMark(ctx: CanvasRenderingContext2D, mark: string, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = shade(color, -0.4);
  ctx.lineWidth = 0.8;
  switch (mark) {
    case 'star': star(ctx, x, y, s); ctx.fill(); ctx.stroke(); break;
    case 'stripe': ctx.fillRect(x - s * 1.6, y - s * 0.35, s * 3.2, s * 0.7); break;
    case 'dot': ctx.beginPath(); ctx.arc(x, y, s * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'cross': ctx.fillRect(x - s * 0.3, y - s, s * 0.6, s * 2); ctx.fillRect(x - s, y - s * 0.3, s * 2, s * 0.6); break;
    case 'diamond': ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'moon': ctx.beginPath(); ctx.arc(x, y, s, 0.4, Math.PI * 2 - 0.4); ctx.arc(x + s * 0.45, y, s * 0.7, Math.PI * 2 - 0.6, 0.6, true); ctx.closePath(); ctx.fill(); break;
    case 'heart': ctx.beginPath(); ctx.moveTo(x, y + s * 0.9); ctx.bezierCurveTo(x - s * 1.5, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.5, y - s * 0.2, x, y + s * 0.9); ctx.fill(); break;
    case 'bolt': ctx.beginPath(); ctx.moveTo(x + s * 0.3, y - s); ctx.lineTo(x - s * 0.6, y + s * 0.15); ctx.lineTo(x, y + s * 0.15); ctx.lineTo(x - s * 0.3, y + s); ctx.lineTo(x + s * 0.6, y - s * 0.15); ctx.lineTo(x, y - s * 0.15); ctx.closePath(); ctx.fill(); break;
    case 'leaf': ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'drop': ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s, y + s * 0.2, x, y + s * 0.9); ctx.quadraticCurveTo(x - s, y + s * 0.2, x, y - s); ctx.fill(); break;
    case 'ring': ctx.lineWidth = s * 0.45; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, Math.PI * 2); ctx.stroke(); break;
    case 'triangle': ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
  }
}

interface BodyStyle {
  jacket: string;
  jacketDark: string;
  skin: string;
  mark?: string;
  markColor?: string;
  collar?: string;
  buttons?: boolean;
  tie?: string;
  civilian?: boolean;
  hair?: string;
}

/** Cuerpo mirando a la derecha. Origen del sprite: centro inferior. */
function drawBody(st: BodyStyle) {
  const W = BODY_W, H = BODY_H;
  const { c, ctx } = canvasFor(W, H);
  const cx = W / 2, bottom = H - 2, bw = 34, bh = 42;
  // Silueta y uniforme
  ctx.save();
  bodyPath(ctx, cx, bottom, bw, bh);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, bottom - bh, bottom, shade(st.jacket, 0.15), st.jacketDark);
  ctx.fillRect(0, 0, W, H);
  // Cara (mitad superior)
  const faceY = bottom - bh;
  ctx.fillStyle = vgrad(ctx, faceY, faceY + 22, shade(st.skin, 0.1), st.skin);
  ctx.beginPath();
  ctx.ellipse(cx + 3, faceY + 12, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  if (st.hair) {
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.ellipse(cx - 2, faceY + 2, 18, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cuello del uniforme
  ctx.fillStyle = st.collar ?? '#f4f1e8';
  ctx.beginPath();
  ctx.moveTo(cx - 12, faceY + 23);
  ctx.lineTo(cx + 4, faceY + 27);
  ctx.lineTo(cx + 18, faceY + 21);
  ctx.lineTo(cx + 18, faceY + 25);
  ctx.lineTo(cx + 4, faceY + 31);
  ctx.lineTo(cx - 14, faceY + 26);
  ctx.closePath();
  ctx.fill();
  if (st.tie) {
    ctx.fillStyle = st.tie;
    ctx.beginPath();
    ctx.moveTo(cx + 3, faceY + 28); ctx.lineTo(cx + 7, faceY + 29); ctx.lineTo(cx + 6, faceY + 37); ctx.lineTo(cx + 4, faceY + 39); ctx.lineTo(cx + 2, faceY + 37);
    ctx.closePath(); ctx.fill();
  }
  if (st.buttons) {
    ctx.fillStyle = '#e8c15a';
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(cx + 10, faceY + 32 + i * 5, 1.3, 0, Math.PI * 2); ctx.fill(); }
  }
  // Sombra lateral para volumen (luz desde el noroeste)
  const side = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  side.addColorStop(0, 'rgba(0,0,0,0.18)');
  side.addColorStop(0.35, 'rgba(0,0,0,0)');
  side.addColorStop(0.75, 'rgba(255,255,255,0.0)');
  side.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Distintivo bordado
  if (st.mark) drawMark(ctx, st.mark, cx - 6, bottom - 11, 3.3, st.markColor ?? '#fff');
  // Contorno
  bodyPath(ctx, cx, bottom, bw, bh);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Ojos y boca (expresivos)
  const ey = faceY + 12;
  for (const ex of [cx + 4, cx + 12]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.4, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 0.8, ey - 1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx + 9, ey + 4, 2.6, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.35)';
  ctx.beginPath(); ctx.arc(cx + 15.5, ey + 4, 2.2, 0, Math.PI * 2); ctx.fill();
  // brillo
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx - 7, faceY + 7, 4, 2.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawAccessory(id: number, color: string) {
  const { c, ctx } = canvasFor(44, 30);
  const cx = 22, by = 26;
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  switch (id) {
    case 0: { // gorra de revisor
      rr(ctx, cx - 14, by - 13, 28, 12, 5); fillStroke(ctx, vgrad(ctx, by - 13, by, '#2e3a59', '#1d2640'));
      ctx.fillStyle = '#d9a441'; ctx.fillRect(cx - 13, by - 6, 26, 2.5);
      rr(ctx, cx - 4, by - 4, 22, 5, 2.5); fillStroke(ctx, '#151b2e');
      ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(cx + 4, by - 9, 2.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 1: { // boina marinera
      ctx.beginPath(); ctx.ellipse(cx, by - 6, 16, 7, 0, 0, Math.PI * 2); fillStroke(ctx, '#f4f6fa');
      ctx.fillStyle = '#1f3d73'; ctx.fillRect(cx - 14, by - 4, 28, 3);
      ctx.beginPath(); ctx.arc(cx, by - 13, 3, 0, Math.PI * 2); fillStroke(ctx, '#e63946', INK, 1.5);
      break;
    }
    case 2: { // gorro de piloto
      rr(ctx, cx - 15, by - 14, 30, 12, 5); fillStroke(ctx, vgrad(ctx, by - 14, by, '#2b3a55', '#1b2638'));
      rr(ctx, cx - 6, by - 4, 22, 5, 2.5); fillStroke(ctx, '#111827');
      ctx.fillStyle = '#e8c15a';
      ctx.beginPath(); ctx.moveTo(cx - 8, by - 9); ctx.lineTo(cx, by - 11); ctx.lineTo(cx + 8, by - 9); ctx.lineTo(cx, by - 7); ctx.closePath(); ctx.fill();
      break;
    }
    case 3: { // sombrero de copa
      rr(ctx, cx - 9, by - 24, 18, 20, 3); fillStroke(ctx, vgrad(ctx, by - 24, by, '#3b3f4a', '#1d1f26'));
      ctx.fillStyle = color; ctx.fillRect(cx - 9, by - 9, 18, 3);
      rr(ctx, cx - 15, by - 5, 30, 5, 2.5); fillStroke(ctx, '#1d1f26');
      break;
    }
    case 4: { // gorro de lana
      ctx.beginPath(); ctx.arc(cx, by - 3, 14, Math.PI, 0); ctx.closePath(); fillStroke(ctx, vgrad(ctx, by - 17, by, shade(color, 0.2), color));
      ctx.fillStyle = shade(color, -0.25); ctx.fillRect(cx - 14, by - 5, 28, 4);
      ctx.beginPath(); ctx.arc(cx, by - 18, 4, 0, Math.PI * 2); fillStroke(ctx, '#f4f1e8', INK, 1.6);
      break;
    }
    case 5: { // flor en la gorra
      rr(ctx, cx - 14, by - 12, 28, 11, 5); fillStroke(ctx, '#3a5a40');
      rr(ctx, cx - 4, by - 4, 21, 5, 2.5); fillStroke(ctx, '#243c2a');
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx - 8 + Math.cos(a) * 3.5, by - 14 + Math.sin(a) * 3.5, 2.6, 0, Math.PI * 2); fillStroke(ctx, '#ff8fab', INK, 1); }
      ctx.beginPath(); ctx.arc(cx - 8, by - 14, 2, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill();
      break;
    }
    case 6: { // auriculares
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx + 2, by + 2, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      rr(ctx, cx - 16, by - 4, 7, 11, 3); fillStroke(ctx, color);
      rr(ctx, cx + 13, by - 4, 7, 11, 3); fillStroke(ctx, color);
      break;
    }
    case 7: { // pajarita (va en el cuello, se dibuja abajo)
      ctx.beginPath(); ctx.moveTo(cx, by + 1); ctx.lineTo(cx - 8, by - 4); ctx.lineTo(cx - 8, by + 6); ctx.closePath(); fillStroke(ctx, color, INK, 1.5);
      ctx.beginPath(); ctx.moveTo(cx, by + 1); ctx.lineTo(cx + 8, by - 4); ctx.lineTo(cx + 8, by + 6); ctx.closePath(); fillStroke(ctx, color, INK, 1.5);
      ctx.beginPath(); ctx.arc(cx, by + 1, 2.2, 0, Math.PI * 2); fillStroke(ctx, shade(color, -0.3), INK, 1);
      break;
    }
    case 8: { // gafas de sol
      ctx.fillStyle = '#111827';
      rr(ctx, cx - 4, by - 6, 9, 6, 2.5); fillStroke(ctx, '#111827', INK, 1.2);
      rr(ctx, cx + 7, by - 6, 9, 6, 2.5); fillStroke(ctx, '#111827', INK, 1.2);
      ctx.beginPath(); ctx.moveTo(cx + 5, by - 4); ctx.lineTo(cx + 7, by - 4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx - 2, by - 5, 3, 1.5); ctx.fillRect(cx + 9, by - 5, 3, 1.5);
      break;
    }
    default: break;
  }
  return c;
}

function simple(w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) {
  const { c, ctx } = canvasFor(w, h);
  fn(ctx);
  return c;
}

/** Gorros del responsable del viaje según el vehículo. */
function respHat(kind: 'train' | 'ship' | 'plane') {
  return simple(44, 30, (ctx) => {
    const cx = 22, by = 26;
    if (kind === 'ship') {
      rr(ctx, cx - 15, by - 14, 30, 12, 5); fillStroke(ctx, '#f8f9fb');
      rr(ctx, cx - 5, by - 4, 22, 5, 2.5); fillStroke(ctx, '#111827');
      ctx.fillStyle = '#e8c15a'; ctx.fillRect(cx - 14, by - 6, 28, 2);
      star(ctx, cx, by - 10, 3.2); ctx.fill();
    } else if (kind === 'plane') {
      rr(ctx, cx - 15, by - 14, 30, 12, 5); fillStroke(ctx, '#1b2638');
      rr(ctx, cx - 5, by - 4, 22, 5, 2.5); fillStroke(ctx, '#0b1220');
      ctx.fillStyle = '#e8c15a'; ctx.fillRect(cx - 14, by - 6, 28, 2);
      ctx.beginPath(); ctx.moveTo(cx - 9, by - 10); ctx.lineTo(cx, by - 12); ctx.lineTo(cx + 9, by - 10); ctx.lineTo(cx, by - 8); ctx.closePath(); ctx.fill();
    } else {
      rr(ctx, cx - 15, by - 14, 30, 12, 5); fillStroke(ctx, '#20294a');
      ctx.fillStyle = '#d62828'; ctx.fillRect(cx - 14, by - 7, 28, 3.5);
      rr(ctx, cx - 5, by - 4, 22, 5, 2.5); fillStroke(ctx, '#111827');
      ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(cx + 2, by - 10, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  });
}

export const PASSENGER_STYLES: BodyStyle[] = [
  { jacket: '#5e8c61', jacketDark: '#3d5c3f', skin: SKIN[0], hair: '#5a3b24', civilian: true, collar: '#e9e2cf' },
  { jacket: '#c06c84', jacketDark: '#874a5d', skin: SKIN[2], hair: '#2b1d14', civilian: true, collar: '#f2e9e4' },
  { jacket: '#6c757d', jacketDark: '#495057', skin: SKIN[4], hair: '#c9a66b', civilian: true, collar: '#dee2e6' },
  { jacket: '#e9c46a', jacketDark: '#b08f3f', skin: SKIN[3], hair: '#1b1b1b', civilian: true, collar: '#fff8e1' },
  { jacket: '#457b9d', jacketDark: '#2c5470', skin: SKIN[1], hair: '#8d5524', civilian: true, collar: '#f1faee' },
  { jacket: '#9d4edd', jacketDark: '#6a2fa0', skin: SKIN[5], hair: '#3c2a1e', civilian: true, collar: '#efe6fb' },
  { jacket: '#f4a261', jacketDark: '#b9733c', skin: SKIN[0], hair: '#bfbfbf', civilian: true, collar: '#fff3e0' },
  { jacket: '#2a9d8f', jacketDark: '#1c6b61', skin: SKIN[2], hair: '#4a2c1a', civilian: true, collar: '#e8f6f3' },
];

export function generateCharacterTextures(scene: Phaser.Scene) {
  const T = scene.textures;
  const add = (key: string, c: HTMLCanvasElement) => { if (!T.exists(key)) T.addCanvas(key, c); };
  COLORS.forEach((col, i) => {
    add(`ch_body_${i}`, drawBody({ jacket: col.hex, jacketDark: col.dark, skin: SKIN[i % SKIN.length], mark: col.mark, markColor: i === 8 ? '#2f6fe0' : '#fff', buttons: true, tie: i === 0 ? '#1d3557' : '#d62828' }));
    add(`ch_ghost_${i}`, drawBody({ jacket: col.hex, jacketDark: col.dark, skin: '#dfe7ff', mark: col.mark, markColor: '#fff' }));
  });
  PASSENGER_STYLES.forEach((s, i) => add(`px_body_${i}`, drawBody(s)));
  add('resp_body_train', drawBody({ jacket: '#20294a', jacketDark: '#121a33', skin: SKIN[1], buttons: true, tie: '#d62828', mark: 'star', markColor: '#e8c15a' }));
  add('resp_body_ship', drawBody({ jacket: '#f3f4f7', jacketDark: '#c9ced8', skin: SKIN[3], buttons: true, tie: '#20375c', mark: 'star', markColor: '#e8c15a', collar: '#20375c' }));
  add('resp_body_plane', drawBody({ jacket: '#1b2638', jacketDark: '#0e1624', skin: SKIN[2], buttons: true, tie: '#0b1220', mark: 'diamond', markColor: '#e8c15a' }));
  add('resp_hat_train', respHat('train'));
  add('resp_hat_ship', respHat('ship'));
  add('resp_hat_plane', respHat('plane'));
  ACCESSORIES.forEach((a, i) => COLORS.forEach((col, ci) => { if (i === 3 || i === 4 || i === 6 || i === 7) add(`ch_acc_${i}_${ci}`, drawAccessory(i, col.hex)); }));
  ACCESSORIES.forEach((a, i) => { if (!(i === 3 || i === 4 || i === 6 || i === 7)) add(`ch_acc_${i}`, drawAccessory(i, '#888')); });
  add('ch_hand', simple(10, 10, (ctx) => { ctx.beginPath(); ctx.arc(5, 5, 3.6, 0, Math.PI * 2); fillStroke(ctx, '#f7f5ef', INK, 1.6); }));
  add('ch_foot', simple(14, 10, (ctx) => { ctx.beginPath(); ctx.ellipse(7, 5, 5.5, 3.6, 0, 0, Math.PI * 2); fillStroke(ctx, '#2b2d42', INK, 1.6); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(4, 3, 4, 1.2); }));
  add('ch_shadow', simple(40, 16, (ctx) => contactShadow(ctx, 20, 8, 17, 6, 0.42)));
  add('ch_tray', simple(30, 16, (ctx) => {
    ctx.beginPath(); ctx.ellipse(15, 11, 13, 4, 0, 0, Math.PI * 2); fillStroke(ctx, '#c0c8d4', INK, 1.4);
    ctx.beginPath(); ctx.arc(10, 8, 4, Math.PI, 0); fillStroke(ctx, '#f4f1e8', INK, 1.2);
    rr(ctx, 16, 3, 6, 7, 1.5); fillStroke(ctx, '#ff9f43', INK, 1.2);
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(10, 6, 1.6, 0, Math.PI * 2); ctx.fill();
  }));
  add('ch_tool', simple(20, 10, (ctx) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(3, 7); ctx.lineTo(14, 4); ctx.stroke();
    ctx.strokeStyle = '#aeb6c4'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(15.5, 3.6, 3, 0, Math.PI * 2); fillStroke(ctx, '#aeb6c4', INK, 1.3);
  }));
  add('ch_tablet', simple(16, 14, (ctx) => {
    rr(ctx, 1, 1, 14, 11, 2); fillStroke(ctx, '#273043', INK, 1.4);
    ctx.fillStyle = '#5cc8ff'; ctx.fillRect(3, 3, 10, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(3, 3, 10, 2);
  }));
  add('ch_book', simple(16, 12, (ctx) => { rr(ctx, 1, 1, 14, 10, 1.5); fillStroke(ctx, '#bc4749', INK, 1.3); ctx.fillStyle = '#f4f1e8'; ctx.fillRect(8, 2, 6, 8); }));
  add('ch_phone', simple(10, 14, (ctx) => { rr(ctx, 1, 1, 8, 12, 2); fillStroke(ctx, '#111827', INK, 1.2); ctx.fillStyle = '#9ad1ff'; ctx.fillRect(2.5, 2.5, 5, 8); }));
  add('fx_ring', simple(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 10, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 31, 0, Math.PI * 2); ctx.fill();
  }));
  add('fx_puff', simple(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(235,235,245,0.6)'); g.addColorStop(1, 'rgba(235,235,245,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
  }));
  add('fx_spark', simple(16, 16, (ctx) => { ctx.fillStyle = '#fff6b0'; star(ctx, 8, 8, 7, 4); ctx.fill(); }));
  add('fx_light', simple(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  }));
  add('fx_zzz', simple(20, 20, (ctx) => { ctx.font = '900 12px "Baloo 2", sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('z', 4, 14); ctx.fillText('z', 4, 14); }));
  add('fx_dots', simple(26, 16, (ctx) => { rr(ctx, 1, 1, 24, 13, 6); fillStroke(ctx, '#fff', INK, 1.4); ctx.fillStyle = INK; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(7 + i * 6, 7.5, 1.6, 0, Math.PI * 2); ctx.fill(); } }));
  add('fx_hand', simple(16, 18, (ctx) => { rr(ctx, 1, 1, 14, 16, 6); fillStroke(ctx, '#fff', INK, 1.4); ctx.font = '900 11px sans-serif'; ctx.fillStyle = '#ff8a3d'; ctx.textAlign = 'center'; ctx.fillText('!', 8, 13); }));
}
