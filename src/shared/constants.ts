/** Constantes de simulación compartidas por cliente y servidor. */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
export const SNAPSHOT_EVERY = 2; // 15 instantáneas/s
export const BASE_SPEED = 190; // unidades de mundo por segundo
export const BASE_VISION = 340;
export const MIN_VISION = 110;
export const USE_RANGE = 78;
export const ATTACK_RANGE = 74;
export const RECONNECT_GRACE_MS = 30_000;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const INTERP_DELAY_MS = 120;
export const MAX_INPUT_BUFFER = 8;
export const LADDER_MS = 900;
export const VENT_ANIM_MS = 450;
export const VENT_MOVE_MS = 550;
export const LOCKER_ANIM_MS = 400;
export const MEETING_CALL_MS = 3000;
export const RESULTS_MS = 5500;
export const EJECT_MS = 7000;
export const INTRO_MS = 5000;
export const COUNTDOWN_MS = 3000;
export const FINAL_MS = 11000;
export const CHAT_MAX = 160;

export interface ColorDef {
  id: number;
  name: string;
  hex: string;
  dark: string;
  /** Distintivo bordado en la chaqueta para no depender solo del color. */
  mark: 'star' | 'stripe' | 'dot' | 'cross' | 'diamond' | 'moon' | 'heart' | 'bolt' | 'leaf' | 'drop' | 'ring' | 'triangle';
}

export const COLORS: ColorDef[] = [
  { id: 0, name: 'Rojo', hex: '#e63946', dark: '#9d1c27', mark: 'star' },
  { id: 1, name: 'Azul', hex: '#2f6fe0', dark: '#1a3f8c', mark: 'stripe' },
  { id: 2, name: 'Verde', hex: '#2bb24c', dark: '#16702c', mark: 'leaf' },
  { id: 3, name: 'Amarillo', hex: '#f6c90e', dark: '#a8860a', mark: 'bolt' },
  { id: 4, name: 'Naranja', hex: '#f77f00', dark: '#a35300', mark: 'triangle' },
  { id: 5, name: 'Morado', hex: '#7b2cbf', dark: '#4b1577', mark: 'moon' },
  { id: 6, name: 'Rosa', hex: '#f472b6', dark: '#b03f7d', mark: 'heart' },
  { id: 7, name: 'Cian', hex: '#22d3ee', dark: '#0e8aa0', mark: 'drop' },
  { id: 8, name: 'Blanco', hex: '#eef2f7', dark: '#a9b4c2', mark: 'dot' },
  { id: 9, name: 'Negro', hex: '#3b3f4a', dark: '#1d1f26', mark: 'cross' },
  { id: 10, name: 'Marrón', hex: '#8d5a3b', dark: '#563321', mark: 'diamond' },
  { id: 11, name: 'Lima', hex: '#a3e635', dark: '#5f8c13', mark: 'ring' },
];

export const ACCESSORIES = [
  { id: 0, name: 'Gorra de revisor' },
  { id: 1, name: 'Boina marinera' },
  { id: 2, name: 'Gorro de piloto' },
  { id: 3, name: 'Sombrero de copa' },
  { id: 4, name: 'Gorro de lana' },
  { id: 5, name: 'Flor en la gorra' },
  { id: 6, name: 'Auriculares' },
  { id: 7, name: 'Pajarita' },
  { id: 8, name: 'Gafas de sol' },
  { id: 9, name: 'Sin accesorio' },
] as const;
