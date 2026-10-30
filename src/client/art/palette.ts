/**
 * GUÍA DE ARTE — The Worst Travel
 * - Contorno: tinta violácea INK, 2,5 u en personajes y 2 u en mobiliario.
 * - Luz principal desde el noroeste: caras superiores claras, frontales medias,
 *   sombras proyectadas hacia el sureste con desplazamiento (6, 4) y alfa 0,22.
 * - Muros: tapa superior de 14 u + cara frontal de 42 u dentro del propio grosor.
 * - Personaje: cuerpo 34 × 40 u; con gorra ≈ 54 u de alto. Colisión: círculo de 12 u en los pies.
 * - Tipografías: Baloo 2 (títulos, rótulos) y Nunito (texto).
 * - Tren: tapicería burdeos/verde azulado, latón y madera cálida; técnicos en acero frío.
 * - Barco: madera pintada crema, acero gris azulado, rojo náutico, teca húmeda y mar.
 * - Avión: paneles claros, plásticos gris perla, aluminio y luz indirecta azulada.
 */
export const INK = '#1d1830';
export const INK_SOFT = 'rgba(29,24,48,0.55)';
export const SHADOW = 'rgba(20,14,40,0.24)';
export const LIGHT_DIR = { x: 6, y: 4 };

export interface MapPalette {
  floor: Record<string, [string, string]>;
  wallFace: Record<string, [string, string]>;
  wallTop: string;
  hull: string;
  hullDark: string;
  trim: string;
  metal: string;
  metalDark: string;
  wood: string;
  woodDark: string;
  fabric: string;
  fabricAlt: string;
  glass: string;
  accent: string;
  warmLight: string;
  coldLight: string;
}

const FLOORS_BASE: Record<string, [string, string]> = {
  carpet: ['#6a3a52', '#5b3046'],
  wood: ['#b07a4a', '#9a6a40'],
  parquet: ['#b98552', '#a2723f'],
  metal: ['#7c8796', '#6b7584'],
  grate: ['#5d6674', '#4f5764'],
  tile: ['#d9dde3', '#c3c9d1'],
  lino: ['#9fb2c4', '#8ea2b5'],
  deck: ['#c08a55', '#a97848'],
  roof: ['#7e8794', '#6d7683'],
  checker: ['#e8dcc8', '#4a4e69'],
  rubber: ['#3f4654', '#363c48'],
  concrete: ['#8a8f96', '#7c8188'],
  cabin: ['#7f5a83', '#6d4c71'],
};

export const PALETTES: Record<string, MapPalette> = {
  train: {
    floor: { ...FLOORS_BASE, carpet: ['#7a2e3a', '#6a2733'], lino: ['#8fa3a3', '#7e9292'] },
    wallFace: { warm: ['#e3cfa8', '#c9b28a'], cold: ['#b8c4cf', '#9fadba'], neutral: ['#d8ccb8', '#bfb29c'], dim: ['#c9b79c', '#ab9a80'], exterior: ['#9aa5b1', '#7e8996'] },
    wallTop: '#3a2b33', hull: '#7a2e3a', hullDark: '#4d1a25', trim: '#d9a441', metal: '#8d99ae', metalDark: '#5f6b7e',
    wood: '#a0663b', woodDark: '#6e4325', fabric: '#2a6f6f', fabricAlt: '#7a2e3a', glass: '#9fd3ea', accent: '#d9a441',
    warmLight: 'rgba(255,196,120,0.20)', coldLight: 'rgba(140,200,255,0.16)',
  },
  ship: {
    floor: { ...FLOORS_BASE, carpet: ['#25406b', '#1f375d'], deck: ['#b98552', '#a4733f'] },
    wallFace: { warm: ['#f1ede4', '#d9d2c3'], cold: ['#c9d3dc', '#aebbc7'], neutral: ['#ebe5d8', '#d2cab9'], dim: ['#d8cfbd', '#bdb39f'], exterior: ['#f1ede4', '#d0c8b8'] },
    wallTop: '#2a3446', hull: '#20375c', hullDark: '#13213a', trim: '#e63946', metal: '#a8b2c1', metalDark: '#6c788a',
    wood: '#b9824f', woodDark: '#7a5230', fabric: '#25406b', fabricAlt: '#e63946', glass: '#a9e2f5', accent: '#e63946',
    warmLight: 'rgba(255,214,150,0.18)', coldLight: 'rgba(150,215,255,0.16)',
  },
  plane: {
    floor: { ...FLOORS_BASE, carpet: ['#4f6d8f', '#455f7e'], lino: ['#b9c4d3', '#a9b5c6'] },
    wallFace: { warm: ['#eef1f6', '#d6dce6'], cold: ['#dfe6ef', '#c3cddb'], neutral: ['#e8ecf2', '#cfd6e1'], dim: ['#d3dae5', '#b9c2d0'], exterior: ['#eef1f6', '#cdd5e1'] },
    wallTop: '#4a5568', hull: '#e9eef5', hullDark: '#b8c3d3', trim: '#2f6fb3', metal: '#c0c8d4', metalDark: '#8692a4',
    wood: '#b7a58c', woodDark: '#8a7a64', fabric: '#4f6d8f', fabricAlt: '#2f6fb3', glass: '#bfe4ff', accent: '#2f6fb3',
    warmLight: 'rgba(255,226,180,0.16)', coldLight: 'rgba(170,205,255,0.18)',
  },
  lobby: {
    floor: { ...FLOORS_BASE, checker: ['#efe3cf', '#3d405b'] },
    wallFace: { warm: ['#e9dcc9', '#cdbda6'], cold: ['#d0d7df', '#b7c0ca'], neutral: ['#e3d8c8', '#c9bcaa'], dim: ['#d4c6b1', '#baab95'], exterior: ['#e9dcc9', '#cdbda6'] },
    wallTop: '#2b2d42', hull: '#3d405b', hullDark: '#24263a', trim: '#f2cc8f', metal: '#8d99ae', metalDark: '#5f6b7e',
    wood: '#a0663b', woodDark: '#6e4325', fabric: '#81b29a', fabricAlt: '#e07a5f', glass: '#a9d6e5', accent: '#f2cc8f',
    warmLight: 'rgba(255,205,140,0.18)', coldLight: 'rgba(150,200,255,0.14)',
  },
};

export const UI = {
  bg: '#141a2e',
  panel: '#1e2742',
  panel2: '#27324f',
  line: '#3a476b',
  text: '#f3f1ea',
  muted: '#a8b1c8',
  accent: '#ff8a3d',
  accent2: '#ffd23f',
  ok: '#3ddc97',
  bad: '#ff4d5e',
  info: '#5cc8ff',
};

export function shade(hex: string, amt: number): string {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
