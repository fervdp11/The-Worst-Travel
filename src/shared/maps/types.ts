import type { Rect, Vec } from '../geometry';

export type MapId = 'train' | 'ship' | 'plane';
export type AnyMapId = MapId | 'lobby';

export type FloorKind =
  | 'carpet' | 'wood' | 'metal' | 'tile' | 'lino' | 'deck' | 'roof' | 'grate'
  | 'checker' | 'rubber' | 'concrete' | 'parquet' | 'cabin';
export type LightKind = 'warm' | 'cold' | 'neutral' | 'exterior' | 'dim';

export interface LevelDef {
  id: string;
  name: string;
  index: number;
  /** Área de simulación del nivel (incluye márgenes exteriores no transitables). */
  bounds: Rect;
  /** Contorno visual del vehículo en este nivel (casco, fuselaje, vagones). */
  outline: Vec[][];
  /** Nivel al aire libre (techo del tren, por ejemplo). */
  open?: boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  level: string;
  rect: Rect;
  floor: FloorKind;
  light: LightKind;
  accent: string;
  /** Zona del panel de ocupación. */
  zone: string;
  exterior?: boolean;
  /** Rectángulos adicionales de suelo que pertenecen a la sala. */
  extra?: Rect[];
}

export type WallKind = 'hull' | 'wall' | 'partition' | 'rail' | 'edge' | 'bellows' | 'glass';

export interface WallDef {
  level: string;
  rect: Rect;
  kind: WallKind;
  /** Bloquea la visión. Las barandillas y bordes no. */
  occludes: boolean;
  /** Dibuja cara frontal (muros horizontales). */
  face: boolean;
  /** No se pinta (colisión de casco curvo, bordes del techo...). */
  invisible?: boolean;
  /** Ventanas pintadas en la cara del muro (posiciones x). */
  windows?: number[];
}

export interface DoorDef {
  id: string;
  name: string;
  level: string;
  rect: Rect;
  orient: 'h' | 'v';
  /** Puede cerrarse con el sabotaje de puertas. */
  lockable: boolean;
  /** Umbral para el sensor del Vigilante (siempre el rect de la puerta). */
  sensor: boolean;
}

export interface PropDef {
  id: string;
  level: string;
  kind: string;
  /** Huella en el suelo (colisión si es sólido). */
  rect: Rect;
  /** Altura aparente en píxeles de mundo. */
  h: number;
  solid: boolean;
  variant?: number;
  flip?: boolean;
  color?: string;
  label?: string;
  /** Se dibuja dentro del fondo estático (sin ordenación por pies). */
  flat?: boolean;
  anim?: 'blink' | 'fan' | 'steam' | 'screen' | 'curtain' | 'liquid' | 'beacon' | 'flag';
}

export type StationKind =
  | 'task' | 'emergency' | 'cameras' | 'occupancy' | 'sabotage' | 'repair'
  | 'locker' | 'vent' | 'ladder' | 'knife' | 'commsTerminal' | 'doorPanel'
  | 'wardrobe' | 'kiosk' | 'responsible';

export interface StationDef {
  id: string;
  level: string;
  x: number;
  y: number;
  kind: StationKind;
  name: string;
  /** Distancia de uso. */
  range?: number;
  /** Prop asociado (para resaltar). */
  prop?: string;
}

export interface LadderDef {
  id: string;
  name: string;
  kind: 'ladder' | 'stairs';
  a: { level: string; x: number; y: number };
  b: { level: string; x: number; y: number };
}

export interface VentDef {
  id: string;
  name: string;
  level: string;
  x: number;
  y: number;
  links: string[];
}

export interface CameraDef {
  id: string;
  name: string;
  level: string;
  x: number;
  y: number;
  /** Encuadre del mundo que muestra la cámara. */
  view: Rect;
}

export type TaskType =
  | 'orders' | 'cooking' | 'drink' | 'dishes' | 'toilet' | 'wiring' | 'fuses' | 'pressure'
  | 'filter' | 'assist' | 'luggage' | 'roof'
  | 'signal' | 'brakes'
  | 'bilge' | 'seal' | 'ballast'
  | 'carts' | 'sorting' | 'cabinPressure';

