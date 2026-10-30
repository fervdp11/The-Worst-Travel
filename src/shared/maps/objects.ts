import type { Rect } from '../geometry';
import type { PropDef } from './types';

/**
 * Definición única de cada objeto del plano. De aquí se derivan, sin
 * posiciones duplicadas a mano:
 *  A) colisión (qué ocupa espacio),
 *  B) representación (caja visual, anclaje y orden de capas),
 *  C) sombra (contacto, proyección o ninguna),
 *  D) oclusión de la visión (solo objetos altos marcados).
 *
 * Proyección 3/4: la huella `rect` es el suelo que pisa el objeto; su cara
 * frontal sube `h` píxeles y la tapa se desplaza hacia arriba `h`. La parte
 * visible por encima de la huella también es sólida para el cuerpo del
 * personaje, de modo que nadie «entra» en la mitad superior de un mueble.
 */

export type ShadowKind = 'box' | 'legs' | 'pole' | 'wall' | 'low' | 'none';
export type MountKind = 'floor' | 'wall';

interface KindInfo {
  shadow: ShadowKind;
  mount?: MountKind;
  /** Bloquea la visión si su altura lo justifica. */
  tall?: boolean;
}

const INFO: Record<string, KindInfo> = {
  // Mesas y asientos: apoyo en patas, sombra bajo el tablero.
  roundTable: { shadow: 'legs' }, meetingTable: { shadow: 'legs' }, diningSet: { shadow: 'legs' }, chartTable: { shadow: 'legs' },
  deckChair: { shadow: 'legs' }, bench: { shadow: 'legs' }, seat: { shadow: 'low' }, seatRow: { shadow: 'low' }, chair: { shadow: 'legs' },
  pilotSeat: { shadow: 'low' }, jumpSeat: { shadow: 'low' }, sofa: { shadow: 'low' }, armchairSet: { shadow: 'low' },
  bed: { shadow: 'low' }, crewBunk: { shadow: 'low' }, medBed: { shadow: 'legs' }, cartBasket: { shadow: 'low' },
  // Postes con base visible
  flagPole: { shadow: 'pole' }, mast: { shadow: 'pole' }, cameraMast: { shadow: 'pole' }, antenna: { shadow: 'pole' }, lampPost: { shadow: 'pole' },
  plant: { shadow: 'low' }, extinguisher: { shadow: 'low' }, trash: { shadow: 'low' }, bollard: { shadow: 'low' },
  // Montados en pared o barandilla: sin elipse en el suelo.
  lifering: { shadow: 'wall', mount: 'wall' }, noticeBoard: { shadow: 'wall', mount: 'wall' }, board: { shadow: 'wall', mount: 'wall' },
  mirror: { shadow: 'wall', mount: 'wall' }, lifeVests: { shadow: 'wall', mount: 'wall' }, overheadBins: { shadow: 'wall', mount: 'wall' },
  sectionSign: { shadow: 'wall', mount: 'wall' }, wallScreen: { shadow: 'wall', mount: 'wall' },
  // Altos: bloquean la visión.
  shelf: { shadow: 'box', tall: true }, bookShelf: { shadow: 'box', tall: true }, luggageShelf: { shadow: 'box', tall: true },
  luggageRack: { shadow: 'box', tall: true }, locker: { shadow: 'box', tall: true }, cleanLocker: { shadow: 'box', tall: true },
  wardrobe: { shadow: 'box', tall: true }, medCabinet: { shadow: 'box', tall: true }, serverRack: { shadow: 'box', tall: true },
  avionicsRack: { shadow: 'box', tall: true }, container: { shadow: 'box', tall: true }, uld: { shadow: 'box', tall: true },
  fridge: { shadow: 'box', tall: true }, marketShelf: { shadow: 'box', tall: true }, marketFridge: { shadow: 'box', tall: true },
  funnel: { shadow: 'box', tall: true }, lifeboat: { shadow: 'box' },
  // Planos o sin volumen
  railLine: { shadow: 'none' }, vent: { shadow: 'none' }, hatch: { shadow: 'none' }, rug: { shadow: 'none' },
};

/** Altura mínima para que un objeto marcado como alto bloquee la visión. */
export const OCCLUDE_MIN_H = 70;
/** Parte de la altura aparente que no es sólida (margen visual para pies y cabeza). */
const SOLID_TOP_MARGIN = 26;
/** Tope de extensión sólida por encima de la huella. */
const SOLID_TOP_MAX = 84;

export function kindInfo(kind: string): KindInfo {
  return INFO[kind] ?? { shadow: 'box' };
}

export function propMount(p: PropDef): MountKind {
  return p.mount ?? kindInfo(p.kind).mount ?? 'floor';
}

export function propShadow(p: PropDef): ShadowKind {
  if (p.flat || p.h < 4) return 'none';
  return p.shadow ?? kindInfo(p.kind).shadow;
}

/** Caja visual completa (cara frontal + tapa), sin el margen del recurso. */
export function propVisualRect(p: PropDef): Rect {
  if (p.flat) return { ...p.rect };
  return { x: p.rect.x, y: p.rect.y - p.h, w: p.rect.w, h: p.rect.h + p.h };
}

/**
 * Colisión del objeto: huella más la parte de la proyección que ocupa el
 * cuerpo del personaje. Los objetos montados en pared y los no sólidos no
 * tienen colisión propia (la pared ya es sólida).
 */
export function propCollider(p: PropDef): Rect | null {
  if (!p.solid || p.flat || propMount(p) === 'wall') return null;
  // Un poste fino solo ocupa su base; un mueble, también su volumen aparente.
  const ext = propShadow(p) === 'pole' ? 0 : Math.max(0, Math.min(SOLID_TOP_MAX, p.h - SOLID_TOP_MARGIN));
  return { x: p.rect.x, y: p.rect.y - ext, w: p.rect.w, h: p.rect.h + ext };
}

/** Volumen que bloquea la visión (solo objetos altos, nunca su sombra). */
export function propOccluder(p: PropDef): Rect | null {
  if (!p.solid || p.flat) return null;
  const tall = p.occlude ?? (kindInfo(p.kind).tall === true && p.h >= OCCLUDE_MIN_H);
  if (!tall) return null;
  return { ...p.rect };
}

/** Punto de anclaje para ordenar capas (base frontal de la huella). */
export function propDepth(p: PropDef): number {
  return p.rect.y + p.rect.h;
}
