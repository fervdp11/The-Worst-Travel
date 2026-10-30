/**
 * Compositor ÚNICO del personaje. Lo usan el mundo (Character), los retratos
 * del chat y de la votación, el vestuario, la tarjeta de rol y las cinemáticas.
 *
 * Coordenadas en unidades de mundo con origen en el punto de apoyo (pies).
 * Cada complemento se ancla a un punto local del cuerpo (cabeza, ojos o cuello)
 * con su desplazamiento propio; nada se recoloca «a ojo» en cada vista.
 */

/** Medidas del sprite de cuerpo (ver characters.ts): 44 × 50, origen centro-inferior. */
export const BODY = { w: 44, h: 50, idleY: -3 } as const;
/** Medidas de los recursos de complemento: 44 × 30, origen centro-inferior. */
export const ACC_TEX = { w: 44, h: 30 } as const;

export type AnchorId = 'head' | 'eyes' | 'neck';

/** Anclajes locales del modelo de cuerpo, medidos desde la base del sprite de cuerpo. */
export const BODY_ANCHORS: Record<AnchorId, { x: number; y: number }> = {
  // Línea de la frente: donde apoya el ala de gorras y sombreros.
  head: { x: 2, y: -36 },
  // Centro de los ojos (miran a la derecha).
  eyes: { x: 8, y: -32 },
  // Cuello de la chaqueta.
  neck: { x: 4, y: -17 },
};

export interface AccessoryAnchor {
  anchor: AnchorId;
  /** Punto del recurso (desde su base centrada) que coincide con el anclaje. */
  px: number;
  py: number;
  /** Capa respecto al cuerpo: delante (por defecto). */
  layer: 'front';
}

/** Desplazamiento de cada complemento respecto a su anclaje (auditado para los diez). */
export const ACCESSORY_ANCHORS: Record<number, AccessoryAnchor> = {
  0: { anchor: 'head', px: 0, py: -4, layer: 'front' }, // gorra de revisor
  1: { anchor: 'head', px: 0, py: -4, layer: 'front' }, // boina
  2: { anchor: 'head', px: 0, py: -4, layer: 'front' }, // gorro de piloto
  3: { anchor: 'head', px: 0, py: -4, layer: 'front' }, // sombrero de copa
  4: { anchor: 'head', px: 0, py: -3, layer: 'front' }, // gorro de lana
  5: { anchor: 'head', px: 0, py: -4, layer: 'front' }, // gorra con flor
  6: { anchor: 'head', px: 0, py: -2, layer: 'front' }, // auriculares
  7: { anchor: 'neck', px: 0, py: -3, layer: 'front' }, // pajarita
  8: { anchor: 'eyes', px: 6, py: -7, layer: 'front' }, // gafas de sol
};
/** El gorro del responsable apoya como una gorra. */
export const RESP_HAT: AccessoryAnchor = { anchor: 'head', px: 0, py: -4, layer: 'front' };

export function accessoryKey(color: number, acc: number): string | null {
  if (acc === 9 || !(acc in ACCESSORY_ANCHORS)) return null;
  return [3, 4, 6, 7].includes(acc) ? `ch_acc_${acc}_${color}` : `ch_acc_${acc}`;
}

/**
 * Posición (base centrada del recurso) del complemento para una pose:
 * `bodyY` desplazamiento del cuerpo, `rot` inclinación, `sy` aplastamiento,
 * `flip` 1 mirando a la derecha, −1 a la izquierda.
 */
export function accessoryPos(a: AccessoryAnchor, bodyY: number, rot: number, sy: number, flip: 1 | -1): { x: number; y: number } {
  const an = BODY_ANCHORS[a.anchor];
  const lx = an.x - a.px;
  const ly = an.y * sy - a.py;
  // Rotación alrededor de la base del cuerpo (el conjunto se balancea unido).
  const c = Math.cos(rot), s = Math.sin(rot);
  const rx = lx * c - ly * s, ry = lx * s + ly * c;
  return { x: rx * flip, y: bodyY + ry };
}

export interface Part {
  key: string;
  /** Centro del recurso en x y su base o centro en y según `origin`. */
  x: number;
  y: number;
  w: number;
  h: number;
  origin: 'bottom' | 'center';
}

/** Pose de reposo usada por retratos y vestuario (idéntica a la del mundo en reposo). */
export function idleParts(o: { color: number; acc: number; ghost?: boolean; resp?: string }): Part[] {
  const parts: Part[] = [];
  parts.push({ key: 'ch_shadow', x: 0, y: 0, w: 40, h: 16, origin: 'center' });
  if (!o.ghost) {
    parts.push({ key: 'ch_foot', x: -7, y: -3, w: 14, h: 10, origin: 'center' });
    parts.push({ key: 'ch_foot', x: 7, y: -3, w: 14, h: 10, origin: 'center' });
  }
  const bodyY = o.ghost ? -10 : BODY.idleY;
  parts.push({ key: o.resp ? `resp_body_${o.resp}` : o.ghost ? `ch_ghost_${o.color}` : `ch_body_${o.color}`, x: 0, y: bodyY, w: BODY.w, h: BODY.h, origin: 'bottom' });
  parts.push({ key: 'ch_hand', x: -15, y: -16 + (bodyY - BODY.idleY), w: 10, h: 10, origin: 'center' });
  parts.push({ key: 'ch_hand', x: 15, y: -16 + (bodyY - BODY.idleY), w: 10, h: 10, origin: 'center' });
  const key = o.resp ? `resp_hat_${o.resp}` : accessoryKey(o.color, o.acc);
  const anc = o.resp ? RESP_HAT : ACCESSORY_ANCHORS[o.acc];
  if (key && anc) {
    const p = accessoryPos(anc, bodyY, 0, 1, 1);
    parts.push({ key, x: p.x, y: p.y, w: ACC_TEX.w, h: ACC_TEX.h, origin: 'bottom' });
  }
  return parts;
}