export interface TaskSlotDef {
  id: string;
  type: TaskType;
  name: string;
  length: 'short' | 'long';
  exclusive?: boolean;
  /** Etapas: cada etapa ocurre en una de las estaciones candidatas. */
  stages: { stations: string[]; label: string }[];
}

export type SabotageKind = 'lights' | 'comms' | 'doors' | 'critical';

export interface RepairStepDef {
  stations: string[];
  minigame: string;
  label: string;
}

export interface SabotageDef {
  id: string;
  kind: SabotageKind;
  name: string;
  /** Estaciones donde el impostor prepara el sabotaje. */
  activation: string[];
  /** Pasos secuenciales de reparación. */
  repair: RepairStepDef[];
  /** Para críticos: textos y cinemática de fracaso. */
  failTitle?: string;
  failText?: string;
  failScene?: string;
  alarm?: string;
}

export interface DoorGroupDef {
  id: string;
  name: string;
  doors: string[];
}

export interface ZoneDef {
  id: string;
  name: string;
  level: string;
}

export interface InterferenceZoneDef {
  /** Terminal de comunicaciones que puede manipular el Interferente. */
  station: string;
  name: string;
  cameras: string[];
  zones: string[];
  stations: string[];
}

export interface KnifeStageDef {
  /** Estaciones candidatas (se elige una por semilla). */
  stations: string[];
  /** Señuelos plausibles de búsqueda (complejidad media/alta). */
  decoys?: string[];
  label: string;
}

export interface KnifeTemplate {
  docName: string;
  keyName: string;
  compartmentName: string;
  containerName: string;
  authName: string;
  stages: [KnifeStageDef, KnifeStageDef, KnifeStageDef, KnifeStageDef, KnifeStageDef];
}

export interface NpcSeat {
  id: string;
  level: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: 'sit' | 'stand';
  act: 'read' | 'window' | 'talk' | 'order' | 'sleep' | 'phone';
  /** Pasajero vinculado a estación de pedidos. */
  station?: string;
  /** Ruta de paseo ocasional (no cruza puertas cerrables). */
  walk?: Vec[];
}

export interface ResponsibleDef {
  title: string;
  name: string;
  level: string;
  room: string;
  patrol: Vec[];
}

export interface MapTexts {
  vehicle: string;
  short: string;
  description: string;
  routes: string;
  arrivalTitle: string;
  arrivalText: string;
  murderTitle: string;
  murderText: string;
  accessGoal: string;
  approach: string;
  ejectText: string;
}

export interface MapDef {
  id: AnyMapId;
  name: string;
  levels: LevelDef[];
  rooms: RoomDef[];
  walls: WallDef[];
  doors: DoorDef[];
  props: PropDef[];
  stations: StationDef[];
  ladders: LadderDef[];
  vents: VentDef[];
  escapistLinks: [string, string][];
  cameras: CameraDef[];
  zones: ZoneDef[];
  doorGroups: DoorGroupDef[];
  interference: InterferenceZoneDef[];
  sabotages: SabotageDef[];
  tasks: TaskSlotDef[];
  knife?: KnifeTemplate;
  responsible?: ResponsibleDef;
  npcs: NpcSeat[];
  spawn: { level: string; x: number; y: number }[];
  safePoints: { level: string; x: number; y: number }[];
  meetingRoom: string;
  texts: MapTexts;
  /** Multiplicador de plazos críticos según distancias del mapa. */
  critTimeScale: number;
  theme: MapTheme;
}

export interface MapTheme {
  scenery: 'land' | 'sea' | 'sky' | 'terminal';
  /** Colores base de la guía de arte. */
  bg: string;
  hull: string;
  hullDark: string;
  trim: string;
  wallTop: string;
  wallFace: string;
  wallFaceDark: string;
  accent: string;
  metal: string;
}
